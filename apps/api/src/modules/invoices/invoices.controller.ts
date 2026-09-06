import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';

import { ZodValidationPipe } from '@/common/zod/zod-validation.pipe';
import { UsuarioActual } from '@/modules/auth/decorators/current-user.decorator';
import type { TenantContext } from '@/modules/auth/tenant-context';

import { InvoicesService, type FacturaRespuesta } from './application/invoices.service';
import {
  anularFacturaSchema,
  registrarFacturaSchema,
  type AnularFacturaInput,
  type RegistrarFacturaInput,
} from './contracts/invoice.schemas';

@Controller({ version: '1' })
export class InvoicesController {
  constructor(private readonly facturas: InvoicesService) {}

  /** Registra la factura que llegó y la compara contra lo proyectado. */
  @Post('invoices')
  @HttpCode(HttpStatus.CREATED)
  registrar(
    @UsuarioActual() tenant: TenantContext,
    @Body(new ZodValidationPipe(registrarFacturaSchema)) body: RegistrarFacturaInput,
  ): Promise<FacturaRespuesta> {
    return this.facturas.registrar(tenant, body);
  }

  /** Anula: nunca borra. Una factura es un hecho ocurrido. */
  @Post('invoices/:id/void')
  @HttpCode(HttpStatus.NO_CONTENT)
  anular(
    @UsuarioActual() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(anularFacturaSchema)) body: AnularFacturaInput,
  ): Promise<void> {
    return this.facturas.anular(tenant, id, body.reason);
  }

  @Get('services/:id/invoices')
  delServicio(
    @UsuarioActual() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FacturaRespuesta[]> {
    return this.facturas.delServicio(tenant, id);
  }
}
