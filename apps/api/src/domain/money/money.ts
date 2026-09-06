import { Decimal } from 'decimal.js';

/**
 * Regla global de precisión. HALF_UP y no redondeo bancario: es la convención
 * comercial argentina, y un dashboard que difiere del papel destruye la confianza.
 */
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export type CurrencyCode = 'ARS' | 'USD';

/** Decimales de presentación por moneda. No se hardcodea el 2 en el código. */
const SCALE: Readonly<Record<CurrencyCode, number>> = { ARS: 2, USD: 2 };

export class MoneyCurrencyMismatchError extends Error {
  constructor(a: CurrencyCode, b: CurrencyCode) {
    super(`No se pueden operar montos de monedas distintas: ${a} y ${b}`);
    this.name = 'MoneyCurrencyMismatchError';
  }
}

export class MoneyInvalidAmountError extends Error {
  constructor(value: string) {
    super(`Monto inválido: "${value}"`);
    this.name = 'MoneyInvalidAmountError';
  }
}

/**
 * Monto de dinero exacto. NUNCA usar number para dinero: en JS
 * 0.1 + 0.2 !== 0.3, y en Dart Web los enteros se compilan a double.
 */
export class Money {
  private constructor(
    readonly amount: Decimal,
    readonly currency: CurrencyCode,
  ) {}

  /** Acepta string (el formato de transporte) o Decimal. Nunca number. */
  static of(value: string | Decimal, currency: CurrencyCode): Money {
    if (value instanceof Decimal) {
      return new Money(value, currency);
    }
    let parsed: Decimal;
    try {
      parsed = new Decimal(value);
    } catch {
      throw new MoneyInvalidAmountError(value);
    }
    if (!parsed.isFinite()) {
      throw new MoneyInvalidAmountError(value);
    }
    return new Money(parsed, currency);
  }

  static zero(currency: CurrencyCode): Money {
    return new Money(new Decimal(0), currency);
  }

  plus(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount.plus(other.amount), this.currency);
  }

  minus(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount.minus(other.amount), this.currency);
  }

  times(factor: string | Decimal): Money {
    return new Money(this.amount.times(new Decimal(factor)), this.currency);
  }

  negated(): Money {
    return new Money(this.amount.negated(), this.currency);
  }

  /** Máximo entre este monto y cero: "lo que falta pagar" nunca es negativo. */
  clampToZero(): Money {
    return this.isNegative() ? Money.zero(this.currency) : this;
  }

  isZero(): boolean {
    return this.amount.isZero();
  }

  isNegative(): boolean {
    return this.amount.isNegative() && !this.amount.isZero();
  }

  isPositive(): boolean {
    return this.amount.greaterThan(0);
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.amount.equals(other.amount);
  }

  compare(other: Money): -1 | 0 | 1 {
    this.assertSameCurrency(other);
    return this.amount.comparedTo(other.amount) as -1 | 0 | 1;
  }

  /**
   * Redondea a la escala de la moneda. Se llama UNA sola vez, al final:
   * redondear en cada paso intermedio acumula error.
   */
  round(): Money {
    return new Money(this.amount.toDecimalPlaces(SCALE[this.currency]), this.currency);
  }

  /** Formato de transporte: string, nunca number. */
  toJSON(): string {
    return this.amount.toFixed(SCALE[this.currency]);
  }

  toString(): string {
    return `${this.toJSON()} ${this.currency}`;
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new MoneyCurrencyMismatchError(this.currency, other.currency);
    }
  }
}
