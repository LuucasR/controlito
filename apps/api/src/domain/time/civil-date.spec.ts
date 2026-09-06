import { describe, expect, it } from 'vitest';

import { CivilDate, CivilDateInvalidaError } from './civil-date';

describe('CivilDate', () => {
  it('parsea y devuelve el mismo texto', () => {
    expect(CivilDate.parse('2026-09-10').toString()).toBe('2026-09-10');
    expect(CivilDate.parse('2026-01-01').toString()).toBe('2026-01-01');
  });

  it('rechaza formatos que no sean YYYY-MM-DD', () => {
    for (const malo of ['10/09/2026', '2026-9-10', '2026-09-10T00:00:00Z', '', 'ayer']) {
      expect(() => CivilDate.parse(malo), malo).toThrow(CivilDateInvalidaError);
    }
  });

  it('rechaza fechas que no existen', () => {
    expect(() => CivilDate.of(2026, 2, 30)).toThrow(CivilDateInvalidaError);
    expect(() => CivilDate.of(2026, 13, 1)).toThrow(CivilDateInvalidaError);
    expect(() => CivilDate.of(2026, 4, 31)).toThrow(CivilDateInvalidaError);
  });

  describe('el corrimiento por UTC', () => {
    it('NO se corre un día al leer lo que devuelve Prisma', () => {
      // Prisma entrega una columna @db.Date como medianoche UTC. Leer los
      // componentes locales en Argentina daría el día anterior.
      const desdeLaBase = new Date('2026-09-10T00:00:00.000Z');
      expect(CivilDate.desdePrisma(desdeLaBase).toString()).toBe('2026-09-10');
    });

    it('vuelve a la base en medianoche UTC, sin desplazamiento', () => {
      const guardado = CivilDate.parse('2026-09-10').aPrisma();
      expect(guardado.toISOString()).toBe('2026-09-10T00:00:00.000Z');
    });

    it('sobrevive a un viaje de ida y vuelta a la base', () => {
      for (const texto of ['2026-01-01', '2026-06-30', '2026-12-31', '2028-02-29']) {
        expect(CivilDate.desdePrisma(CivilDate.parse(texto).aPrisma()).toString()).toBe(texto);
      }
    });
  });

  describe('"hoy" según la zona horaria del usuario', () => {
    it('a las 22:00 en Buenos Aires ya es el día siguiente en UTC', () => {
      // El servidor corre en UTC. Si preguntara la fecha sin la zona del
      // usuario, después de las 21:00 en Argentina daría "mañana", y una
      // factura aparecería vencida un día antes de tiempo.
      const instante = new Date('2026-09-10T01:30:00.000Z');
      expect(CivilDate.hoyEn('America/Argentina/Buenos_Aires', instante).toString()).toBe(
        '2026-09-09',
      );
      expect(CivilDate.hoyEn('UTC', instante).toString()).toBe('2026-09-10');
    });
  });

  describe('sumar meses', () => {
    it('recorta al último día cuando el mes destino es más corto', () => {
      // Un servicio que vence el 31 vence el último día de los meses cortos,
      // no se pasa al mes siguiente.
      expect(CivilDate.parse('2026-01-31').addMonths(1).toString()).toBe('2026-02-28');
      expect(CivilDate.parse('2028-01-31').addMonths(1).toString()).toBe('2028-02-29');
      expect(CivilDate.parse('2026-03-31').addMonths(1).toString()).toBe('2026-04-30');
      expect(CivilDate.parse('2026-05-31').addMonths(1).toString()).toBe('2026-06-30');
    });

    it('cruza el fin de año correctamente', () => {
      expect(CivilDate.parse('2026-11-15').addMonths(2).toString()).toBe('2027-01-15');
      expect(CivilDate.parse('2026-01-15').addMonths(-1).toString()).toBe('2025-12-15');
    });

    it('sirve para períodos bimestrales y anuales', () => {
      expect(CivilDate.parse('2026-09-10').addMonths(2).toString()).toBe('2026-11-10');
      expect(CivilDate.parse('2026-09-10').addMonths(12).toString()).toBe('2027-09-10');
    });

    it('el día 31 en los doce meses del año cae siempre en un día que existe', () => {
      const base = CivilDate.parse('2026-01-31');
      for (let i = 0; i < 12; i++) {
        const resultado = base.addMonths(i);
        expect(() => CivilDate.of(resultado.year, resultado.month, resultado.day)).not.toThrow();
      }
    });
  });

  describe('comparación', () => {
    it('ordena correctamente', () => {
      const a = CivilDate.parse('2026-09-10');
      const b = CivilDate.parse('2026-10-10');
      expect(a.isBefore(b)).toBe(true);
      expect(b.isAfter(a)).toBe(true);
      expect(a.equals(CivilDate.parse('2026-09-10'))).toBe(true);
      expect(a.isBefore(a)).toBe(false);
    });

    it('el rango tiene inicio inclusivo y fin exclusivo', () => {
      const desde = CivilDate.parse('2026-09-01');
      const hasta = CivilDate.parse('2026-10-01');

      expect(CivilDate.parse('2026-09-01').estaEnRango(desde, hasta)).toBe(true);
      expect(CivilDate.parse('2026-09-30').estaEnRango(desde, hasta)).toBe(true);
      expect(CivilDate.parse('2026-10-01').estaEnRango(desde, hasta)).toBe(false);
      expect(CivilDate.parse('2026-08-31').estaEnRango(desde, hasta)).toBe(false);
      // Sin fecha de fin, la condición sigue vigente.
      expect(CivilDate.parse('2030-01-01').estaEnRango(desde, null)).toBe(true);
    });
  });

  describe('días entre fechas', () => {
    it('cuenta bien, incluso cruzando meses y años bisiestos', () => {
      expect(CivilDate.parse('2026-09-10').diasHasta(CivilDate.parse('2026-09-20'))).toBe(10);
      expect(CivilDate.parse('2026-09-20').diasHasta(CivilDate.parse('2026-09-10'))).toBe(-10);
      expect(CivilDate.parse('2028-02-28').diasHasta(CivilDate.parse('2028-03-01'))).toBe(2);
      expect(CivilDate.parse('2026-02-28').diasHasta(CivilDate.parse('2026-03-01'))).toBe(1);
    });

    it('sumar días cruza meses sin errores', () => {
      expect(CivilDate.parse('2026-01-31').addDays(1).toString()).toBe('2026-02-01');
      expect(CivilDate.parse('2026-12-31').addDays(1).toString()).toBe('2027-01-01');
    });
  });
});
