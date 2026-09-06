import 'reflect-metadata';

import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import express from 'express';
import helmet from 'helmet';
import { Logger as PinoLogger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { ProblemDetailsFilter } from './common/http/problem-details.filter';
import type { Env } from './infra/config/env.schema';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService<Env, true>);

  app.useLogger(app.get(PinoLogger));

  // Render corre detrás de un proxy: sin esto, todo el tráfico parece venir de
  // una sola IP y el rate limiting bloquearía a todos los usuarios por igual.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(compression());
  // Los binarios (comprobantes) nunca pasan por la API: 256kb alcanza y sobra.
  app.use(express.json({ limit: '256kb' }));

  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }).split(',').map((o) => o.trim()),
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Client-Platform',
      'X-App-Version',
      'Idempotency-Key',
      'X-Request-Id',
    ],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 86400,
  });

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalFilters(new ProblemDetailsFilter());
  app.enableShutdownHooks();

  const port = config.get('PORT', { infer: true });
  await app.listen(port, '0.0.0.0');

  app.get(PinoLogger).log(`Controlito API escuchando en http://localhost:${port}/api/v1`);
}

void bootstrap();
