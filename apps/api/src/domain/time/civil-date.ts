/**
 * Fecha civil: un día del calendario, sin hora ni zona horaria.
 *
 * El vencimiento del 10/09/2026 es el 10/09/2026 en Ushuaia y en Madrid. No es
 * un instante, así que NUNCA debe representarse con `Date` de JavaScript: un
 * `Date` es un momento absoluto y arrastra zona horaria, lo que produce el
 * clásico corrimiento de un día.
 *
 * El caso concreto: Prisma devuelve una columna `@db.Date` como un `Date`
 * ubicado en medianoche UTC. En Argentina (UTC-3), `new
 * Date('2026-09-10T00:00:00Z').getDate()` devuelve 9, y la app mostraría un
 * vencimiento equivocado sin dar ninguna señal de error.
 */
export class CivilDate {
  private constructor(
    readonly year: number,
    readonly month: number,
    readonly day: number,
  ) {}

  /** Crea una fecha validando que exista de verdad (rechaza 31/02). */
  static of(year: number, month: number, day: number): CivilDate {
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
      throw new CivilDateInvalidaError(`${year}-${month}-${day}`);
    }
    if (month < 1 || month > 12 || day < 1 || day > diasDelMes(year, month)) {
      throw new CivilDateInvalidaError(`${year}-${month}-${day}`);
    }
    return new CivilDate(year, month, day);
  }

  /** Parsea el formato de transporte: exactamente "YYYY-MM-DD". */
  static parse(texto: string): CivilDate {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
    if (!m) throw new CivilDateInvalidaError(texto);
    return CivilDate.of(Number(m[1]), Number(m[2]), Number(m[3]));
  }

  /**
   * Convierte lo que devuelve Prisma para una columna `@db.Date`.
   * Se leen los componentes UTC, nunca los locales: ahí está el corrimiento.
   */
  static desdePrisma(fecha: Date): CivilDate {
    return CivilDate.of(fecha.getUTCFullYear(), fecha.getUTCMonth() + 1, fecha.getUTCDate());
  }

  /** "Hoy" en la zona horaria del usuario, que puede no ser la del servidor. */
  static hoyEn(timezone: string, ahora: Date = new Date()): CivilDate {
    const partes = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(ahora);
    return CivilDate.parse(partes);
  }

  /** Valor para guardar en una columna `@db.Date`: medianoche UTC. */
  aPrisma(): Date {
    return new Date(Date.UTC(this.year, this.month - 1, this.day));
  }

  toString(): string {
    const mm = String(this.month).padStart(2, '0');
    const dd = String(this.day).padStart(2, '0');
    return `${this.year}-${mm}-${dd}`;
  }

  toJSON(): string {
    return this.toString();
  }

  /** Número comparable: 2026-09-10 -> 20260910. */
  private get orden(): number {
    return this.year * 10000 + this.month * 100 + this.day;
  }

  equals(otra: CivilDate): boolean {
    return this.orden === otra.orden;
  }

  isBefore(otra: CivilDate): boolean {
    return this.orden < otra.orden;
  }

  isAfter(otra: CivilDate): boolean {
    return this.orden > otra.orden;
  }

  /** Rango con inicio inclusivo y fin exclusivo, la convención del proyecto. */
  estaEnRango(desde: CivilDate, hasta: CivilDate | null): boolean {
    if (this.isBefore(desde)) return false;
    return hasta === null || this.isBefore(hasta);
  }

  addDays(dias: number): CivilDate {
    const d = this.aPrisma();
    d.setUTCDate(d.getUTCDate() + dias);
    return CivilDate.desdePrisma(d);
  }

  /**
   * Suma meses recortando al último día si el destino no tiene ese número.
   * El 31 de enero más un mes es el 28 (o 29) de febrero, no el 3 de marzo:
   * un servicio que vence el 31 vence el último día de los meses cortos.
   */
  addMonths(meses: number): CivilDate {
    const total = this.year * 12 + (this.month - 1) + meses;
    const year = Math.floor(total / 12);
    const month = (total % 12) + 1;
    return CivilDate.of(year, month, Math.min(this.day, diasDelMes(year, month)));
  }

  /** Días completos entre dos fechas. Negativo si la otra es posterior. */
  diasHasta(otra: CivilDate): number {
    const ms = otra.aPrisma().getTime() - this.aPrisma().getTime();
    return Math.round(ms / 86_400_000);
  }
}

export class CivilDateInvalidaError extends Error {
  constructor(valor: string) {
    super(`Fecha inválida: "${valor}". Se espera el formato YYYY-MM-DD.`);
    this.name = 'CivilDateInvalidaError';
  }
}

export function diasDelMes(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
