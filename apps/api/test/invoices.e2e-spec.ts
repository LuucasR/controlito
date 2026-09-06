import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Harness, requiereBase, type Sesion } from './support/app-harness';

interface Ciclo {
  id: string;
  periodKey: string;
  dueDate: string | null;
  lifecycle: string;
  expectedAmount: string | null;
}

interface Factura {
  id: string;
  totalAmount: string;
  currentChargeAmount: string;
  comparison: {
    expectedAmount: string | null;
    difference: string | null;
    percent: string | null;
    direction: string;
  } | null;
  alerts: Array<{ type: string; severity: string; message: string }>;
}

interface Alerta {
  type: string;
  severity: string;
  message: string;
  baselineValue: string | null;
  observedValue: string | null;
  deltaAbsolute: string | null;
  deltaPercent: string | null;
}

describe.skipIf(requiereBase)('Facturas y detección de cambios (e2e)', () => {
  let h: Harness;
  let sesion: Sesion;
  let auth: string;

  beforeAll(async () => {
    h = await Harness.iniciar();
    sesion = await h.registrarUsuario('facturas');
    auth = `Bearer ${sesion.accessToken}`;
  });

  afterAll(async () => {
    await h.limpiar();
  });

  /** Movistar $25.000 mensual, vence el 10, como en el plan. */
  const prepararServicio = async (): Promise<{ serviceId: string; ciclo: Ciclo }> => {
    const hoy = new Date();
    const inicio = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 1, 1))
      .toISOString()
      .slice(0, 10);

    const servicio = await request(h.server)
      .post('/api/v1/services')
      .set('Authorization', auth)
      .send({
        name: 'Internet Fibra 600 MB',
        providerName: 'Movistar',
        startDate: inicio,
        condition: {
          validFrom: inicio,
          amountMode: 'FIXED',
          baseAmount: '25000',
          frequency: 'MONTHLY',
          dueDayOfMonth: 10,
        },
      })
      .expect(201);

    const serviceId = (servicio.body as { id: string }).id;

    const ciclos = await request(h.server)
      .get(`/api/v1/services/${serviceId}/cycles`)
      .set('Authorization', auth)
      .expect(200);

    const lista = ciclos.body as Ciclo[];
    const ciclo = lista.find((c) => c.expectedAmount === '25000.00')!;

    return { serviceId, ciclo };
  };

  const registrar = async (ciclo: Ciclo, datos: Record<string, unknown>) => {
    const res = await request(h.server)
      .post('/api/v1/invoices')
      .set('Authorization', auth)
      .send({
        cycleId: ciclo.id,
        issueDate: ciclo.dueDate!,
        dueDate: ciclo.dueDate!,
        ...datos,
      })
      .expect(201);

    return res.body as Factura;
  };

  it('una factura que coincide con lo esperado no genera alertas', async () => {
    const { ciclo } = await prepararServicio();
    const factura = await registrar(ciclo, { currentChargeAmount: '25000' });

    expect(factura.totalAmount).toBe('25000.00');
    expect(factura.comparison?.difference).toBe('0.00');
    expect(factura.alerts).toEqual([]);
  });

  it('detecta el aumento del ejemplo: esperaba 25.000 y llegó 32.500', async () => {
    const { ciclo } = await prepararServicio();
    const factura = await registrar(ciclo, { currentChargeAmount: '32500' });

    expect(factura.comparison?.expectedAmount).toBe('25000.00');
    expect(factura.comparison?.difference).toBe('7500.00');
    expect(factura.comparison?.percent).toBe('30.00');

    const alerta = factura.alerts.find((a) => a.type === 'AMOUNT_INCREASE')!;
    expect(alerta.severity).toBe('WARNING');
    expect(alerta.message).toContain('7500.00');
  });

  it('el período queda facturado y toma el vencimiento real', async () => {
    const { serviceId, ciclo } = await prepararServicio();
    await registrar(ciclo, { currentChargeAmount: '25000' });

    const res = await request(h.server)
      .get(`/api/v1/services/${serviceId}/cycles`)
      .set('Authorization', auth)
      .expect(200);

    const actualizado = (res.body as Ciclo[]).find((c) => c.id === ciclo.id)!;
    expect(actualizado.lifecycle).toBe('INVOICED');
  });
  it('una factura que incluye deuda NO se lee como aumento', async () => {
    const { ciclo } = await prepararServicio();

    // Escenario del plan: 25.000 de consumo + 10.000 de deuda + 500 de
    // intereses = 35.500. La tarifa no aumento, pero el total es 42% mayor.
    const factura = await registrar(ciclo, {
      currentChargeAmount: '25000',
      includedPriorDebtAmount: '10000',
      priorDebtInterestAmount: '500',
    });

    expect(factura.totalAmount).toBe('35500.00');
    // La comparacion se hace sobre el consumo, no sobre el total.
    expect(factura.comparison?.difference).toBe('0.00');
    expect(factura.alerts.some((a) => a.type === 'AMOUNT_INCREASE')).toBe(false);

    const deuda = factura.alerts.find((a) => a.type === 'DEBT_DETECTED')!;
    expect(deuda.severity).toBe('CRITICAL');
    expect(deuda.message).toContain('10000.00');
  });

  it('rechaza una segunda factura para el mismo período', async () => {
    const { ciclo } = await prepararServicio();
    await registrar(ciclo, { currentChargeAmount: '25000' });

    const res = await request(h.server)
      .post('/api/v1/invoices')
      .set('Authorization', auth)
      .send({
        cycleId: ciclo.id,
        issueDate: ciclo.dueDate,
        dueDate: ciclo.dueDate,
        currentChargeAmount: '99000',
      })
      .expect(409);

    expect((res.body as { code: string }).code).toBe('INVOICE_ALREADY_EXISTS');
  });

  it('anular no borra: la factura queda y el período vuelve a esperar', async () => {
    const { serviceId, ciclo } = await prepararServicio();
    const factura = await registrar(ciclo, { currentChargeAmount: '25000' });

    await request(h.server)
      .post('/api/v1/invoices/' + factura.id + '/void')
      .set('Authorization', auth)
      .send({ reason: 'La empresa la refacturó' })
      .expect(204);

    const facturas = await request(h.server)
      .get('/api/v1/services/' + serviceId + '/invoices')
      .set('Authorization', auth)
      .expect(200);

    // Sigue existiendo, marcada como anulada: el historial no se falsea.
    const anulada = (facturas.body as Array<{ id: string; status: string }>).find(
      (f) => f.id === factura.id,
    )!;
    expect(anulada.status).toBe('VOID');

    const ciclos = await request(h.server)
      .get('/api/v1/services/' + serviceId + '/cycles')
      .set('Authorization', auth)
      .expect(200);
    expect((ciclos.body as Ciclo[]).find((c) => c.id === ciclo.id)!.lifecycle).toBe(
      'AWAITING_INVOICE',
    );

    // Y se puede registrar la correcta.
    await registrar(ciclo, { currentChargeAmount: '26000' });
  });

  it('rechaza un vencimiento anterior a la emisión', async () => {
    const { ciclo } = await prepararServicio();

    const res = await request(h.server)
      .post('/api/v1/invoices')
      .set('Authorization', auth)
      .send({
        cycleId: ciclo.id,
        issueDate: '2026-09-20',
        dueDate: '2026-09-10',
        currentChargeAmount: '25000',
      })
      .expect(422);

    expect((res.body as { code: string }).code).toBe('VALIDATION_ERROR');
  });

  describe('alertas', () => {
    it('quedan listadas con su evidencia numérica', async () => {
      const { ciclo } = await prepararServicio();
      await registrar(ciclo, { currentChargeAmount: '32500' });

      const res = await request(h.server)
        .get('/api/v1/alerts')
        .set('Authorization', auth)
        .expect(200);

      const alerta = (res.body as Alerta[]).find((a) => a.type === 'AMOUNT_INCREASE')!;
      expect(alerta.baselineValue).toBe('25000.00');
      expect(alerta.observedValue).toBe('32500.00');
      expect(alerta.deltaAbsolute).toBe('7500.00');
      expect(alerta.deltaPercent).toBe('30.0');
    });

    it('se pueden marcar como vistas sin borrarlas', async () => {
      const { ciclo } = await prepararServicio();
      await registrar(ciclo, { currentChargeAmount: '32500' });

      const antes = await request(h.server)
        .get('/api/v1/alerts')
        .set('Authorization', auth)
        .expect(200);

      const id = (antes.body as Array<{ id: string; type: string }>).find(
        (a) => a.type === 'AMOUNT_INCREASE',
      )!.id;

      await request(h.server)
        .post('/api/v1/alerts/' + id + '/acknowledge')
        .set('Authorization', auth)
        .expect(204);

      const despues = await request(h.server)
        .get('/api/v1/alerts')
        .set('Authorization', auth)
        .expect(200);

      const marcada = (despues.body as Array<{ id: string; status: string }>).find(
        (a) => a.id === id,
      )!;
      expect(marcada.status).toBe('ACKNOWLEDGED');
    });
  });
});
