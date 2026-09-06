import { z } from 'zod';

/**
 * El email se normaliza a minúsculas y sin espacios ANTES de validarlo, para
 * que "Lucas@Mail.com " y "lucas@mail.com" sean la misma cuenta y no se pueda
 * registrar dos veces la misma persona.
 */
const email = z
  .string()
  .trim()
  .toLowerCase()
  .email('Ingresá un email válido')
  .max(320);

/**
 * Mínimo 10 caracteres. Se prioriza la longitud sobre las reglas de
 * composición (mayúsculas, símbolos): son más efectivas contra ataques de
 * fuerza bruta y menos molestas, que es lo que hace que la gente no termine
 * eligiendo "Password1!".
 */
const password = z
  .string()
  .min(10, 'La contraseña debe tener al menos 10 caracteres')
  .max(200, 'La contraseña no puede superar los 200 caracteres');

export const registerSchema = z
  .object({
    email,
    password,
    displayName: z.string().trim().min(1).max(120).optional(),
    timezone: z.string().min(1).max(64).optional(),
  })
  .strict();

export const loginSchema = z
  .object({
    email,
    password: z.string().min(1, 'Ingresá tu contraseña').max(200),
  })
  .strict();

export const refreshSchema = z
  .object({
    refreshToken: z.string().min(1),
  })
  .strict();

export const updateMeSchema = z
  .object({
    displayName: z.string().trim().min(1).max(120).nullable().optional(),
    timezone: z.string().min(1).max(64).optional(),
    defaultCurrency: z.enum(['ARS', 'USD']).optional(),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type UpdateMeInput = z.infer<typeof updateMeSchema>;

export interface UserResponse {
  id: string;
  email: string;
  displayName: string | null;
  timezone: string;
  locale: string;
  defaultCurrency: string;
  createdAt: string;
}

export interface SessionResponse {
  user: UserResponse;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
