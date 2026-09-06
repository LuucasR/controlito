import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private connected = false;

  get isConnected(): boolean {
    return this.connected;
  }

  async onModuleInit(): Promise<void> {
    // En la Etapa 0 la base puede no estar configurada todavía: la app tiene que
    // arrancar igual y `/health/ready` es quien reporta que la DB no responde.
    try {
      await this.$connect();
      this.connected = true;
      this.logger.log('Conectado a PostgreSQL');
    } catch (error) {
      this.connected = false;
      this.logger.warn(
        `No se pudo conectar a PostgreSQL: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** Ping de readiness. No lanza: devuelve si la base responde. */
  async ping(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      this.connected = true;
      return true;
    } catch {
      this.connected = false;
      return false;
    }
  }
}
