import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';

import { AppException } from '@/common/http/app-exception';
import { CivilDate } from '@/domain/time/civil-date';
import { PrismaService } from '@/infra/prisma/prisma.service';
import { UsuarioActual } from '@/modules/auth/decorators/current-user.decorator';
import type { TenantContext } from '@/modules/auth/tenant-context';

@Controller({ path: 'alerts', version: '1' })
export class AlertsController {
  constructor(private readonly prisma: PrismaService) {}

  /** Cambios detectados, los más graves y recientes primero. */
  @Get()
  async listar(@UsuarioActual() tenant: TenantContext) {
    const alertas = await this.prisma.alert.findMany({
      where: { userId: tenant.userId, status: { not: 'DISMISSED' } },
      orderBy: [{ severity: 'desc' }, { detectedAt: 'desc' }],
      take: 100,
    });

    return alertas.map((a) => ({
      id: a.id,
      serviceId: a.serviceId,
      cycleId: a.cycleId,
      type: a.type,
      severity: a.severity,
      status: a.status,
      title: a.title,
      message: a.message,
      // La evidencia numérica viaja como texto, igual que todo el dinero.
      baselineValue: a.baselineValue?.toFixed(2) ?? null,
      observedValue: a.observedValue?.toFixed(2) ?? null,
      deltaAbsolute: a.deltaAbsolute?.toFixed(2) ?? null,
      deltaPercent: a.deltaPercent?.toFixed(1) ?? null,
      detectedAt: a.detectedAt.toISOString(),
      detectedOn: CivilDate.desdePrisma(a.detectedAt).toString(),
    }));
  }

  /** Marca la alerta como vista. No la borra: el historial de cambios queda. */
  @Post(':id/acknowledge')
  @HttpCode(HttpStatus.NO_CONTENT)
  async marcarVista(
    @UsuarioActual() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    const actualizadas = await this.prisma.alert.updateMany({
      where: { id, userId: tenant.userId },
      data: { status: 'ACKNOWLEDGED', acknowledgedAt: new Date() },
    });

    if (actualizadas.count === 0) {
      throw AppException.notFound('ALERT_NOT_FOUND', 'No encontramos esa alerta');
    }
  }
}
