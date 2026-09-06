import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthProvider, type User } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';

import { AppException } from '@/common/http/app-exception';
import type { Env } from '@/infra/config/env.schema';
import { PrismaService } from '@/infra/prisma/prisma.service';

import type {
  LoginInput,
  RegisterInput,
  SessionResponse,
  UpdateMeInput,
  UserResponse,
} from '../contracts/auth.schemas';
import type { TenantContext } from '../tenant-context';
import { TokenService } from './token.service';

/**
 * Hash de referencia con la misma configuración que los reales.
 * Se verifica contra este cuando el email no existe, para que un login fallido
 * tarde lo mismo exista o no la cuenta. Sin esto, la diferencia de tiempo
 * permite averiguar qué emails están registrados.
 */
const HASH_SENUELO =
  '$argon2id$v=19$m=19456,t=2,p=1$c2VudWVsb3NlbnVlbG9zZW51ZWxv$Zm9vYmFyYmF6cXV4Zm9vYmFyYmF6cXV4Zm9v';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async registrar(
    input: RegisterInput,
    dispositivo: { userAgent?: string; ipAddress?: string },
  ): Promise<SessionResponse> {
    const existente = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });

    if (existente) {
      throw AppException.conflict(
        'EMAIL_ALREADY_REGISTERED',
        'Ya existe una cuenta con ese email',
        'Si es tuya, iniciá sesión o recuperá tu contraseña.',
      );
    }

    const secretHash = await argonHash(input.password);

    // Usuario e identidad se crean juntos: un usuario sin forma de
    // autenticarse no debe poder existir ni por un instante.
    const usuario = await this.prisma.user.create({
      data: {
        id: uuidv7(),
        email: input.email,
        displayName: input.displayName ?? null,
        timezone: input.timezone ?? this.config.get('DEFAULT_TZ', { infer: true }),
        identities: {
          create: {
            id: uuidv7(),
            provider: AuthProvider.PASSWORD,
            providerUserId: input.email,
            secretHash,
          },
        },
      },
    });

    const par = await this.tokens.emitirParaLogin(usuario.id, usuario.email, dispositivo);
    return { user: this.aRespuesta(usuario), ...par };
  }

  async iniciarSesion(
    input: LoginInput,
    dispositivo: { userAgent?: string; ipAddress?: string },
  ): Promise<SessionResponse> {
    const identidad = await this.prisma.authIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: AuthProvider.PASSWORD,
          providerUserId: input.email,
        },
      },
      include: { user: true },
    });

    // Mismo mensaje y mismo tiempo de respuesta exista o no la cuenta:
    // decir "ese email no está registrado" revela quién tiene cuenta.
    if (!identidad?.secretHash) {
      await argonVerify(HASH_SENUELO, input.password).catch(() => false);
      throw AppException.unauthorized('INVALID_CREDENTIALS', 'Email o contraseña incorrectos');
    }

    const valida = await argonVerify(identidad.secretHash, input.password).catch(() => false);
    if (!valida) {
      throw AppException.unauthorized('INVALID_CREDENTIALS', 'Email o contraseña incorrectos');
    }

    await this.prisma.authIdentity.update({
      where: { id: identidad.id },
      data: { lastUsedAt: new Date() },
    });

    const par = await this.tokens.emitirParaLogin(
      identidad.user.id,
      identidad.user.email,
      dispositivo,
    );
    return { user: this.aRespuesta(identidad.user), ...par };
  }

  async obtenerPerfil(tenant: TenantContext): Promise<UserResponse> {
    const usuario = await this.prisma.user.findUnique({ where: { id: tenant.userId } });

    if (!usuario) {
      throw AppException.notFound('USER_NOT_FOUND', 'No encontramos tu cuenta');
    }

    return this.aRespuesta(usuario);
  }

  async actualizarPerfil(tenant: TenantContext, input: UpdateMeInput): Promise<UserResponse> {
    const usuario = await this.prisma.user.update({
      where: { id: tenant.userId },
      data: {
        ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        ...(input.defaultCurrency !== undefined
          ? { defaultCurrency: input.defaultCurrency }
          : {}),
      },
    });

    return this.aRespuesta(usuario);
  }

  private aRespuesta(usuario: User): UserResponse {
    return {
      id: usuario.id,
      email: usuario.email,
      displayName: usuario.displayName,
      timezone: usuario.timezone,
      locale: usuario.locale,
      defaultCurrency: usuario.defaultCurrency,
      createdAt: usuario.createdAt.toISOString(),
    };
  }
}
