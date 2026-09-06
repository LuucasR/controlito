import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

import { AppException } from '@/common/http/app-exception';
import type { Env } from '@/infra/config/env.schema';

import { CLAVE_RUTA_PUBLICA } from '../decorators/public.decorator';
import { crearTenantContext, type TenantContext } from '../tenant-context';

export interface AccessTokenPayload {
  sub: string;
  email: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const esPublica = this.reflector.getAllAndOverride<boolean>(CLAVE_RUTA_PUBLICA, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (esPublica) return true;

    const request = context.switchToHttp().getRequest<Request & { tenant?: TenantContext }>();
    const token = this.extraerToken(request);

    if (!token) {
      throw AppException.unauthorized('MISSING_TOKEN', 'Iniciá sesión para continuar');
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      });
    } catch {
      // No se distingue "expirado" de "inválido" en el mensaje, pero sí en el
      // code: el cliente necesita saber cuándo intentar un refresh.
      throw AppException.unauthorized('INVALID_TOKEN', 'Tu sesión expiró, volvé a iniciar sesión');
    }

    request.tenant = crearTenantContext(payload.sub);
    return true;
  }

  private extraerToken(request: Request): string | null {
    const cabecera = request.headers.authorization;
    if (!cabecera) return null;

    const [esquema, valor] = cabecera.split(' ');
    return esquema?.toLowerCase() === 'bearer' && valor ? valor : null;
  }
}
