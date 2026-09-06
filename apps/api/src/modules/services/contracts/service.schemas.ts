import { z } from 'zod';

/**
 * Fecha civil en el formato de transporte: exactamente "YYYY-MM-DD".
 *
 * No se acepta ISO con hora a propósito. Un vencimiento no es un instante, y
 * admitir "2026-09-10T00:00:00Z" invitaría a que el cliente mande su hora
 * local y el día se corra al convertir.
 */
const fechaCivil = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener el formato YYYY-MM-DD');

/**
 * Dinero como texto decimal, nunca como número.
 * Un `number` de JavaScript pierde precisión y haría que $0.1 + $0.2 no dé
 * $0.3. Se valida la forma acá y se convierte a Decimal en el dominio.
 */
const dinero = z
  .string()
  .regex(/^\d{1,15}(\.\d{1,4})?$/, 'El monto debe ser un número con hasta 4 decimales');

const porcentaje = z
  .string()
  .regex(/^\d{1,3}(\.\d{1,4})?$/, 'El porcentaje debe ser un número');

export const estadoServicio = z.enum(['ACTIVE', 'PAUSED', 'CANCELLED']);
export const frecuencia = z.enum([
  'WEEKLY',
  'BIWEEKLY',
  'MONTHLY',
  'BIMONTHLY',
  'QUARTERLY',
  'SEMIANNUAL',
  'ANNUAL',
  'ON_DEMAND',
]);
export const modoMonto = z.enum(['FIXED', 'VARIABLE_ESTIMATED', 'VARIABLE_UNKNOWN']);
export const politicaDiaVencimiento = z.enum([
  'CLAMP_TO_LAST_DAY',
  'ROLL_FORWARD',
  'FROM_INVOICE_ONLY',
]);
export const politicaDeuda = z.enum([
  'ACCUMULATES_INTO_NEXT_INVOICE',
  'PAID_SEPARATELY',
  'NO_DEBT_SERVICE_CUT',
  'UNKNOWN',
]);
export const modeloInteres = z.enum([
  'NONE',
  'MONTHLY_PERCENT',
  'DAILY_PERCENT',
  'FIXED_FEE',
  'UNKNOWN',
]);

/** Condición inicial, que se carga junto con el servicio. */
const condicionBase = {
  validFrom: fechaCivil,
  amountMode: modoMonto.default('VARIABLE_ESTIMATED'),
  baseAmount: dinero.nullable().optional(),
  frequency: frecuencia.default('MONTHLY'),
  periodAnchorDate: fechaCivil.optional(),
  dueDayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  dueDayPolicy: politicaDiaVencimiento.default('CLAMP_TO_LAST_DAY'),
  secondDueDayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  secondDueSurcharge: porcentaje.nullable().optional(),
  interestModel: modeloInteres.default('UNKNOWN'),
  interestParams: z.record(z.string(), z.unknown()).nullable().optional(),
  changeReason: z.string().trim().max(200).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
};

type CondicionCruda = {
  amountMode: string;
  baseAmount?: string | null;
  frequency: string;
  dueDayOfMonth?: number | null;
  dueDayPolicy: string;
};

/**
 * Reglas que dependen de mas de un campo.
 *
 * Se definen una sola vez y se aplican tanto al endpoint de condiciones como a
 * la condicion que viene anidada al crear un servicio. Si vivieran solo en uno,
 * los mismos datos se validarian distinto segun la ruta, que es exactamente el
 * bug que este codigo tuvo antes de existir esta funcion.
 */
const validarReglasCruzadas = (c: CondicionCruda, ctx: z.RefinementCtx): void => {
  // Si el monto es fijo, hace falta saber cuanto. Sin eso, la app no podria
  // decir cuanto deberia venir la proxima factura, que es su razon de ser.
  if (c.amountMode === 'FIXED' && !c.baseAmount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['baseAmount'],
      message: 'Un monto fijo necesita que indiques cuánto es',
    });
  }
  if (c.frequency !== 'ON_DEMAND' && !c.dueDayOfMonth && c.dueDayPolicy !== 'FROM_INVOICE_ONLY') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['dueDayOfMonth'],
      message: 'Indicá el día de vencimiento, o elegí que lo traiga cada factura',
    });
  }
};

export const crearCondicionSchema = z
  .object(condicionBase)
  .strict()
  .superRefine(validarReglasCruzadas);

export const crearServicioSchema = z
  .object({
    name: z.string().trim().min(1, 'Poné un nombre').max(120),
    providerName: z.string().trim().max(120).nullable().optional(),
    accountNumber: z.string().trim().max(60).nullable().optional(),
    categoryId: z.string().uuid().nullable().optional(),
    currency: z.enum(['ARS', 'USD']).default('ARS'),
    startDate: fechaCivil,
    debtPolicy: politicaDeuda.default('UNKNOWN'),
    autoDebit: z.boolean().default(false),
    notes: z.string().trim().max(1000).nullable().optional(),
    /** Condición inicial. Un servicio sin condiciones no sirve para proyectar. */
    condition: z.object(condicionBase).strict().superRefine(validarReglasCruzadas).optional(),
  })
  .strict();

export const actualizarServicioSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    providerName: z.string().trim().max(120).nullable().optional(),
    accountNumber: z.string().trim().max(60).nullable().optional(),
    categoryId: z.string().uuid().nullable().optional(),
    status: estadoServicio.optional(),
    endDate: fechaCivil.nullable().optional(),
    debtPolicy: politicaDeuda.optional(),
    autoDebit: z.boolean().optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
  })
  .strict();

export const listarServiciosSchema = z
  .object({
    status: estadoServicio.optional(),
    categoryId: z.string().uuid().optional(),
    incluirArchivados: z.coerce.boolean().default(false),
  })
  .strict();

export type CrearServicioInput = z.infer<typeof crearServicioSchema>;
export type ActualizarServicioInput = z.infer<typeof actualizarServicioSchema>;
export type CrearCondicionInput = z.infer<typeof crearCondicionSchema>;
export type ListarServiciosInput = z.infer<typeof listarServiciosSchema>;
