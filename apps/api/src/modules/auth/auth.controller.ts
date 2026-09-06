import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';

import { ZodValidationPipe } from '@/common/zod/zod-validation.pipe';

import { AuthService } from './application/auth.service';
import { TokenService } from './application/token.service';
import {
  loginSchema,
  refreshSchema,
  registerSchema,
  updateMeSchema,
  type LoginInput,
  type RefreshInput,
  type RegisterInput,
  type SessionResponse,
  type UpdateMeInput,
  type UserResponse,
} from './contracts/auth.schemas';
import { UsuarioActual } from './decorators/current-user.decorator';
import { Publico } from './decorators/public.decorator';
import type { TenantContext } from './tenant-context';

@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
  ) {}

  @Publico()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
    @Req() req: Request,
  ): Promise<SessionResponse> {
    return this.auth.registrar(body, this.datosDispositivo(req));
  }

  @Publico()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Req() req: Request,
  ): Promise<SessionResponse> {
    return this.auth.iniciarSesion(body, this.datosDispositivo(req));
  }

  @Publico()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(
    @Body(new ZodValidationPipe(refreshSchema)) body: RefreshInput,
    @Req() req: Request,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    return this.tokens.rotar(body.refreshToken, this.datosDispositivo(req));
  }

  /**
   * Cierra la sesión de ESTE dispositivo. Es público porque el access token
   * puede haber expirado justo cuando el usuario cierra sesión, y en ese caso
   * igual queremos invalidar el refresh.
   */
  @Publico()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Body(new ZodValidationPipe(refreshSchema)) body: RefreshInput,
  ): Promise<void> {
    await this.tokens.revocar(body.refreshToken);
  }

  @Get('me')
  me(@UsuarioActual() tenant: TenantContext): Promise<UserResponse> {
    return this.auth.obtenerPerfil(tenant);
  }

  @Patch('me')
  actualizarMe(
    @UsuarioActual() tenant: TenantContext,
    @Body(new ZodValidationPipe(updateMeSchema)) body: UpdateMeInput,
  ): Promise<UserResponse> {
    return this.auth.actualizarPerfil(tenant, body);
  }

  private datosDispositivo(req: Request): { userAgent?: string; ipAddress?: string } {
    return {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    };
  }
}
