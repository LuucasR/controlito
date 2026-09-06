import { z } from 'zod';

/**
 * Contrato de variables de entorno.
 * La app NO arranca si falta o es inválida alguna variable requerida:
 * es preferible fallar en el deploy que a las 3 AM con un `undefined`.
 */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

    /** Conexión con pooler (pgbouncer). Requerida en producción. */
    DATABASE_URL: z.string().min(1).optional(),
    /** Conexión directa, sin pooler: la usan las migraciones de Prisma. */
    DIRECT_URL: z.string().min(1).optional(),

    /** Orígenes permitidos por CORS, separados por coma. Nunca '*' con credentials. */
    CORS_ORIGINS: z.string().default('http://localhost:5555'),

    /** Zona horaria por defecto de un usuario nuevo (IANA). */
    DEFAULT_TZ: z.string().default('America/Argentina/Buenos_Aires'),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && !env.DATABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DATABASE_URL'],
        message: 'DATABASE_URL es obligatoria en producción',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);

  if (!parsed.success) {
    const detalle = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(raíz)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Configuración de entorno inválida:\n${detalle}`);
  }

  return parsed.data;
}
