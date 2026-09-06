import { Injectable, type PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';

import { AppException } from '../http/app-exception';

/**
 * Valida el cuerpo (o los parámetros) contra un schema de zod y devuelve el
 * valor ya tipado. Los schemas usan `.strict()`, así que un campo desconocido
 * es un error: detecta temprano que el cliente y el servidor se desalinearon.
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const resultado = this.schema.safeParse(value);

    if (!resultado.success) {
      throw AppException.validation(
        resultado.error.issues.map((i) => ({
          path: i.path.join('.'),
          code: i.code.toUpperCase(),
          message: i.message,
        })),
      );
    }

    return resultado.data;
  }
}
