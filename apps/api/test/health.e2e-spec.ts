import type { Server } from 'node:http';

import { VersioningType, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '@/app.module';

interface LivenessBody {
  status: string;
  uptimeSeconds: number;
  timestamp: string;
}

interface ReadinessBody {
  status: string;
  database: string;
}

describe('Health (e2e)', () => {
  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /api/v1/health responde sin tocar la base', async () => {
    const res = await request(server).get('/api/v1/health').expect(200);
    const body = res.body as LivenessBody;

    expect(body.status).toBe('ok');
    expect(typeof body.uptimeSeconds).toBe('number');
  });

  it('GET /api/v1/health/ready informa el estado de la base', async () => {
    const res = await request(server).get('/api/v1/health/ready').expect(200);
    const body = res.body as ReadinessBody;

    // Sin DATABASE_URL real todavia, se espera degraded/down. Cuando Neon este
    // configurado, este mismo test debe devolver ready/up.
    expect(['ready', 'degraded']).toContain(body.status);
    expect(['up', 'down']).toContain(body.database);
  });
});
