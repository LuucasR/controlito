import { Decimal } from 'decimal.js';
import { describe, expect, it } from 'vitest';

import { CivilDate } from '../time/civil-date';
import {
  compararMonto,
  compararVencimiento,
  detectarAlertas,
  type DatosDeFactura,
  type DatosEsperados,
} from './invoice-comparison';

const d = (v: string) => new Decimal(v);
const f = (t: string) => CivilDate.parse(t);

describe('compararMonto', () => {
  it('detecta el aumento del ejemplo: esperaba 25.000 y llegó 32.500', () => {
    const cambio = compararMonto(d('25000'), d('32500'));

    expect(cambio.direccion).toBe('AUMENTO');
    expect(cambio.diferencia?.toFixed(2)).toBe('7500.00');
    expect(cambio.porcentaje?.toFixed(1)).toBe('30.0');
    expect(cambio.esRelevante).toBe(true);
  });

  it('cuando el monto coincide no hay nada que avisar', () => {
    const cambio = compararMonto(d('25000'), d('25000'));

    expect(cambio.direccion).toBe('SIN_CAMBIO');
    expect(cambio.diferencia?.toFixed(2)).toBe('0.00');
    expect(cambio.esRelevante).toBe(false);
  });

  it('una baja también se detecta', () => {
    const cambio = compararMonto(d('25000'), d('20000'));

    expect(cambio.direccion).toBe('BAJA');
    expect(cambio.diferencia?.toFixed(2)).toBe('-5000.00');
    expect(cambio.porcentaje?.toFixed(1)).toBe('-20.0');
    expect(cambio.esRelevante).toBe(true);
  });

  it('una diferencia mínima no genera ruido', () => {
    // Un peso de diferencia sobre 25.000 no es un aumento: es redondeo.
    const cambio = compararMonto(d('25000'), d('25001'));

    expect(cambio.direccion).toBe('AUMENTO');
    expect(cambio.esRelevante).toBe(false);
  });

  it('sin estimación NO afirma que coincide', () => {
    // Devolver "sin cambio" seria afirmar algo que nadie verifico.
    const cambio = compararMonto(null, d('32500'));

    expect(cambio.direccion).toBe('SIN_ESTIMACION');
    expect(cambio.diferencia).toBeNull();
    expect(cambio.esRelevante).toBe(false);
  });

  it('respeta un umbral más exigente', () => {
    const conUmbralAlto = compararMonto(d('25000'), d('26000'), d('10'));
    const conUmbralBajo = compararMonto(d('25000'), d('26000'), d('1'));

    expect(conUmbralAlto.esRelevante).toBe(false);
    expect(conUmbralBajo.esRelevante).toBe(true);
  });

  it('no pierde precisión con decimales', () => {
    const cambio = compararMonto(d('25000.50'), d('25000.75'));
    expect(cambio.diferencia?.toFixed(2)).toBe('0.25');
  });
});

describe('compararVencimiento', () => {
  it('detecta el corrimiento y en qué dirección', () => {
    const antes = compararVencimiento(f('2026-09-10'), f('2026-09-05'));
    expect(antes?.diasDeCorrimiento).toBe(-5);

    const despues = compararVencimiento(f('2026-09-10'), f('2026-09-15'));
    expect(despues?.diasDeCorrimiento).toBe(5);
  });

  it('no reporta nada si la fecha coincide', () => {
    expect(compararVencimiento(f('2026-09-10'), f('2026-09-10'))).toBeNull();
  });

  it('no reporta nada si falta alguna de las dos fechas', () => {
    expect(compararVencimiento(null, f('2026-09-10'))).toBeNull();
    expect(compararVencimiento(f('2026-09-10'), null)).toBeNull();
  });
});

describe('detectarAlertas', () => {
  const esperado: DatosEsperados = {
    montoEsperado: d('25000'),
    vencimientoProyectado: f('2026-09-10'),
    nombreDelServicio: 'Movistar',
    periodo: 'Septiembre 2026',
  };

  const facturaLimpia: DatosDeFactura = {
    cargoDelPeriodo: d('25000'),
    deudaAnteriorIncluida: d('0'),
    interesesFacturados: d('0'),
    vencimientoReal: f('2026-09-10'),
  };

  it('una factura que coincide no genera ninguna alerta', () => {
    expect(detectarAlertas(esperado, facturaLimpia)).toEqual([]);
  });

  it('genera la alerta de aumento con su evidencia numérica', () => {
    const alertas = detectarAlertas(esperado, {
      ...facturaLimpia,
      cargoDelPeriodo: d('32500'),
    });

    expect(alertas).toHaveLength(1);
    expect(alertas[0]!.tipo).toBe('AMOUNT_INCREASE');
    expect(alertas[0]!.severidad).toBe('WARNING');
    // El mensaje trae los tres numeros, para no obligar a ir a buscarlos.
    expect(alertas[0]!.mensaje).toContain('25000.00');
    expect(alertas[0]!.mensaje).toContain('32500.00');
    expect(alertas[0]!.mensaje).toContain('7500.00');
    expect(alertas[0]!.mensaje).toContain('30.0%');
    expect(alertas[0]!.diferencia?.toFixed(2)).toBe('7500.00');
  });

  it('un vencimiento adelantado avisa con más urgencia que uno postergado', () => {
    const adelantado = detectarAlertas(esperado, {
      ...facturaLimpia,
      vencimientoReal: f('2026-09-05'),
    });
    const postergado = detectarAlertas(esperado, {
      ...facturaLimpia,
      vencimientoReal: f('2026-09-20'),
    });

    // Que venza antes reduce el tiempo disponible para pagar.
    expect(adelantado[0]!.severidad).toBe('WARNING');
    expect(adelantado[0]!.mensaje).toContain('5 días antes');
    expect(postergado[0]!.severidad).toBe('INFO');
    expect(postergado[0]!.mensaje).toContain('10 días después');
  });

  it('la deuda incluida en la factura es la alerta más grave', () => {
    const alertas = detectarAlertas(esperado, {
      ...facturaLimpia,
      deudaAnteriorIncluida: d('10000'),
      interesesFacturados: d('500'),
    });

    const deuda = alertas.find((a) => a.tipo === 'DEBT_DETECTED')!;
    expect(deuda.severidad).toBe('CRITICAL');
    expect(deuda.mensaje).toContain('10000.00');
    expect(deuda.mensaje).toContain('500.00');
    // El total arrastrado, que es lo que importa para no contarlo dos veces.
    expect(deuda.observado?.toFixed(2)).toBe('10500.00');
  });

  it('el aumento se mide sobre el CARGO DEL PERÍODO, no sobre el total', () => {
    // La factura trae 25.000 de consumo mas 10.500 de deuda: el total es
    // 35.500, pero la tarifa no aumento. Comparar contra el total haria que la
    // app grite "aumento del 42%" cada vez que se arrastra una deuda.
    const alertas = detectarAlertas(esperado, {
      cargoDelPeriodo: d('25000'),
      deudaAnteriorIncluida: d('10000'),
      interesesFacturados: d('500'),
      vencimientoReal: f('2026-09-10'),
    });

    expect(alertas.some((a) => a.tipo === 'AMOUNT_INCREASE')).toBe(false);
    expect(alertas.map((a) => a.tipo)).toEqual(['DEBT_DETECTED']);
  });

  it('acumula todas las alertas que correspondan', () => {
    const alertas = detectarAlertas(esperado, {
      cargoDelPeriodo: d('32500'),
      deudaAnteriorIncluida: d('10000'),
      interesesFacturados: d('0'),
      vencimientoReal: f('2026-09-05'),
    });

    expect(alertas.map((a) => a.tipo).sort()).toEqual([
      'AMOUNT_INCREASE',
      'DEBT_DETECTED',
      'DUE_DATE_CHANGED',
    ]);
  });

  it('sin estimación previa no inventa una alerta de aumento', () => {
    const alertas = detectarAlertas(
      { ...esperado, montoEsperado: null },
      { ...facturaLimpia, cargoDelPeriodo: d('99000') },
    );

    expect(alertas).toEqual([]);
  });
});
