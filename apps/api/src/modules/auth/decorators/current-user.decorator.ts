import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { TenantContext } from '../tenant-context';

/**
 * Inyecta el `TenantContext` que dejó el guard de autenticación.
 * Si el guard no corrió, esto sería `undefined`, y por eso lanza: es preferible
 * un error ruidoso a una consulta que se ejecuta sin filtro de usuario.
 */
export const UsuarioActual = createParamDecorator(
  (_dato: unknown, ctx: ExecutionContext): TenantContext => {
    const request = ctx.switchToHttp().getRequest<{ tenant?: TenantContext }>();

    if (!request.tenant) {
      throw new Error(
        'No hay TenantContext en el request: la ruta no pasó por el guard de autenticación.',
      );
    }

    return request.tenant;
  },
);
