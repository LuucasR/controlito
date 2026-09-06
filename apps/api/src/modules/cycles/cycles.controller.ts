import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { z } from 'zod';

import { ZodValidationPipe } from '@/common/zod/zod-validation.pipe';
import { UsuarioActual } from '@/modules/auth/decorators/current-user.decorator';
import type { TenantContext } from '@/modules/auth/tenant-context';

import { CyclesService, type CicloRespuesta } from './application/cycles.service';

const proximosSchema = z
  .object({ dias: z.coerce.number().int().min(1).max(365).default(45) })
  .strict();

@Controller({ version: '1' })
export class CyclesController {
  constructor(private readonly ciclos: CyclesService) {}

  /** Próximos vencimientos de todos los servicios. Alimenta el inicio. */
  @Get('cycles/upcoming')
  proximos(
    @UsuarioActual() tenant: TenantContext,
    @Query(new ZodValidationPipe(proximosSchema)) query: { dias: number },
  ): Promise<CicloRespuesta[]> {
    return this.ciclos.proximos(tenant, query.dias);
  }

  /** Períodos de un servicio, del más nuevo al más viejo. */
  @Get('services/:id/cycles')
  delServicio(
    @UsuarioActual() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CicloRespuesta[]> {
    return this.ciclos.delServicio(tenant, id);
  }
}
