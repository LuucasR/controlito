import type { Server } from 'node:http';

import { VersioningType, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '@/app.module';
import { ProblemDetailsFilter } from '@/common/http/problem-details.filter';
import { PrismaService } from '@/infra/prisma/prisma.service';

/**
 * Base contra la que corren los tests que necesitan datos reales.
 *
 * Es una variable APARTE de DATABASE_URL a proposito. Los tests crean y borran
 * usuarios, asi que apuntarlos por accidente a la base de produccion seria
 * destructivo. Como produccion nunca define E2E_DATABASE_URL, no hay forma de
 * que eso ocurra por descuido: si no esta definida, las suites se saltean.
 */
export const baseDeTests = process.env.E2E_DATABASE_URL;

/** Las suites que tocan la base se saltean si no hay una configurada. */
export const requiereBase = baseDeTests === undefined || baseDeTests === '';

export interface Sesion {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
}

export class Harness {
  private constructor(
    readonly app: INestApplication,
    readonly server: Server,
    readonly prisma: PrismaService,
    private readonly creados: string[],
  ) {}

  static async iniciar(): Promise<Harness> {
    if (baseDeTests) {
      // Se define ANTES de construir la app: Prisma lee la variable al crear
      // el cliente, y @nestjs/config no pisa lo que ya esta en el entorno.
      process.env.DATABASE_URL = baseDeTests;
      process.env.DIRECT_URL = process.env.E2E_DIRECT_URL ?? baseDeTests;
    }

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();

    return new Harness(app, app.getHttpServer() as Server, app.get(PrismaService), []);
  }

  /** Crea un usuario nuevo con email unico y devuelve su sesion. */
  async registrarUsuario(prefijo = 'test'): Promise<Sesion> {
    const email = `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@controlito.test`;
    const res = await request(this.server)
      .post('/api/v1/auth/register')
      .send({ email, password: 'contrasena-de-prueba-123' })
      .expect(201);

    const body = res.body as {
      user: { id: string; email: string };
      accessToken: string;
      refreshToken: string;
    };

    this.creados.push(body.user.id);

    return {
      userId: body.user.id,
      email: body.user.email,
      accessToken: body.accessToken,
      refreshToken: body.refreshToken,
    };
  }

  /** Borra lo que creo la corrida. El borrado en cascada limpia sus tokens. */
  async limpiar(): Promise<void> {
    if (this.creados.length > 0) {
      await this.prisma.user.deleteMany({ where: { id: { in: this.creados } } });
    }
    await this.app.close();
  }
}
