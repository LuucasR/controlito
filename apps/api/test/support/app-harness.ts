import type { Server } from 'node:http';

import { VersioningType, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '@/app.module';
import { ProblemDetailsFilter } from '@/common/http/problem-details.filter';
import { PrismaService } from '@/infra/prisma/prisma.service';

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

  /** Borra todo lo creado por la corrida: la base se comparte con desarrollo. */
  async limpiar(): Promise<void> {
    if (this.creados.length > 0) {
      await this.prisma.user.deleteMany({ where: { id: { in: this.creados } } });
    }
    await this.app.close();
  }
}
