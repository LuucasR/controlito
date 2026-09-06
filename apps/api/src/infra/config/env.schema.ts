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

    /**
     * Secreto de firma del access token. En desarrollo hay un valor por
     * defecto para que la app arranque sin configurar nada; en producción es
     * obligatorio y debe tener al menos 32 caracteres.
     */
    JWT_ACCESS_SECRET: z.string().min(1).default('desarrollo-inseguro-cambiar-en-produccion'),

    /**
     * Vida del access token EN SEGUNDOS. Corta a propósito: se renueva con el
     * refresh. Se usa un número y no un texto tipo '15m' para no tener que
     * parsearlo a mano en ningún lado.
     */
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),

    /** Vida del refresh token, en días. */
    REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;

    if (!env.DATABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DATABASE_URL'],
        message: 'DATABASE_URL es obligatoria en producción',
      });
    }

    // Un secreto por defecto en producción significa que cualquiera que lea el
    // repositorio puede firmar tokens válidos.
    if (env.JWT_ACCESS_SECRET.startsWith('desarrollo-inseguro')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_ACCESS_SECRET'],
        message: 'JWT_ACCESS_SECRET no puede quedar con el valor de desarrollo en producción',
      });
    }

    if (env.JWT_ACCESS_SECRET.length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_ACCESS_SECRET'],
        message: 'JWT_ACCESS_SECRET debe tener al menos 32 caracteres en producción',
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
