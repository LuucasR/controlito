import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { ZodValidationPipe } from '@/common/zod/zod-validation.pipe';
import { UsuarioActual } from '@/modules/auth/decorators/current-user.decorator';
import type { TenantContext } from '@/modules/auth/tenant-context';

import { ServicesService } from './application/services.service';
import {
  actualizarServicioSchema,
  crearCondicionSchema,
  crearServicioSchema,
  listarServiciosSchema,
  type ActualizarServicioInput,
  type CrearCondicionInput,
  type CrearServicioInput,
  type ListarServiciosInput,
} from './contracts/service.schemas';

@Controller({ path: 'services', version: '1' })
export class ServicesController {
  constructor(private readonly servicios: ServicesService) {}

  @Get()
  listar(
    @UsuarioActual() tenant: TenantContext,
    @Query(new ZodValidationPipe(listarServiciosSchema)) filtros: ListarServiciosInput,
  ) {
    return this.servicios.listar(tenant, filtros);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  crear(
    @UsuarioActual() tenant: TenantContext,
    @Body(new ZodValidationPipe(crearServicioSchema)) body: CrearServicioInput,
  ) {
    return this.servicios.crear(tenant, body);
  }

  @Get(':id')
  obtener(
    @UsuarioActual() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.servicios.obtener(tenant, id);
  }

  @Patch(':id')
  actualizar(
    @UsuarioActual() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(actualizarServicioSchema)) body: ActualizarServicioInput,
  ) {
    return this.servicios.actualizar(tenant, id, body);
  }

  /** Archiva: nunca borra. El historial financiero no se falsea. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  archivar(@UsuarioActual() tenant: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.servicios.archivar(tenant, id);
  }

  /**
   * Agrega una condicion nueva. No reemplaza la anterior: la cierra, de modo
   * que el historial completo queda disponible.
   */
  @Post(':id/conditions')
  @HttpCode(HttpStatus.CREATED)
  agregarCondicion(
    @UsuarioActual() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(crearCondicionSchema)) body: CrearCondicionInput,
  ) {
    return this.servicios.agregarCondicion(tenant, id, body);
  }
}
