import { CivilDate, diasDelMes } from '../time/civil-date';

export type Frecuencia =
  | 'WEEKLY'
  | 'BIWEEKLY'
  | 'MONTHLY'
  | 'BIMONTHLY'
  | 'QUARTERLY'
  | 'SEMIANNUAL'
  | 'ANNUAL'
  | 'ON_DEMAND';

export type PoliticaDiaVencimiento = 'CLAMP_TO_LAST_DAY' | 'ROLL_FORWARD' | 'FROM_INVOICE_ONLY';

/** Meses que cubre cada período. Las frecuencias en días van aparte. */
const MESES_POR_PERIODO: Partial<Record<Frecuencia, number>> = {
  MONTHLY: 1,
  BIMONTHLY: 2,
  QUARTERLY: 3,
  SEMIANNUAL: 6,
  ANNUAL: 12,
};

const DIAS_POR_PERIODO: Partial<Record<Frecuencia, number>> = {
  WEEKLY: 7,
  BIWEEKLY: 14,
};

export interface CondicionDePeriodos {
  /** Ancla del calendario: define dónde empieza cada período. */
  readonly periodAnchorDate: CivilDate;
  readonly frequency: Frecuencia;
  readonly dueDayOfMonth: number | null;
  readonly dueDayPolicy: PoliticaDiaVencimiento;
}

export interface Periodo {
  /** Inclusivo. */
  readonly periodStart: CivilDate;
  /** EXCLUSIVO: el período de septiembre termina el 1 de octubre. */
  readonly periodEnd: CivilDate;
  /** Número de período desde el ancla. Da un orden estable e idempotente. */
  readonly periodIndex: number;
  /** Etiqueta legible: "2026-09", o "2026-09/10" si abarca varios meses. */
  readonly periodKey: string;
  /** Null cuando el vencimiento no se puede proyectar y lo trae la factura. */
  readonly dueDate: CivilDate | null;
}

/**
 * Calcula el vencimiento de un período.
 *
 * REGLA: el vencimiento cae en el mes en que TERMINA el período, es decir el
 * mes del último día cubierto.
 *
 * Con una sola regla quedan bien los dos casos habituales:
 *  - Mensual [01/09, 01/10) -> último día cubierto en septiembre -> vence 10/09.
 *  - Bimestral [01/09, 01/11) -> último día cubierto en octubre -> vence 20/10.
 */
export function calcularVencimiento(
  periodo: { periodStart: CivilDate; periodEnd: CivilDate },
  dueDayOfMonth: number | null,
  politica: PoliticaDiaVencimiento,
): CivilDate | null {
  if (dueDayOfMonth === null || politica === 'FROM_INVOICE_ONLY') return null;

  const ultimoDiaCubierto = periodo.periodEnd.addDays(-1);
  const { year, month } = ultimoDiaCubierto;
  const diasDisponibles = diasDelMes(year, month);

  if (dueDayOfMonth <= diasDisponibles) {
    return CivilDate.of(year, month, dueDayOfMonth);
  }

  // El mes no llega a ese día: por ejemplo, vencimiento el 31 en febrero.
  if (politica === 'ROLL_FORWARD') {
    // Pasa al mes siguiente. Cambia el mes del vencimiento, y por lo tanto el
    // mes al que ese gasto pertenece en el tablero.
    return CivilDate.of(year, month, diasDisponibles).addDays(1);
  }

  // CLAMP_TO_LAST_DAY: vence el último día del mes. Es lo que hacen casi todos
  // los servicios, y por eso es el valor por defecto.
  return CivilDate.of(year, month, diasDisponibles);
}

/**
 * Genera los períodos de una condición dentro de una ventana de tiempo.
 *
 * El cálculo parte SIEMPRE del ancla y nunca de "hoy": así generar los períodos
 * una vez o cincuenta produce exactamente lo mismo, que es lo que permite que
 * el proyector se pueda correr sin miedo a duplicar nada.
 *
 * La ventana `hasta` es INCLUSIVA respecto del inicio del período: se devuelve
 * todo período que arranque en esa fecha o antes.
 */
export function generarPeriodos(
  condicion: CondicionDePeriodos,
  desde: CivilDate,
  hasta: CivilDate,
): Periodo[] {
  if (condicion.frequency === 'ON_DEMAND') return [];
  if (hasta.isBefore(desde)) return [];

  const periodos: Periodo[] = [];
  const primerIndice = indiceDelPeriodoQueContiene(condicion, desde);

  for (let i = primerIndice; ; i++) {
    const periodStart = inicioDelPeriodo(condicion, i);
    if (periodStart.isAfter(hasta)) break;

    const periodEnd = inicioDelPeriodo(condicion, i + 1);

    // Un período que termina antes de la ventana no interesa.
    if (!periodEnd.isAfter(desde)) continue;

    periodos.push({
      periodStart,
      periodEnd,
      periodIndex: i,
      periodKey: clavePeriodo(periodStart, periodEnd),
      dueDate: calcularVencimiento(
        { periodStart, periodEnd },
        condicion.dueDayOfMonth,
        condicion.dueDayPolicy,
      ),
    });

    // Red de seguridad: una condición mal cargada no debe colgar el proceso.
    if (periodos.length > 600) break;
  }

  return periodos;
}

/** Inicio del período número `indice`, contado desde el ancla. */
export function inicioDelPeriodo(condicion: CondicionDePeriodos, indice: number): CivilDate {
  const meses = MESES_POR_PERIODO[condicion.frequency];
  if (meses !== undefined) return condicion.periodAnchorDate.addMonths(meses * indice);

  const dias = DIAS_POR_PERIODO[condicion.frequency] ?? 30;
  return condicion.periodAnchorDate.addDays(dias * indice);
}

function indiceDelPeriodoQueContiene(condicion: CondicionDePeriodos, fecha: CivilDate): number {
  const meses = MESES_POR_PERIODO[condicion.frequency];
  const ancla = condicion.periodAnchorDate;

  if (meses !== undefined) {
    const diferencia =
      (fecha.year - ancla.year) * 12 + (fecha.month - ancla.month) - (fecha.day < ancla.day ? 1 : 0);
    return Math.floor(diferencia / meses);
  }

  const dias = DIAS_POR_PERIODO[condicion.frequency] ?? 30;
  return Math.floor(ancla.diasHasta(fecha) / dias);
}

function clavePeriodo(inicio: CivilDate, fin: CivilDate): string {
  const ultimo = fin.addDays(-1);
  const mm = (n: number) => String(n).padStart(2, '0');

  if (inicio.year === ultimo.year && inicio.month === ultimo.month) {
    return `${inicio.year}-${mm(inicio.month)}`;
  }
  if (inicio.year === ultimo.year) {
    return `${inicio.year}-${mm(inicio.month)}/${mm(ultimo.month)}`;
  }
  return `${inicio.year}-${mm(inicio.month)}/${ultimo.year}-${mm(ultimo.month)}`;
}
