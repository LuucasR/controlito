import { z } from 'zod';

const fechaCivil = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener el formato YYYY-MM-DD');

/** Dinero como texto: un número de JavaScript perdería precisión. */
const dinero = z
  .string()
  .regex(/^\d{1,15}(\.\d{1,4})?$/, 'El monto debe ser un número con hasta 4 decimales');

export const registrarFacturaSchema = z
  .object({
    cycleId: z.string().uuid(),
    issueDate: fechaCivil,
    dueDate: fechaCivil,
    secondDueDate: fechaCivil.nullable().optional(),
    externalNumber: z.string().trim().max(60).nullable().optional(),

    /**
     * Consumo o abono del período. Es el único monto que se compara contra lo
     * esperado: incluir el arrastre haría que cada deuda pareciera un aumento.
     */
    currentChargeAmount: dinero,
    /** Saldo de períodos anteriores que la factura ya trae incluido. */
    includedPriorDebtAmount: dinero.default('0'),
    /** Punitorios sobre ese saldo. */
    priorDebtInterestAmount: dinero.default('0'),
    otherChargesAmount: dinero.default('0'),

    isEstimatedByProvider: z.boolean().default(false),
    notes: z.string().trim().max(1000).nullable().optional(),
  })
  .strict()
  .superRefine((f, ctx) => {
    if (f.dueDate < f.issueDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dueDate'],
        message: 'El vencimiento no puede ser anterior a la emisión',
      });
    }
    if (f.secondDueDate && f.secondDueDate < f.dueDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['secondDueDate'],
        message: 'El segundo vencimiento no puede ser anterior al primero',
      });
    }
  });

export const anularFacturaSchema = z
  .object({ reason: z.string().trim().min(1, 'Contá por qué la anulás').max(300) })
  .strict();

export type RegistrarFacturaInput = z.infer<typeof registrarFacturaSchema>;
export type AnularFacturaInput = z.infer<typeof anularFacturaSchema>;
