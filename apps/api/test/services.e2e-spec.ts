import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Harness, requiereBase, type Sesion } from './support/app-harness';

interface Condicion {
  id: string;
  validFrom: string;
  validTo: string | null;
  baseAmount: string | null;
  changeReason: string | null;
}

interface Servicio {
  id: string;
  name: string;
  providerName: string | null;
  startDate: string;
  currentCondition: Condicion | null;
  conditions?: Condicion[];
  category: { name: string } | null;
}

describe.skipIf(requiereBase)('Servicios y condiciones (e2e)', () => {
  let h: Harness;
  let sesion: Sesion;
  let auth: string;
  let categoriaInternet: string;

  beforeAll(async () => {
    h = await Harness.iniciar();
    sesion = await h.registrarUsuario('servicios');
    auth = `Bearer ${sesion.accessToken}`;

    const cats = await request(h.server)
      .get('/api/v1/categories')
      .set('Authorization', auth)
      .expect(200);

    const lista = cats.body as Array<{ id: string; slug: string }>;
    categoriaInternet = lista.find((c) => c.slug === 'internet')!.id;
  });

  afterAll(async () => {
    await h.limpiar();
  });

  const crearMovistar = async () => {
    const res = await request(h.server)
      .post('/api/v1/services')
      .set('Authorization', auth)
      .send({
        name: 'Internet Fibra 600 MB',
        providerName: 'Movistar',
        categoryId: categoriaInternet,
        startDate: '2026-09-01',
        debtPolicy: 'ACCUMULATES_INTO_NEXT_INVOICE',
        condition: {
          validFrom: '2026-09-01',
          amountMode: 'FIXED',
          baseAmount: '25000',
          frequency: 'MONTHLY',
          dueDayOfMonth: 10,
          interestModel: 'MONTHLY_PERCENT',
          interestParams: { rate: '5.0', graceDays: 0 },
          changeReason: 'Promoción telefónica inicial',
        },
      })
      .expect(201);

    return res.body as Servicio;
  };

  it('crea el servicio con su condición inicial', async () => {
    const servicio = await crearMovistar();

    expect(servicio.name).toBe('Internet Fibra 600 MB');
    expect(servicio.providerName).toBe('Movistar');
    expect(servicio.category?.name).toBe('Internet');
    expect(servicio.currentCondition?.baseAmount).toBe('25000.00');
  });

  it('la fecha no se corre un día al ir y volver de la base', async () => {
    // El bug clásico: guardar 2026-09-01 y que vuelva 2026-08-31 porque el
    // servidor está en UTC y el usuario en UTC-3.
    const servicio = await crearMovistar();

    expect(servicio.startDate).toBe('2026-09-01');
    expect(servicio.currentCondition?.validFrom).toBe('2026-09-01');
  });

  it('el monto viaja como texto, no como número', async () => {
    const servicio = await crearMovistar();
    expect(typeof servicio.currentCondition?.baseAmount).toBe('string');
  });

  it('exige el monto cuando la condición es de monto fijo', async () => {
    const res = await request(h.server)
      .post('/api/v1/services')
      .set('Authorization', auth)
      .send({
        name: 'Sin monto',
        startDate: '2026-09-01',
        condition: { validFrom: '2026-09-01', amountMode: 'FIXED', dueDayOfMonth: 10 },
      })
      .expect(422);

    // La ruta del error incluye el prefijo del campo anidado, para que el
    // formulario sepa exactamente que campo marcar en rojo.
    expect((res.body as { errors: Array<{ path: string }> }).errors[0]?.path).toBe(
      'condition.baseAmount',
    );
  });

  it('rechaza una categoría que no existe', async () => {
    const res = await request(h.server)
      .post('/api/v1/services')
      .set('Authorization', auth)
      .send({
        name: 'X',
        startDate: '2026-09-01',
        categoryId: '00000000-0000-4000-8000-999999999999',
      })
      .expect(404);

    expect((res.body as { code: string }).code).toBe('CATEGORY_NOT_FOUND');
  });

  describe('historial de condiciones', () => {
    it('agregar una condición CIERRA la anterior en vez de pisarla', async () => {
      const servicio = await crearMovistar();

      // Termina la promoción: pasa a valer $35.000 desde marzo.
      const res = await request(h.server)
        .post(`/api/v1/services/${servicio.id}/conditions`)
        .set('Authorization', auth)
        .send({
          validFrom: '2027-03-01',
          amountMode: 'FIXED',
          baseAmount: '35000',
          frequency: 'MONTHLY',
          dueDayOfMonth: 10,
          changeReason: 'Fin de promoción',
        })
        .expect(201);

      const actualizado = res.body as Servicio;
      const historial = actualizado.conditions!;

      expect(historial).toHaveLength(2);

      // La vieja sigue existiendo, ahora con fecha de fin: el historial queda
      // completo y se puede saber qué regía en cada período.
      const vieja = historial.find((c) => c.baseAmount === '25000.00')!;
      expect(vieja.validFrom).toBe('2026-09-01');
      expect(vieja.validTo).toBe('2027-03-01');

      const nueva = historial.find((c) => c.baseAmount === '35000.00')!;
      expect(nueva.validTo).toBeNull();
      expect(actualizado.currentCondition?.baseAmount).toBe('35000.00');
    });

    it('rechaza dos condiciones que empiezan el mismo día', async () => {
      const servicio = await crearMovistar();

      const res = await request(h.server)
        .post(`/api/v1/services/${servicio.id}/conditions`)
        .set('Authorization', auth)
        .send({
          validFrom: '2026-09-01',
          amountMode: 'FIXED',
          baseAmount: '1',
          dueDayOfMonth: 10,
        })
        .expect(409);

      expect((res.body as { code: string }).code).toBe('CONDITION_DATE_TAKEN');
    });

    it('rechaza insertar una condición anterior a la última', async () => {
      const servicio = await crearMovistar();

      await request(h.server)
        .post(`/api/v1/services/${servicio.id}/conditions`)
        .set('Authorization', auth)
        .send({
          validFrom: '2027-03-01',
          amountMode: 'FIXED',
          baseAmount: '35000',
          dueDayOfMonth: 10,
        })
        .expect(201);

      // Meterla en el medio obligaría a recalcular períodos ya facturados.
      const res = await request(h.server)
        .post(`/api/v1/services/${servicio.id}/conditions`)
        .set('Authorization', auth)
        .send({
          validFrom: '2026-11-01',
          amountMode: 'FIXED',
          baseAmount: '30000',
          dueDayOfMonth: 10,
        })
        .expect(409);

      expect((res.body as { code: string }).code).toBe('CONDITION_OUT_OF_ORDER');
    });
  });

  it('archiva sin borrar: sigue existiendo pero sale de la lista', async () => {
    const servicio = await crearMovistar();

    await request(h.server)
      .delete(`/api/v1/services/${servicio.id}`)
      .set('Authorization', auth)
      .expect(204);

    const lista = await request(h.server)
      .get('/api/v1/services')
      .set('Authorization', auth)
      .expect(200);
    expect((lista.body as Servicio[]).some((s) => s.id === servicio.id)).toBe(false);

    // Pero no se borró: su historial financiero no se falsea.
    const conArchivados = await request(h.server)
      .get('/api/v1/services?incluirArchivados=true')
      .set('Authorization', auth)
      .expect(200);
    expect((conArchivados.body as Servicio[]).some((s) => s.id === servicio.id)).toBe(true);
  });
});
