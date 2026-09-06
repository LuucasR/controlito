import { randomBytes, createHash } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { v7 as uuidv7 } from 'uuid';

import { AppException } from '@/common/http/app-exception';
import type { Env } from '@/infra/config/env.schema';
import { PrismaService } from '@/infra/prisma/prisma.service';

export interface ParDeTokens {
  accessToken: string;
  refreshToken: string;
  /** Vida del access token en segundos, para que el cliente sepa cuándo renovar. */
  expiresIn: number;
}

interface DatosDispositivo {
  userAgent?: string;
  ipAddress?: string;
  deviceLabel?: string;
}

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Emite un par nuevo iniciando una FAMILIA de tokens.
   * Una familia = un login. Todas las rotaciones posteriores la comparten, y
   * ante un robo se revoca la familia entera de una sola vez.
   */
  async emitirParaLogin(
    userId: string,
    email: string,
    dispositivo: DatosDispositivo = {},
  ): Promise<ParDeTokens> {
    const emitido = await this.emitir(userId, email, uuidv7(), dispositivo);
    return {
      accessToken: emitido.accessToken,
      refreshToken: emitido.refreshToken,
      expiresIn: emitido.expiresIn,
    };
  }

  /**
   * Rota un refresh token.
   *
   * Reglas, en este orden:
   *  1. Si el token no existe -> inválido.
   *  2. Si ya fue consumido -> ROBO: se revoca toda la familia. Quien lo usó
   *     legítimamente ya recibió su reemplazo; si vuelve a aparecer el viejo,
   *     es que alguien lo copió.
   *  3. Si está revocado o vencido -> inválido.
   *  4. Si todo está bien -> se marca consumido y se emite el reemplazo.
   */
  async rotar(refreshToken: string, dispositivo: DatosDispositivo = {}): Promise<ParDeTokens> {
    const hash = this.hashear(refreshToken);

    const registro = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hash },
      include: { user: { select: { id: true, email: true } } },
    });

    if (!registro) {
      throw AppException.unauthorized('INVALID_REFRESH_TOKEN', 'Volvé a iniciar sesión');
    }

    if (registro.consumedAt) {
      await this.revocarFamilia(registro.familyId, 'REUSO_DETECTADO');
      this.logger.warn(
        `Reuso de refresh token detectado (familia ${registro.familyId}, usuario ${registro.userId}). Familia revocada.`,
      );
      throw AppException.unauthorized(
        'REFRESH_TOKEN_REUSED',
        'Detectamos un uso sospechoso de tu sesión. Por seguridad, volvé a iniciar sesión.',
      );
    }

    if (registro.revokedAt || registro.expiresAt.getTime() <= Date.now()) {
      throw AppException.unauthorized('INVALID_REFRESH_TOKEN', 'Volvé a iniciar sesión');
    }

    const { refreshTokenId, ...nuevos } = await this.emitir(
      registro.userId,
      registro.user.email,
      registro.familyId,
      dispositivo,
    );

    await this.prisma.refreshToken.update({
      where: { id: registro.id },
      data: { consumedAt: new Date(), replacedById: refreshTokenId },
    });

    return nuevos;
  }

  /** Cierra una sesión concreta. No es un error cerrar una sesión ya cerrada. */
  async revocar(refreshToken: string): Promise<void> {
    const hash = this.hashear(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hash, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: 'LOGOUT' },
    });
  }

  /** Cierra todas las sesiones del usuario (cambio de contraseña, robo, etc.). */
  async revocarTodasDelUsuario(userId: string, motivo: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: motivo },
    });
  }

  /**
   * Devuelve tambien el id de la fila creada. Es a proposito: si lo guardara
   * en una propiedad de la clase, dos refresh simultaneos del mismo servicio
   * se pisarian entre si (el servicio es un singleton).
   */
  private async emitir(
    userId: string,
    email: string,
    familyId: string,
    dispositivo: DatosDispositivo,
  ): Promise<ParDeTokens & { refreshTokenId: string }> {
    const ttlSegundos = this.config.get('JWT_ACCESS_TTL_SECONDS', { infer: true });

    const accessToken = await this.jwt.signAsync(
      { sub: userId, email },
      {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
        expiresIn: ttlSegundos,
      },
    );

    // Token opaco de 32 bytes: no lleva información, solo sirve para buscarlo.
    // De la base nunca se puede recuperar el valor original, solo su hash.
    const refreshToken = randomBytes(32).toString('hex');
    const dias = this.config.get('REFRESH_TTL_DAYS', { infer: true });
    const id = uuidv7();

    await this.prisma.refreshToken.create({
      data: {
        id,
        userId,
        familyId,
        tokenHash: this.hashear(refreshToken),
        expiresAt: new Date(Date.now() + dias * 24 * 60 * 60 * 1000),
        userAgent: dispositivo.userAgent?.slice(0, 300),
        ipAddress: dispositivo.ipAddress?.slice(0, 60),
        deviceLabel: dispositivo.deviceLabel?.slice(0, 100),
      },
    });

    return { accessToken, refreshToken, expiresIn: ttlSegundos, refreshTokenId: id };
  }

  private async revocarFamilia(familyId: string, motivo: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: motivo },
    });
  }

  /** SHA-256: en la base nunca vive el token, solo su huella. */
  private hashear(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

}
