import { Decimal } from 'decimal.js';
import { describe, expect, it } from 'vitest';

import { Money, MoneyCurrencyMismatchError, MoneyInvalidAmountError } from './money';

describe('Money', () => {
  it('no pierde precisión donde el punto flotante falla', () => {
    // Con number, 0.1 + 0.2 da 0.30000000000000004.
    const total = Money.of('0.10', 'ARS').plus(Money.of('0.20', 'ARS'));
    expect(total.toJSON()).toBe('0.30');
  });

  it('suma y resta montos de la misma moneda', () => {
    const factura = Money.of('25000', 'ARS');
    const pago = Money.of('15000', 'ARS');
    expect(factura.minus(pago).toJSON()).toBe('10000.00');
    expect(factura.plus(pago).toJSON()).toBe('40000.00');
  });

  it('rechaza operar monedas distintas', () => {
    const ars = Money.of('1000', 'ARS');
    const usd = Money.of('10', 'USD');
    expect(() => ars.plus(usd)).toThrow(MoneyCurrencyMismatchError);
    expect(() => ars.minus(usd)).toThrow(MoneyCurrencyMismatchError);
    expect(() => ars.compare(usd)).toThrow(MoneyCurrencyMismatchError);
  });

  it('rechaza montos inválidos', () => {
    expect(() => Money.of('no-es-un-monto', 'ARS')).toThrow(MoneyInvalidAmountError);
    expect(() => Money.of('Infinity', 'ARS')).toThrow(MoneyInvalidAmountError);
  });

  it('calcula el interés del ejemplo del plan: 5% mensual sobre 10.000', () => {
    const deuda = Money.of('10000', 'ARS');
    const interes = deuda.times('0.05').round();
    expect(interes.toJSON()).toBe('500.00');
    expect(deuda.plus(interes).plus(Money.of('25000', 'ARS')).toJSON()).toBe('35500.00');
  });

  it('redondea HALF_UP, no bancario', () => {
    expect(Money.of('1.005', 'ARS').round().toJSON()).toBe('1.01');
    expect(Money.of('1.015', 'ARS').round().toJSON()).toBe('1.02');
    expect(Money.of('2.675', 'ARS').round().toJSON()).toBe('2.68');
  });

  it('distingue saldo a favor de saldo pendiente', () => {
    const sobrepago = Money.of('25000', 'ARS').minus(Money.of('30000', 'ARS'));
    expect(sobrepago.isNegative()).toBe(true);
    expect(sobrepago.clampToZero().toJSON()).toBe('0.00');
    expect(sobrepago.negated().toJSON()).toBe('5000.00');

    const pendiente = Money.of('25000', 'ARS').minus(Money.of('15000', 'ARS'));
    expect(pendiente.clampToZero().toJSON()).toBe('10000.00');
    expect(pendiente.isPositive()).toBe(true);
  });

  it('acepta Decimal y expone helpers de comparación', () => {
    const a = Money.of(new Decimal('100'), 'ARS');
    const b = Money.of('100.00', 'ARS');
    expect(a.equals(b)).toBe(true);
    expect(a.compare(Money.of('200', 'ARS'))).toBe(-1);
    expect(Money.zero('ARS').isZero()).toBe(true);
    expect(a.toString()).toBe('100.00 ARS');
  });
});
