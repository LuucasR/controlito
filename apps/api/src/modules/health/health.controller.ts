import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';

import { PrismaService } from '@/infra/prisma/prisma.service';
import { Publico } from '@/modules/auth/decorators/public.decorator';

// El guard de autenticacion es global: sin esto, Render no podria consultar
// el health check y marcaria el servicio como caido.
@Publico()
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liveness: responde sin tocar la base.
   * Es el endpoint que usa Render para saber si el proceso está vivo.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  live(): { status: 'ok'; uptimeSeconds: number; timestamp: string } {
    return {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  /** Readiness: verifica que PostgreSQL responda. */
  @Get('ready')
  async ready(): Promise<{ status: 'ready' | 'degraded'; database: 'up' | 'down' }> {
    const database = (await this.prisma.ping()) ? 'up' : 'down';
    return { status: database === 'up' ? 'ready' : 'degraded', database };
  }
}
