import { describe, expect, it } from 'vitest';

import { CivilDate } from '../time/civil-date';
import { planificarInsercion, validarSecuencia, vigenteEn } from './condition-timeline';

const f = (texto: string) => CivilDate.parse(texto);

/** El caso del plan: promoción de $25.000 y después el precio de lista. */
const promocion = { id: 'promo', validFrom: f('2026-09-01'), validTo: f('2027-03-01') };
const precioLista = { id: 'lista', validFrom: f('2027-03-01'), validTo: null };

describe('vigenteEn', () => {
  it('encuentra la condición que regía en cada momento', () => {
    const historial = [promocion, precioLista];

    expect(vigenteEn(historial, f('2026-09-01'))?.id).toBe('promo');
    expect(vigenteEn(historial, f('2026-12-15'))?.id).toBe('promo');
    // El fin es exclusivo: el 01/03 ya rige la condición nueva.
    expect(vigenteEn(historial, f('2027-02-28'))?.id).toBe('promo');
    expect(vigenteEn(historial, f('2027-03-01'))?.id).toBe('lista');
    expect(vigenteEn(historial, f('2030-01-01'))?.id).toBe('lista');
  });

  it('devuelve null antes de que el servicio existiera', () => {
    expect(vigenteEn([promocion, precioLista], f('2026-08-31'))).toBeNull();
  });

  it('devuelve null si no hay condiciones cargadas', () => {
    expect(vigenteEn([], f('2026-09-10'))).toBeNull();
  });
});

describe('validarSecuencia', () => {
  it('acepta un historial correcto', () => {
    expect(validarSecuencia([promocion, precioLista])).toBeNull();
    expect(validarSecuencia([])).toBeNull();
    expect(validarSecuencia([precioLista])).toBeNull();
  });

  it('detecta dos condiciones que se pisan', () => {
    const solapada = { id: 'otra', validFrom: f('2027-01-01'), validTo: null };
    expect(validarSecuencia([promocion, solapada])).toEqual({
      tipo: 'SOLAPAMIENTO',
      primero: 'promo',
      segundo: 'otra',
    });
  });

  it('detecta dos condiciones abiertas a la vez', () => {
    const abierta1 = { id: 'a', validFrom: f('2026-01-01'), validTo: null };
    const abierta2 = { id: 'b', validFrom: f('2026-06-01'), validTo: null };
    expect(validarSecuencia([abierta1, abierta2])?.tipo).toBe('SOLAPAMIENTO');
  });

  it('detecta un rango que termina antes de empezar', () => {
    const invertida = { id: 'x', validFrom: f('2026-06-01'), validTo: f('2026-01-01') };
    expect(validarSecuencia([invertida])).toEqual({ tipo: 'RANGO_INVALIDO', id: 'x' });
  });

  it('rechaza un tramo de duración cero', () => {
    const vacia = { id: 'x', validFrom: f('2026-06-01'), validTo: f('2026-06-01') };
    expect(validarSecuencia([vacia])?.tipo).toBe('RANGO_INVALIDO');
  });

  it('detecta dos condiciones que arrancan el mismo día', () => {
    const a = { id: 'a', validFrom: f('2026-01-01'), validTo: f('2026-06-01') };
    const b = { id: 'b', validFrom: f('2026-01-01'), validTo: null };
    expect(validarSecuencia([a, b])?.tipo).toBe('INICIO_DUPLICADO');
  });

  it('no depende del orden en que vengan', () => {
    expect(validarSecuencia([precioLista, promocion])).toBeNull();
  });
});

describe('planificarInsercion', () => {
  it('la primera condición no cierra nada', () => {
    expect(planificarInsercion([], f('2026-09-01'))).toEqual({ ok: true, cerrar: null });
  });

  it('cierra la condición abierta justo cuando arranca la nueva', () => {
    // Al terminar la promoción, la condición vieja NO se sobrescribe: se le
    // pone fecha de fin, y el historial queda completo.
    const plan = planificarInsercion([{ ...promocion, validTo: null }], f('2027-03-01'));

    expect(plan).toEqual({
      ok: true,
      cerrar: { id: 'promo', validTo: f('2027-03-01') },
    });
  });

  it('no cierra nada si la última ya estaba cerrada', () => {
    const plan = planificarInsercion([promocion], f('2027-03-01'));
    expect(plan).toEqual({ ok: true, cerrar: null });
  });

  it('rechaza empezar el mismo día que una condición existente', () => {
    const plan = planificarInsercion([promocion, precioLista], f('2027-03-01'));
    expect(plan).toEqual({ ok: false, motivo: 'FECHA_YA_USADA', conflicto: 'lista' });
  });

  it('rechaza insertar en el medio del historial', () => {
    // Meter una condición anterior obligaría a recalcular ciclos ya
    // facturados: se rechaza de forma explícita en vez de hacerlo a medias.
    const plan = planificarInsercion([promocion, precioLista], f('2026-11-01'));
    expect(plan).toEqual({ ok: false, motivo: 'ANTERIOR_A_LA_ULTIMA', conflicto: 'lista' });
  });

  it('el resultado de aplicar el plan es una secuencia válida', () => {
    const abierta = { ...promocion, validTo: null };
    const plan = planificarInsercion([abierta], f('2027-03-01'));

    if (!plan.ok) throw new Error('el plan debería ser válido');

    const resultado = [
      { ...abierta, validTo: plan.cerrar!.validTo },
      { id: 'nueva', validFrom: f('2027-03-01'), validTo: null },
    ];

    expect(validarSecuencia(resultado)).toBeNull();
    expect(vigenteEn(resultado, f('2027-02-28'))?.id).toBe('promo');
    expect(vigenteEn(resultado, f('2027-03-01'))?.id).toBe('nueva');
  });
});
