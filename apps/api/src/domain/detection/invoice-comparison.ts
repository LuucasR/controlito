import { Decimal } from 'decimal.js';

import type { CivilDate } from '../time/civil-date';

/** Umbral por defecto: una diferencia menor al 2% no vale la pena avisarla. */
export const UMBRAL_PORCENTUAL_POR_DEFECTO = new Decimal('2');

export type DireccionDelCambio = 'AUMENTO' | 'BAJA' | 'SIN_CAMBIO' | 'SIN_ESTIMACION';

export interface CambioDeMonto {
  readonly direccion: DireccionDelCambio;
  /** Diferencia en pesos. Positiva si vino más caro. */
  readonly diferencia: Decimal | null;
  /** Diferencia porcentual sobre lo esperado. */
  readonly porcentaje: Decimal | null;
  /** Si supera el umbral y merece una alerta. */
  readonly esRelevante: boolean;
}

export interface CambioDeVencimiento {
  readonly proyectado: CivilDate;
  readonly real: CivilDate;
  /** Positivo si la factura vence más tarde de lo proyectado. */
  readonly diasDeCorrimiento: number;
}

/**
 * Compara lo que llegó contra lo que se esperaba.
 *
 * Se compara SOLO el cargo del período, nunca el total de la factura: si la
 * factura incluye deuda anterior o punitorios, el total va a ser mayor por
 * razones que no son un aumento de tarifa. Confundirlos haría que la app
 * grite "aumento del 40%" cada vez que alguien arrastra una deuda.
 */
export function compararMonto(
  esperado: Decimal | null,
  cargoDelPeriodo: Decimal,
  umbralPorcentual: Decimal = UMBRAL_PORCENTUAL_POR_DEFECTO,
): CambioDeMonto {
  // Sin estimación no hay nada contra qué comparar. Devolver "sin cambio"
  // sería afirmar que coincide, y nadie verificó eso.
  if (esperado === null || esperado.isZero()) {
    return { direccion: 'SIN_ESTIMACION', diferencia: null, porcentaje: null, esRelevante: false };
  }

  const diferencia = cargoDelPeriodo.minus(esperado);

  if (diferencia.isZero()) {
    return {
      direccion: 'SIN_CAMBIO',
      diferencia: new Decimal(0),
      porcentaje: new Decimal(0),
      esRelevante: false,
    };
  }

  const porcentaje = diferencia.dividedBy(esperado).times(100);

  return {
    direccion: diferencia.isPositive() ? 'AUMENTO' : 'BAJA',
    diferencia,
    porcentaje,
    esRelevante: porcentaje.abs().greaterThanOrEqualTo(umbralPorcentual),
  };
}

/** Detecta que la factura vence en una fecha distinta de la proyectada. */
export function compararVencimiento(
  proyectado: CivilDate | null,
  real: CivilDate | null,
): CambioDeVencimiento | null {
  if (proyectado === null || real === null) return null;
  if (proyectado.equals(real)) return null;

  return { proyectado, real, diasDeCorrimiento: proyectado.diasHasta(real) };
}

export type TipoDeAlerta =
  | 'AMOUNT_INCREASE'
  | 'AMOUNT_DECREASE'
  | 'DUE_DATE_CHANGED'
  | 'DEBT_DETECTED'
  | 'MISSING_INVOICE';

export type SeveridadDeAlerta = 'INFO' | 'WARNING' | 'CRITICAL';

export interface AlertaDetectada {
  readonly tipo: TipoDeAlerta;
  readonly severidad: SeveridadDeAlerta;
  readonly titulo: string;
  readonly mensaje: string;
  readonly baseline: Decimal | null;
  readonly observado: Decimal | null;
  readonly diferencia: Decimal | null;
  readonly porcentaje: Decimal | null;
}

export interface DatosDeFactura {
  readonly cargoDelPeriodo: Decimal;
  readonly deudaAnteriorIncluida: Decimal;
  readonly interesesFacturados: Decimal;
  readonly vencimientoReal: CivilDate | null;
}

export interface DatosEsperados {
  readonly montoEsperado: Decimal | null;
  readonly vencimientoProyectado: CivilDate | null;
  readonly nombreDelServicio: string;
  readonly periodo: string;
}

/**
 * Genera las alertas que corresponden al registrar una factura.
 *
 * Cada alerta lleva su evidencia numérica: qué se esperaba, qué llegó y cuánto
 * es la diferencia. Sin eso, un aviso de "aumento detectado" obliga a la
 * persona a ir a buscar los números por su cuenta.
 */
export function detectarAlertas(
  esperado: DatosEsperados,
  factura: DatosDeFactura,
  umbralPorcentual: Decimal = UMBRAL_PORCENTUAL_POR_DEFECTO,
): AlertaDetectada[] {
  const alertas: AlertaDetectada[] = [];

  const cambio = compararMonto(esperado.montoEsperado, factura.cargoDelPeriodo, umbralPorcentual);

  if (cambio.esRelevante && cambio.diferencia && cambio.porcentaje) {
    const subio = cambio.direccion === 'AUMENTO';
    const monto = cambio.diferencia.abs().toFixed(2);
    const pct = cambio.porcentaje.abs().toFixed(1);

    alertas.push({
      tipo: subio ? 'AMOUNT_INCREASE' : 'AMOUNT_DECREASE',
      // Una baja tampoco se ignora: puede ser un error de facturación a favor
      // que después se corrige con una refacturación.
      severidad: subio ? 'WARNING' : 'INFO',
      titulo: subio ? 'Aumento detectado' : 'Vino más barato de lo esperado',
      mensaje: `${esperado.nombreDelServicio} · ${esperado.periodo}: esperabas ${esperado.montoEsperado!.toFixed(2)} y llegó ${factura.cargoDelPeriodo.toFixed(2)}. Diferencia de ${monto} (${pct}%).`,
      baseline: esperado.montoEsperado,
      observado: factura.cargoDelPeriodo,
      diferencia: cambio.diferencia,
      porcentaje: cambio.porcentaje,
    });
  }

  const corrimiento = compararVencimiento(esperado.vencimientoProyectado, factura.vencimientoReal);
  if (corrimiento) {
    const dias = Math.abs(corrimiento.diasDeCorrimiento);
    const antes = corrimiento.diasDeCorrimiento < 0;

    alertas.push({
      tipo: 'DUE_DATE_CHANGED',
      // Que venza ANTES es más urgente: reduce el tiempo disponible para pagar.
      severidad: antes ? 'WARNING' : 'INFO',
      titulo: 'Cambió el vencimiento',
      mensaje: `${esperado.nombreDelServicio} · ${esperado.periodo}: esperabas que venciera el ${corrimiento.proyectado.toString()} y vence el ${corrimiento.real.toString()}, ${dias} ${dias === 1 ? 'día' : 'días'} ${antes ? 'antes' : 'después'}.`,
      baseline: null,
      observado: null,
      diferencia: null,
      porcentaje: null,
    });
  }

  if (factura.deudaAnteriorIncluida.greaterThan(0)) {
    const total = factura.deudaAnteriorIncluida.plus(factura.interesesFacturados);

    alertas.push({
      tipo: 'DEBT_DETECTED',
      severidad: 'CRITICAL',
      titulo: 'La factura incluye deuda anterior',
      mensaje: `${esperado.nombreDelServicio} · ${esperado.periodo}: la factura trae ${factura.deudaAnteriorIncluida.toFixed(2)} de saldo anterior${factura.interesesFacturados.greaterThan(0) ? ` y ${factura.interesesFacturados.toFixed(2)} de intereses` : ''}. Total arrastrado: ${total.toFixed(2)}.`,
      baseline: null,
      observado: total,
      diferencia: null,
      porcentaje: null,
    });
  }

  return alertas;
}
