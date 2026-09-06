import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

import { ConfigModule } from '@/infra/config/config.module';
import { PrismaModule } from '@/infra/prisma/prisma.module';
import { HealthModule } from '@/modules/health/health.module';

@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
        // El health check ensucia los logs: se registra solo si falla.
        autoLogging: { ignore: (req) => (req.url ?? '').startsWith('/api/v1/health') },
        redact: ['req.headers.authorization', 'req.headers.cookie'],
      },
    }),
    PrismaModule,
    HealthModule,
  ],
})
export class AppModule {}
