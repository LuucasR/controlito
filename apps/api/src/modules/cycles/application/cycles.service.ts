import { Injectable } from '@nestjs/common';
import type { BillingCycle } from '@prisma/client';

import { AppException } from '@/common/http/app-exception';
import { CivilDate } from '@/domain/time/civil-date';
import { PrismaService } from '@/infra/prisma/prisma.service';
import type { TenantContext } from '@/modules/auth/tenant-context';

import { CycleProjectorService } from './cycle-projector.service';

export interface CicloRespuesta {
  id: string;
  serviceId: string;
  serviceName: string;
  providerName: string | null;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string | null;
  lifecycle: string;
  expectedAmount: string | null;
  expectedAmountSource: string;
  currency: string;
  /** Días hasta el vencimiento. Negativo si ya pasó. */
  daysUntilDue: number | null;
  isOverdue: boolean;
}

@Injectable()
export class CyclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly proyector: CycleProjectorService,
  ) {}

  /**
   * Próximos vencimientos del usuario.
   *
   * Antes de consultar se proyecta: así los períodos existen aunque no haya
   * corrido ninguna tarea programada. El trabajo en segundo plano es una
   * optimización, no una dependencia, y por eso la app funciona igual en un
   * servidor que se suspende por inactividad.
   */
  async proximos(tenant: TenantContext, dias: number): Promise<CicloRespuesta[]> {
    const usuario = await this.prisma.user.findUniqueOrThrow({
      where: { id: tenant.userId },
      select: { timezone: true },
    });

    await this.proyector.proyectarUsuario(tenant.userId, usuario.timezone);

    const hoy = CivilDate.hoyEn(usuario.timezone);
    const hasta = hoy.addDays(dias);

    const ciclos = await this.prisma.billingCycle.findMany({
      where: {
        userId: tenant.userId,
        lifecycle: { in: ['PROJECTED', 'AWAITING_INVOICE', 'INVOICED'] },
        dueDate: { not: null, lte: hasta.aPrisma() },
      },
      include: { service: { select: { name: true, providerName: true } } },
      orderBy: [{ dueDate: 'asc' }],
      take: 100,
    });

    return ciclos.map((c) => this.aRespuesta(c, c.service, hoy));
  }

  /** Ciclos de un servicio, del más nuevo al más viejo. */
  async delServicio(tenant: TenantContext, serviceId: string): Promise<CicloRespuesta[]> {
    const servicio = await this.prisma.service.findFirst({
      where: { id: serviceId, userId: tenant.userId },
      select: { id: true, name: true, providerName: true, user: { select: { timezone: true } } },
    });

    if (!servicio) {
      throw AppException.notFound('SERVICE_NOT_FOUND', 'No encontramos ese servicio');
    }

    await this.proyector.proyectarServicio(
      tenant.userId,
      serviceId,
      servicio.user.timezone,
    );

    const hoy = CivilDate.hoyEn(servicio.user.timezone);

    const ciclos = await this.prisma.billingCycle.findMany({
      where: { serviceId, userId: tenant.userId },
      orderBy: [{ periodIndex: 'desc' }],
      take: 60,
    });

    return ciclos.map((c) =>
      this.aRespuesta(c, { name: servicio.name, providerName: servicio.providerName }, hoy),
    );
  }

  private aRespuesta(
    ciclo: BillingCycle,
    servicio: { name: string; providerName: string | null },
    hoy: CivilDate,
  ): CicloRespuesta {
    const vence = ciclo.dueDate ? CivilDate.desdePrisma(ciclo.dueDate) : null;
    const dias = vence ? hoy.diasHasta(vence) : null;

    return {
      id: ciclo.id,
      serviceId: ciclo.serviceId,
      serviceName: servicio.name,
      providerName: servicio.providerName,
      periodKey: ciclo.periodKey,
      periodStart: CivilDate.desdePrisma(ciclo.periodStart).toString(),
      periodEnd: CivilDate.desdePrisma(ciclo.periodEnd).toString(),
      dueDate: vence?.toString() ?? null,
      lifecycle: ciclo.lifecycle,
      // El dinero viaja como texto: un number perdería precisión.
      expectedAmount: ciclo.expectedAmount?.toFixed(2) ?? null,
      expectedAmountSource: ciclo.expectedAmountSource,
      currency: ciclo.currency,
      daysUntilDue: dias,
      // "Vencido" se calcula al consultar, nunca se guarda: si fuera una
      // columna dependería de que una tarea programada la actualice a
      // medianoche, y si esa tarea falla el tablero miente.
      isOverdue: dias !== null && dias < 0 && ciclo.lifecycle !== 'CLOSED',
    };
  }
}
