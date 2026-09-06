import { describe, expect, it } from 'vitest';

import { CivilDate } from '../time/civil-date';
import { calcularVencimiento, generarPeriodos, type CondicionDePeriodos } from './period-generator';

const f = (t: string) => CivilDate.parse(t);

const mensual: CondicionDePeriodos = {
  periodAnchorDate: f('2026-09-01'),
  frequency: 'MONTHLY',
  dueDayOfMonth: 10,
  dueDayPolicy: 'CLAMP_TO_LAST_DAY',
};

describe('calcularVencimiento', () => {
  it('el período mensual vence en su propio mes', () => {
    // El caso del plan: período septiembre 2026, vence el 10/09/2026.
    const vence = calcularVencimiento(
      { periodStart: f('2026-09-01'), periodEnd: f('2026-10-01') },
      10,
      'CLAMP_TO_LAST_DAY',
    );
    expect(vence?.toString()).toBe('2026-09-10');
  });

  it('el período bimestral vence en el mes en que termina', () => {
    // Gas de septiembre-octubre: vence en octubre, no en septiembre.
    const vence = calcularVencimiento(
      { periodStart: f('2026-09-01'), periodEnd: f('2026-11-01') },
      20,
      'CLAMP_TO_LAST_DAY',
    );
    expect(vence?.toString()).toBe('2026-10-20');
  });

  it('recorta al último día cuando el mes no llega a ese número', () => {
    const febrero = calcularVencimiento(
      { periodStart: f('2026-02-01'), periodEnd: f('2026-03-01') },
      31,
      'CLAMP_TO_LAST_DAY',
    );
    expect(febrero?.toString()).toBe('2026-02-28');

    const bisiesto = calcularVencimiento(
      { periodStart: f('2028-02-01'), periodEnd: f('2028-03-01') },
      31,
      'CLAMP_TO_LAST_DAY',
    );
    expect(bisiesto?.toString()).toBe('2028-02-29');

    const abril = calcularVencimiento(
      { periodStart: f('2026-04-01'), periodEnd: f('2026-05-01') },
      31,
      'CLAMP_TO_LAST_DAY',
    );
    expect(abril?.toString()).toBe('2026-04-30');
  });

  it('con ROLL_FORWARD pasa al mes siguiente, cambiando el mes del gasto', () => {
    const vence = calcularVencimiento(
      { periodStart: f('2026-02-01'), periodEnd: f('2026-03-01') },
      31,
      'ROLL_FORWARD',
    );
    expect(vence?.toString()).toBe('2026-03-01');
  });

  it('no proyecta vencimiento cuando lo trae cada factura', () => {
    expect(
      calcularVencimiento(
        { periodStart: f('2026-09-01'), periodEnd: f('2026-10-01') },
        10,
        'FROM_INVOICE_ONLY',
      ),
    ).toBeNull();

    expect(
      calcularVencimiento(
        { periodStart: f('2026-09-01'), periodEnd: f('2026-10-01') },
        null,
        'CLAMP_TO_LAST_DAY',
      ),
    ).toBeNull();
  });

  it('el día 31 cae en un día que existe en los doce meses', () => {
    for (let mes = 1; mes <= 12; mes++) {
      const inicio = CivilDate.of(2026, mes, 1);
      const vence = calcularVencimiento(
        { periodStart: inicio, periodEnd: inicio.addMonths(1) },
        31,
        'CLAMP_TO_LAST_DAY',
      )!;
      expect(() => CivilDate.of(vence.year, vence.month, vence.day)).not.toThrow();
    }
  });
});

describe('generarPeriodos', () => {
  it('genera los períodos mensuales con sus vencimientos', () => {
    const periodos = generarPeriodos(mensual, f('2026-09-01'), f('2026-12-01'));

    expect(periodos.map((p) => p.periodKey)).toEqual(['2026-09', '2026-10', '2026-11', '2026-12']);
    expect(periodos.map((p) => p.dueDate?.toString())).toEqual([
      '2026-09-10',
      '2026-10-10',
      '2026-11-10',
      '2026-12-10',
    ]);
  });

  it('los períodos son contiguos y no se pisan', () => {
    const periodos = generarPeriodos(mensual, f('2026-09-01'), f('2027-06-01'));

    for (let i = 0; i < periodos.length - 1; i++) {
      // El fin es exclusivo, asi que coincide exactamente con el inicio del
      // siguiente: sin huecos ni superposicion.
      expect(periodos[i]!.periodEnd.toString()).toBe(periodos[i + 1]!.periodStart.toString());
    }
  });

  it('es idempotente: generar dos veces da exactamente lo mismo', () => {
    // Es la propiedad que permite correr el proyector sin miedo a duplicar.
    const a = generarPeriodos(mensual, f('2026-09-01'), f('2027-03-01'));
    const b = generarPeriodos(mensual, f('2026-09-01'), f('2027-03-01'));

    expect(a.map((p) => [p.periodIndex, p.periodStart.toString()])).toEqual(
      b.map((p) => [p.periodIndex, p.periodStart.toString()]),
    );
  });

  it('el índice no depende de la ventana consultada', () => {
    const completo = generarPeriodos(mensual, f('2026-09-01'), f('2027-03-01'));
    const parcial = generarPeriodos(mensual, f('2026-12-01'), f('2027-03-01'));

    const diciembreCompleto = completo.find((p) => p.periodKey === '2026-12')!;
    const diciembreParcial = parcial.find((p) => p.periodKey === '2026-12')!;

    expect(diciembreParcial.periodIndex).toBe(diciembreCompleto.periodIndex);
    expect(diciembreCompleto.periodIndex).toBe(3);
  });

  it('genera períodos bimestrales con la etiqueta de los dos meses', () => {
    const gas: CondicionDePeriodos = {
      periodAnchorDate: f('2026-09-01'),
      frequency: 'BIMONTHLY',
      dueDayOfMonth: 20,
      dueDayPolicy: 'CLAMP_TO_LAST_DAY',
    };

    const periodos = generarPeriodos(gas, f('2026-09-01'), f('2027-01-01'));

    // La ventana es inclusiva: entra tambien el periodo que arranca el 01/01.
    expect(periodos.map((p) => p.periodKey)).toEqual([
      '2026-09/10',
      '2026-11/12',
      '2027-01/02',
    ]);
    expect(periodos[0]!.dueDate?.toString()).toBe('2026-10-20');
    expect(periodos[1]!.dueDate?.toString()).toBe('2026-12-20');
  });

  it('un período anual cruza el año en su etiqueta', () => {
    const seguro: CondicionDePeriodos = {
      periodAnchorDate: f('2026-07-01'),
      frequency: 'ANNUAL',
      dueDayOfMonth: 15,
      dueDayPolicy: 'CLAMP_TO_LAST_DAY',
    };

    const periodos = generarPeriodos(seguro, f('2026-07-01'), f('2027-01-01'));
    expect(periodos[0]!.periodKey).toBe('2026-07/2027-06');
    expect(periodos[0]!.dueDate?.toString()).toBe('2027-06-15');
  });

  it('un servicio sin periodicidad fija no genera períodos', () => {
    const compra: CondicionDePeriodos = {
      periodAnchorDate: f('2026-09-01'),
      frequency: 'ON_DEMAND',
      dueDayOfMonth: null,
      dueDayPolicy: 'FROM_INVOICE_ONLY',
    };

    expect(generarPeriodos(compra, f('2026-01-01'), f('2027-01-01'))).toEqual([]);
  });

  it('respeta el ancla aunque se consulte desde mucho después', () => {
    // El ancla es el 15, asi que los periodos van del 15 al 15.
    const desdeEl15: CondicionDePeriodos = { ...mensual, periodAnchorDate: f('2026-09-15') };
    const periodos = generarPeriodos(desdeEl15, f('2026-11-01'), f('2027-01-01'));

    expect(periodos[0]!.periodStart.toString()).toBe('2026-10-15');
    expect(periodos[0]!.periodEnd.toString()).toBe('2026-11-15');
  });

  it('no devuelve nada si la ventana está invertida', () => {
    expect(generarPeriodos(mensual, f('2027-01-01'), f('2026-01-01'))).toEqual([]);
  });
});
