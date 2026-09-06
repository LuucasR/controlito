import type { CivilDate } from '../time/civil-date';

/**
 * Una condición vigente durante un tramo de tiempo.
 * `validFrom` es inclusivo y `validTo` exclusivo; `null` significa "sigue vigente".
 */
export interface TramoVigencia {
  readonly id: string;
  readonly validFrom: CivilDate;
  readonly validTo: CivilDate | null;
}

/**
 * Devuelve la condición que regía en esa fecha, o null si no había ninguna.
 *
 * Es la operación central del historial de condiciones: permite responder
 * "¿cuánto DEBERÍA haber salido la factura de septiembre?" con las condiciones
 * que estaban pactadas en septiembre, no con las de hoy.
 */
export function vigenteEn<T extends TramoVigencia>(tramos: readonly T[], fecha: CivilDate): T | null {
  return tramos.find((t) => fecha.estaEnRango(t.validFrom, t.validTo)) ?? null;
}

export type ProblemaDeSecuencia =
  | { tipo: 'SOLAPAMIENTO'; primero: string; segundo: string }
  | { tipo: 'RANGO_INVALIDO'; id: string }
  | { tipo: 'INICIO_DUPLICADO'; primero: string; segundo: string };

/**
 * Verifica que los tramos formen una línea de tiempo coherente.
 *
 * La base también lo impide con una restricción de exclusión, pero validarlo
 * acá permite responder con un mensaje entendible en vez de un error de
 * PostgreSQL, y hace que la regla sea testeable sin base.
 */
export function validarSecuencia(tramos: readonly TramoVigencia[]): ProblemaDeSecuencia | null {
  const ordenados = [...tramos].sort((a, b) => (a.validFrom.isBefore(b.validFrom) ? -1 : 1));

  for (const tramo of ordenados) {
    if (tramo.validTo && !tramo.validFrom.isBefore(tramo.validTo)) {
      return { tipo: 'RANGO_INVALIDO', id: tramo.id };
    }
  }

  for (let i = 0; i < ordenados.length - 1; i++) {
    const actual = ordenados[i]!;
    const siguiente = ordenados[i + 1]!;

    if (actual.validFrom.equals(siguiente.validFrom)) {
      return { tipo: 'INICIO_DUPLICADO', primero: actual.id, segundo: siguiente.id };
    }

    // Un tramo abierto seguido de otro tramo se solapa por definición.
    if (actual.validTo === null || actual.validTo.isAfter(siguiente.validFrom)) {
      return { tipo: 'SOLAPAMIENTO', primero: actual.id, segundo: siguiente.id };
    }
  }

  return null;
}

export type PlanDeInsercion =
  | { ok: true; cerrar: { id: string; validTo: CivilDate } | null }
  | { ok: false; motivo: 'ANTERIOR_A_LA_ULTIMA' | 'FECHA_YA_USADA'; conflicto: string };

/**
 * Calcula qué hay que hacer para agregar una condición que empieza en `desde`.
 *
 * NO se sobrescribe la condición anterior: se la CIERRA poniéndole fecha de
 * fin. Así el historial queda completo y siempre se puede reconstruir qué
 * regía en cada período, que es justamente lo que permite detectar si una
 * factura vino distinta de lo pactado.
 */
export function planificarInsercion(
  tramos: readonly TramoVigencia[],
  desde: CivilDate,
): PlanDeInsercion {
  if (tramos.length === 0) return { ok: true, cerrar: null };

  const ordenados = [...tramos].sort((a, b) => (a.validFrom.isBefore(b.validFrom) ? -1 : 1));
  const ultima = ordenados[ordenados.length - 1]!;

  const duplicada = ordenados.find((t) => t.validFrom.equals(desde));
  if (duplicada) return { ok: false, motivo: 'FECHA_YA_USADA', conflicto: duplicada.id };

  // Insertar en el medio del historial obligaría a recalcular ciclos ya
  // facturados. Se rechaza de forma explícita en lugar de hacerlo a medias.
  if (desde.isBefore(ultima.validFrom)) {
    return { ok: false, motivo: 'ANTERIOR_A_LA_ULTIMA', conflicto: ultima.id };
  }

  // Si la última está abierta, se cierra justo cuando empieza la nueva: sin
  // huecos y sin superposición.
  return { ok: true, cerrar: ultima.validTo === null ? { id: ultima.id, validTo: desde } : null };
}
