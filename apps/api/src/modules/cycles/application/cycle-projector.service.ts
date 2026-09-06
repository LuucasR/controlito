import { Injectable, Logger } from '@nestjs/common';
import { Prisma, type ServiceCondition } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';

import {
  generarPeriodos,
  type CondicionDePeriodos,
  type Frecuencia,
} from '@/domain/billing/period-generator';
import { vigenteEn } from '@/domain/conditions/condition-timeline';
import { CivilDate } from '@/domain/time/civil-date';
import { PrismaService } from '@/infra/prisma/prisma.service';

/** Cuántos períodos hacia adelante se materializan. */
const PERIODOS_DE_HORIZONTE = 3;

/** Versión de la lógica de proyección, guardada en cada fila que genera. */
const VERSION_DEL_PROYECTOR = 1;

export interface ResultadoProyeccion {
  creados: number;
  actualizados: number;
  intactos: number;
}

/**
 * Materializa los períodos de un servicio como filas de BillingCycle.
 *
 * Decisiones que hacen que esto sea seguro de correr en cualquier momento:
 *
 * 1. IDEMPOTENCIA. El inicio de cada período se calcula desde el ancla de la
 *    condición, nunca desde "hoy". Con la clave única (serviceId, periodStart),
 *    correrlo una vez o cincuenta deja exactamente las mismas filas.
 *
 * 2. BARRERA DE INMUTABILIDAD. Un ciclo que ya pasó a INVOICED, CLOSED,
 *    SKIPPED o CANCELLED no se toca jamás. Un cambio de tarifa de hoy no puede
 *    reescribir lo que ya se facturó.
 *
 * 3. HORIZONTE ACOTADO. Se materializan tres períodos hacia adelante y no toda
 *    la eternidad: alcanza para adjuntar una factura anticipada o anotar algo,
 *    sin que la tabla crezca sin techo.
 */
@Injectable()
export class CycleProjectorService {
  private readonly logger = new Logger(CycleProjectorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Proyecta todos los servicios activos de un usuario. */
  async proyectarUsuario(userId: string, timezone: string): Promise<ResultadoProyeccion> {
    const servicios = await this.prisma.service.findMany({
      where: { userId, status: 'ACTIVE', archivedAt: null },
      select: { id: true },
    });

    const total: ResultadoProyeccion = { creados: 0, actualizados: 0, intactos: 0 };

    for (const servicio of servicios) {
      const parcial = await this.proyectarServicio(userId, servicio.id, timezone);
      total.creados += parcial.creados;
      total.actualizados += parcial.actualizados;
      total.intactos += parcial.intactos;
    }

    return total;
  }

  async proyectarServicio(
    userId: string,
    serviceId: string,
    timezone: string,
  ): Promise<ResultadoProyeccion> {
    const servicio = await this.prisma.service.findFirst({
      where: { id: serviceId, userId },
      include: { conditions: { orderBy: { validFrom: 'asc' } } },
    });

    if (!servicio || servicio.conditions.length === 0) {
      return { creados: 0, actualizados: 0, intactos: 0 };
    }

    // "Hoy" segun la zona del usuario, no la del servidor: despues de las 21:00
    // en Argentina, UTC ya esta en el dia siguiente.
    const hoy = CivilDate.hoyEn(timezone);
    const inicio = CivilDate.desdePrisma(servicio.startDate);
    const fin = servicio.endDate ? CivilDate.desdePrisma(servicio.endDate) : null;

    const condiciones = servicio.conditions.map((c) => this.aTramo(c));
    const ultima = servicio.conditions[servicio.conditions.length - 1]!;

    const horizonte = this.calcularHorizonte(ultima, hoy);
    const desde = inicio.isAfter(hoy) ? inicio : this.retroceder(ultima, hoy);

    const periodos = generarPeriodos(this.aCondicionDePeriodos(ultima), desde, horizonte).filter(
      (p) => !p.periodStart.isBefore(inicio) && (fin === null || !p.periodStart.isAfter(fin)),
    );

    const resultado: ResultadoProyeccion = { creados: 0, actualizados: 0, intactos: 0 };

    for (const periodo of periodos) {
      // La condicion que rige es la vigente al empezar el periodo, no la
      // ultima cargada: asi un periodo viejo conserva las condiciones de
      // entonces.
      const condicion =
        vigenteEn(condiciones, periodo.periodStart) !== null
          ? servicio.conditions.find(
              (c) => c.id === vigenteEn(condiciones, periodo.periodStart)!.id,
            )!
          : ultima;

      const estado = await this.aplicar(userId, serviceId, servicio.currency, periodo, condicion);
      resultado[estado] += 1;
    }

    return resultado;
  }

  /**
   * Crea o actualiza un ciclo.
   *
   * Devuelve 'intactos' cuando el ciclo ya paso a una etapa que el proyector
   * no debe tocar: es la barrera que impide que un cambio de condiciones
   * reescriba un periodo ya facturado.
   */
  private async aplicar(
    userId: string,
    serviceId: string,
    currency: string,
    periodo: ReturnType<typeof generarPeriodos>[number],
    condicion: ServiceCondition,
  ): Promise<'creados' | 'actualizados' | 'intactos'> {
    const existente = await this.prisma.billingCycle.findUnique({
      where: { serviceId_periodStart: { serviceId, periodStart: periodo.periodStart.aPrisma() } },
    });

    const estimado = this.montoEstimado(condicion);
    const vencimiento = periodo.dueDate?.aPrisma() ?? null;

    if (!existente) {
      await this.prisma.billingCycle.create({
        data: {
          id: uuidv7(),
          userId,
          serviceId,
          conditionId: condicion.id,
          periodStart: periodo.periodStart.aPrisma(),
          periodEnd: periodo.periodEnd.aPrisma(),
          periodKey: periodo.periodKey,
          periodIndex: periodo.periodIndex,
          dueDate: vencimiento,
          projectedDueDate: vencimiento,
          expectedAmount: estimado.monto,
          expectedAmountSource: estimado.origen,
          currency,
          lifecycle: 'PROJECTED',
          generationVersion: VERSION_DEL_PROYECTOR,
        },
      });
      return 'creados';
    }

    const editable =
      (existente.lifecycle === 'PROJECTED' || existente.lifecycle === 'AWAITING_INVOICE') &&
      !existente.expectedAmountLocked;

    if (!editable) return 'intactos';

    await this.prisma.billingCycle.update({
      where: { id: existente.id },
      data: {
        conditionId: condicion.id,
        periodEnd: periodo.periodEnd.aPrisma(),
        periodKey: periodo.periodKey,
        periodIndex: periodo.periodIndex,
        // El vencimiento real, si ya llego una factura, no se pisa.
        ...(existente.dueDateSource === 'REAL_INVOICE' ? {} : { dueDate: vencimiento }),
        expectedAmount: estimado.monto,
        expectedAmountSource: estimado.origen,
        generationVersion: VERSION_DEL_PROYECTOR,
      },
    });

    return 'actualizados';
  }

  /**
   * Monto que se espera para el periodo, segun la condicion vigente.
   *
   * Cuando el servicio es variable y no hay base para estimar, devuelve null y
   * NO cero: la interfaz muestra "?" en vez de afirmar un numero que nadie
   * calculo. Afirmar cero seria mentir sobre lo mas importante de la app.
   */
  private montoEstimado(condicion: ServiceCondition): {
    monto: Prisma.Decimal | null;
    origen: 'USER_FIXED' | 'USER_ESTIMATE' | 'UNKNOWN';
  } {
    if (condicion.amountMode === 'VARIABLE_UNKNOWN' || condicion.baseAmount === null) {
      return { monto: null, origen: 'UNKNOWN' };
    }

    return {
      monto: condicion.baseAmount,
      origen: condicion.amountMode === 'FIXED' ? 'USER_FIXED' : 'USER_ESTIMATE',
    };
  }

  /** Hasta donde se materializa: tres periodos despues de hoy. */
  private calcularHorizonte(condicion: ServiceCondition, hoy: CivilDate): CivilDate {
    const meses: Partial<Record<Frecuencia, number>> = {
      MONTHLY: 1,
      BIMONTHLY: 2,
      QUARTERLY: 3,
      SEMIANNUAL: 6,
      ANNUAL: 12,
    };
    const porPeriodo = meses[condicion.frequency];

    return porPeriodo === undefined
      ? hoy.addDays(PERIODOS_DE_HORIZONTE * 14)
      : hoy.addMonths(PERIODOS_DE_HORIZONTE * porPeriodo);
  }

  /**
   * Desde donde se empieza a materializar hacia atras.
   *
   * Se retrocede un periodo para que el periodo en curso y el inmediatamente
   * anterior existan siempre: son los que el usuario esta por pagar o acaba de
   * recibir.
   */
  private retroceder(condicion: ServiceCondition, hoy: CivilDate): CivilDate {
    const meses: Partial<Record<Frecuencia, number>> = {
      MONTHLY: 1,
      BIMONTHLY: 2,
      QUARTERLY: 3,
      SEMIANNUAL: 6,
      ANNUAL: 12,
    };
    const porPeriodo = meses[condicion.frequency];

    return porPeriodo === undefined ? hoy.addDays(-28) : hoy.addMonths(-porPeriodo);
  }

  private aTramo(c: ServiceCondition) {
    return {
      id: c.id,
      validFrom: CivilDate.desdePrisma(c.validFrom),
      validTo: c.validTo ? CivilDate.desdePrisma(c.validTo) : null,
    };
  }

  private aCondicionDePeriodos(c: ServiceCondition): CondicionDePeriodos {
    return {
      periodAnchorDate: CivilDate.desdePrisma(c.periodAnchorDate),
      frequency: c.frequency,
      dueDayOfMonth: c.dueDayOfMonth,
      dueDayPolicy: c.dueDayPolicy,
    };
  }
}
