import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Harness, requiereBase, type Sesion } from './support/app-harness';

interface Ciclo {
  id: string;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string | null;
  lifecycle: string;
  expectedAmount: string | null;
  expectedAmountSource: string;
  daysUntilDue: number | null;
  isOverdue: boolean;
}

describe.skipIf(requiereBase)('Ciclos de facturación (e2e)', () => {
  let h: Harness;
  let sesion: Sesion;
  let auth: string;

  beforeAll(async () => {
    h = await Harness.iniciar();
    sesion = await h.registrarUsuario('ciclos');
    auth = `Bearer ${sesion.accessToken}`;
  });

  afterAll(async () => {
    await h.limpiar();
  });

  /** Servicio mensual de monto fijo que vence el 10, como el del plan. */
  const crearServicio = async (extra: Record<string, unknown> = {}) => {
    const hoy = new Date();
    const inicio = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 2, 1))
      .toISOString()
      .slice(0, 10);

    const res = await request(h.server)
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
          ...extra,
        },
      })
      .expect(201);

    return (res.body as { id: string }).id;
  };

  const ciclosDe = async (serviceId: string): Promise<Ciclo[]> => {
    const res = await request(h.server)
      .get(`/api/v1/services/${serviceId}/cycles`)
      .set('Authorization', auth)
      .expect(200);
    return res.body as Ciclo[];
  };

  it('genera los períodos del servicio con sus vencimientos', async () => {
    const id = await crearServicio();
    const ciclos = await ciclosDe(id);

    expect(ciclos.length).toBeGreaterThan(3);

    for (const ciclo of ciclos) {
      expect(ciclo.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      // El vencimiento cae el 10 de su mes.
      expect(ciclo.dueDate!.slice(-2)).toBe('10');
      expect(ciclo.expectedAmount).toBe('25000.00');
      expect(ciclo.expectedAmountSource).toBe('USER_FIXED');
    }
  });

  it('los períodos son contiguos: el fin de uno es el inicio del siguiente', async () => {
    const id = await crearServicio();
    const ciclos = (await ciclosDe(id)).reverse();

    for (let i = 0; i < ciclos.length - 1; i++) {
      expect(ciclos[i]!.periodEnd).toBe(ciclos[i + 1]!.periodStart);
    }
  });

  it('es IDEMPOTENTE: consultar varias veces no duplica períodos', async () => {
    const id = await crearServicio();

    // Cada consulta dispara el proyector. Si no fuera idempotente, cada llamada
    // agregaria filas nuevas y el historial se llenaria de duplicados.
    const primera = await ciclosDe(id);
    const segunda = await ciclosDe(id);
    const tercera = await ciclosDe(id);

    expect(segunda.length).toBe(primera.length);
    expect(tercera.length).toBe(primera.length);
    expect(tercera.map((c) => c.id).sort()).toEqual(primera.map((c) => c.id).sort());
  });

  it('marca como vencido lo que ya pasó, sin depender de ninguna tarea programada', async () => {
    const id = await crearServicio();
    const ciclos = await ciclosDe(id);

    const vencidos = ciclos.filter((c) => c.isOverdue);
    expect(vencidos.length).toBeGreaterThan(0);

    for (const ciclo of vencidos) {
      expect(ciclo.daysUntilDue).toBeLessThan(0);
    }
  });
  it('un servicio variable sin base estimada muestra ausencia de monto, no cero', async () => {
    const id = await crearServicio({ amountMode: 'VARIABLE_UNKNOWN', baseAmount: null });
    const ciclos = await ciclosDe(id);

    // Afirmar $0 seria mentir: la interfaz muestra "?" gracias a este null.
    expect(ciclos[0]!.expectedAmount).toBeNull();
    expect(ciclos[0]!.expectedAmountSource).toBe('UNKNOWN');
  });

  it('no proyecta vencimiento cuando lo trae cada factura', async () => {
    const id = await crearServicio({ dueDayPolicy: 'FROM_INVOICE_ONLY' });
    const ciclos = await ciclosDe(id);

    expect(ciclos.every((c) => c.dueDate === null)).toBe(true);
    expect(ciclos.every((c) => c.isOverdue === false)).toBe(true);
  });

  it('un servicio bimestral genera períodos de dos meses', async () => {
    const id = await crearServicio({ frequency: 'BIMONTHLY', dueDayOfMonth: 20 });
    const ciclos = await ciclosDe(id);

    // La etiqueta lleva los dos meses separados por barra: "2026-09/10".
    expect(ciclos[0]!.periodKey).toContain(String.fromCharCode(47));
    expect(ciclos[0]!.periodKey.length).toBeGreaterThan(7);
    expect(ciclos[0]!.dueDate!.slice(-2)).toBe('20');
  });

  it('los próximos vencimientos vienen ordenados por fecha', async () => {
    await crearServicio();

    const res = await request(h.server)
      .get('/api/v1/cycles/upcoming?dias=90')
      .set('Authorization', auth)
      .expect(200);

    const ciclos = res.body as Ciclo[];
    expect(ciclos.length).toBeGreaterThan(0);

    for (let i = 0; i < ciclos.length - 1; i++) {
      expect(ciclos[i]!.dueDate!.localeCompare(ciclos[i + 1]!.dueDate!)).toBeLessThanOrEqual(0);
    }
  });

  it('cambiar las condiciones NO reescribe los períodos ya proyectados hacia atrás', async () => {
    const id = await crearServicio();
    const antes = await ciclosDe(id);

    // Se agrega una condicion cara a futuro.
    const dentroDeUnAno = new Date();
    dentroDeUnAno.setUTCFullYear(dentroDeUnAno.getUTCFullYear() + 1);
    const desde = dentroDeUnAno.toISOString().slice(0, 10);

    await request(h.server)
      .post(`/api/v1/services/${id}/conditions`)
      .set('Authorization', auth)
      .send({
        validFrom: desde,
        amountMode: 'FIXED',
        baseAmount: '99000',
        frequency: 'MONTHLY',
        dueDayOfMonth: 10,
        changeReason: 'Aumento',
      })
      .expect(201);

    const despues = await ciclosDe(id);

    // Los periodos que ya existian conservan su identidad: mismo id, mismo
    // periodo. Un cambio de tarifa no reescribe el pasado.
    const idsAntes = antes.map((c) => c.id).sort();
    const idsDespues = despues.map((c) => c.id);
    for (const idAnterior of idsAntes) {
      expect(idsDespues).toContain(idAnterior);
    }
  });
});
