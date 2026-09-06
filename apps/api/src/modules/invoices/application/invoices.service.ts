import { Injectable } from '@nestjs/common';
import { Prisma, type Invoice } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';

import { AppException } from '@/common/http/app-exception';
import { detectarAlertas, type AlertaDetectada } from '@/domain/detection/invoice-comparison';
import { CivilDate } from '@/domain/time/civil-date';
import { PrismaService } from '@/infra/prisma/prisma.service';
import type { TenantContext } from '@/modules/auth/tenant-context';

import type { RegistrarFacturaInput } from '../contracts/invoice.schemas';

export interface FacturaRespuesta {
  id: string;
  cycleId: string;
  serviceId: string;
  status: string;
  externalNumber: string | null;
  issueDate: string;
  dueDate: string;
  secondDueDate: string | null;
  totalAmount: string;
  currentChargeAmount: string;
  includedPriorDebtAmount: string;
  priorDebtInterestAmount: string;
  otherChargesAmount: string;
  isEstimatedByProvider: boolean;
  notes: string | null;
  /** Comparacion contra lo que se esperaba. Null si no habia estimacion. */
  comparison: {
    expectedAmount: string | null;
    difference: string | null;
    percent: string | null;
    direction: string;
  } | null;
  alerts: Array<{ type: string; severity: string; title: string; message: string }>;
}

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra la factura que llego y la compara contra lo proyectado.
   *
   * Todo ocurre en una transaccion: si la deteccion falla, no queda una factura
   * a medias sin sus alertas.
   */
  async registrar(
    tenant: TenantContext,
    input: RegistrarFacturaInput,
  ): Promise<FacturaRespuesta> {
    const ciclo = await this.prisma.billingCycle.findFirst({
      where: { id: input.cycleId, userId: tenant.userId },
      include: {
        service: { select: { id: true, name: true, providerName: true, currency: true } },
        invoices: { where: { status: 'ISSUED' }, select: { id: true } },
      },
    });

    if (!ciclo) {
      throw AppException.notFound('CYCLE_NOT_FOUND', 'No encontramos ese período');
    }

    if (ciclo.invoices.length > 0) {
      throw AppException.conflict(
        'INVOICE_ALREADY_EXISTS',
        'Ese período ya tiene una factura registrada',
        'Anulá la factura anterior si querés reemplazarla: no se sobrescribe, queda el historial.',
      );
    }

    const cargo = new Prisma.Decimal(input.currentChargeAmount);
    const deuda = new Prisma.Decimal(input.includedPriorDebtAmount);
    const intereses = new Prisma.Decimal(input.priorDebtInterestAmount);
    const otros = new Prisma.Decimal(input.otherChargesAmount);
    const total = cargo.plus(deuda).plus(intereses).plus(otros);

    const vencimientoReal = CivilDate.parse(input.dueDate);

    const detectadas = detectarAlertas(
      {
        montoEsperado: ciclo.expectedAmount,
        vencimientoProyectado: ciclo.projectedDueDate
          ? CivilDate.desdePrisma(ciclo.projectedDueDate)
          : null,
        nombreDelServicio: ciclo.service.providerName
          ? `${ciclo.service.providerName} · ${ciclo.service.name}`
          : ciclo.service.name,
        periodo: ciclo.periodKey,
      },
      {
        cargoDelPeriodo: cargo,
        deudaAnteriorIncluida: deuda,
        interesesFacturados: intereses,
        vencimientoReal,
      },
    );

    const invoiceId = uuidv7();

    const factura = await this.prisma.$transaction(async (tx) => {
      const creada = await tx.invoice.create({
        data: {
          id: invoiceId,
          userId: tenant.userId,
          serviceId: ciclo.serviceId,
          cycleId: ciclo.id,
          externalNumber: input.externalNumber ?? null,
          issueDate: CivilDate.parse(input.issueDate).aPrisma(),
          dueDate: vencimientoReal.aPrisma(),
          secondDueDate: input.secondDueDate
            ? CivilDate.parse(input.secondDueDate).aPrisma()
            : null,
          currency: ciclo.service.currency,
          totalAmount: total,
          currentChargeAmount: cargo,
          includedPriorDebtAmount: deuda,
          priorDebtInterestAmount: intereses,
          otherChargesAmount: otros,
          isEstimatedByProvider: input.isEstimatedByProvider,
          notes: input.notes ?? null,
        },
      });

      // El ciclo pasa a facturado y adopta el vencimiento REAL. El estimado
      // original se conserva en projectedDueDate para poder medir el desvio.
      await tx.billingCycle.update({
        where: { id: ciclo.id },
        data: {
          lifecycle: 'INVOICED',
          dueDate: vencimientoReal.aPrisma(),
          dueDateSource: 'REAL_INVOICE',
        },
      });

      await this.guardarAlertas(tx, tenant.userId, ciclo, invoiceId, detectadas);

      return creada;
    });

    return this.aRespuesta(factura, ciclo.expectedAmount, detectadas);
  }

  /**
   * Anula una factura. NUNCA se borra: una factura es un hecho ocurrido, y
   * borrarla falsearia el historial financiero.
   */
  async anular(tenant: TenantContext, id: string, motivo: string): Promise<void> {
    const factura = await this.prisma.invoice.findFirst({
      where: { id, userId: tenant.userId, status: 'ISSUED' },
      select: { id: true, cycleId: true },
    });

    if (!factura) {
      throw AppException.notFound('INVOICE_NOT_FOUND', 'No encontramos esa factura');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: factura.id },
        data: { status: 'VOID', voidedAt: new Date(), voidReason: motivo },
      });

      // El periodo vuelve a esperar factura, y su vencimiento vuelve a ser el
      // proyectado, porque el real venia de la factura anulada.
      const ciclo = await tx.billingCycle.findUniqueOrThrow({
        where: { id: factura.cycleId },
        select: { projectedDueDate: true },
      });

      await tx.billingCycle.update({
        where: { id: factura.cycleId },
        data: {
          lifecycle: 'AWAITING_INVOICE',
          dueDate: ciclo.projectedDueDate,
          dueDateSource: 'USER_ESTIMATE',
        },
      });
    });
  }

  async delServicio(tenant: TenantContext, serviceId: string): Promise<FacturaRespuesta[]> {
    const servicio = await this.prisma.service.findFirst({
      where: { id: serviceId, userId: tenant.userId },
      select: { id: true },
    });

    if (!servicio) {
      throw AppException.notFound('SERVICE_NOT_FOUND', 'No encontramos ese servicio');
    }

    const facturas = await this.prisma.invoice.findMany({
      where: { serviceId, userId: tenant.userId },
      include: { cycle: { select: { expectedAmount: true } } },
      orderBy: { dueDate: 'desc' },
      take: 60,
    });

    return facturas.map((f) => this.aRespuesta(f, f.cycle.expectedAmount, []));
  }

  private async guardarAlertas(
    tx: Prisma.TransactionClient,
    userId: string,
    ciclo: { id: string; serviceId: string; periodKey: string },
    invoiceId: string,
    alertas: AlertaDetectada[],
  ): Promise<void> {
    for (const alerta of alertas) {
      // La clave de deduplicacion es determinista: si el mismo hecho se vuelve
      // a evaluar, no aparece una alerta repetida.
      const dedupeKey = `${alerta.tipo}:${ciclo.id}`;

      await tx.alert.upsert({
        where: { userId_dedupeKey: { userId, dedupeKey } },
        create: {
          id: uuidv7(),
          userId,
          serviceId: ciclo.serviceId,
          cycleId: ciclo.id,
          invoiceId,
          type: alerta.tipo,
          severity: alerta.severidad,
          title: alerta.titulo,
          message: alerta.mensaje,
          baselineValue: alerta.baseline,
          observedValue: alerta.observado,
          deltaAbsolute: alerta.diferencia,
          deltaPercent: alerta.porcentaje,
          dedupeKey,
        },
        update: {
          message: alerta.mensaje,
          observedValue: alerta.observado,
          deltaAbsolute: alerta.diferencia,
          deltaPercent: alerta.porcentaje,
          status: 'NEW',
          detectedAt: new Date(),
        },
      });
    }
  }

  private aRespuesta(
    factura: Invoice,
    esperado: Prisma.Decimal | null,
    alertas: AlertaDetectada[],
  ): FacturaRespuesta {
    const cambio = alertas.find(
      (a) => a.tipo === 'AMOUNT_INCREASE' || a.tipo === 'AMOUNT_DECREASE',
    );

    return {
      id: factura.id,
      cycleId: factura.cycleId,
      serviceId: factura.serviceId,
      status: factura.status,
      externalNumber: factura.externalNumber,
      issueDate: CivilDate.desdePrisma(factura.issueDate).toString(),
      dueDate: CivilDate.desdePrisma(factura.dueDate).toString(),
      secondDueDate: factura.secondDueDate
        ? CivilDate.desdePrisma(factura.secondDueDate).toString()
        : null,
      // Todo el dinero viaja como texto.
      totalAmount: factura.totalAmount.toFixed(2),
      currentChargeAmount: factura.currentChargeAmount.toFixed(2),
      includedPriorDebtAmount: factura.includedPriorDebtAmount.toFixed(2),
      priorDebtInterestAmount: factura.priorDebtInterestAmount.toFixed(2),
      otherChargesAmount: factura.otherChargesAmount.toFixed(2),
      isEstimatedByProvider: factura.isEstimatedByProvider,
      notes: factura.notes,
      comparison:
        esperado === null
          ? null
          : {
              expectedAmount: esperado.toFixed(2),
              difference: factura.currentChargeAmount.minus(esperado).toFixed(2),
              percent: esperado.isZero()
                ? null
                : factura.currentChargeAmount
                    .minus(esperado)
                    .dividedBy(esperado)
                    .times(100)
                    .toFixed(2),
              direction: cambio?.tipo ?? 'SIN_CAMBIO_RELEVANTE',
            },
      alerts: alertas.map((a) => ({
        type: a.tipo,
        severity: a.severidad,
        title: a.titulo,
        message: a.mensaje,
      })),
    };
  }
}
