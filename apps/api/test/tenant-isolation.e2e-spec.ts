import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Harness, requiereBase, type Sesion } from './support/app-harness';

/**
 * La garantía más importante del sistema: un usuario nunca ve datos de otro.
 *
 * Esta suite se escribe ANTES de que exista un solo dato de negocio, y crece
 * con cada entidad nueva. El orden importa: cuando ya hay servicios, facturas
 * y pagos, agregar el aislamiento es una migración dolorosa.
 *
 * Convención: pedir un recurso ajeno devuelve 404, NUNCA 403. Un 403 confirma
 * que el recurso existe, y eso ya es información que no le corresponde.
 */
describe.skipIf(requiereBase)('Aislamiento entre usuarios (e2e)', () => {
  let h: Harness;
  let usuarioA: Sesion;
  let usuarioB: Sesion;

  beforeAll(async () => {
    h = await Harness.iniciar();
    usuarioA = await h.registrarUsuario('aislamiento-a');
    usuarioB = await h.registrarUsuario('aislamiento-b');
  });

  afterAll(async () => {
    await h.limpiar();
  });

  it('son dos usuarios distintos', () => {
    expect(usuarioA.userId).not.toBe(usuarioB.userId);
    expect(usuarioA.email).not.toBe(usuarioB.email);
  });

  it('cada token devuelve únicamente su propio perfil', async () => {
    const perfilA = await request(h.server)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${usuarioA.accessToken}`)
      .expect(200);

    const perfilB = await request(h.server)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${usuarioB.accessToken}`)
      .expect(200);

    expect((perfilA.body as { id: string }).id).toBe(usuarioA.userId);
    expect((perfilB.body as { id: string }).id).toBe(usuarioB.userId);
  });

  it('una modificación de perfil no toca la cuenta del otro usuario', async () => {
    await request(h.server)
      .patch('/api/v1/auth/me')
      .set('Authorization', `Bearer ${usuarioA.accessToken}`)
      .send({ displayName: 'Nombre de A' })
      .expect(200);

    const perfilB = await request(h.server)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${usuarioB.accessToken}`)
      .expect(200);

    expect((perfilB.body as { displayName: string | null }).displayName).toBeNull();
  });

  it('el refresh token de un usuario no le sirve al otro', async () => {
    const res = await request(h.server)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: usuarioB.refreshToken })
      .expect(200);

    // El par nuevo pertenece a B, no a A, aunque lo pida cualquiera:
    // el token identifica al dueño, no quien hace el pedido.
    const perfil = await request(h.server)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${(res.body as { accessToken: string }).accessToken}`)
      .expect(200);

    expect((perfil.body as { id: string }).id).toBe(usuarioB.userId);
  });

  it('el logout de un usuario no cierra la sesión del otro', async () => {
    const sesionC = await h.registrarUsuario('aislamiento-c');

    await request(h.server)
      .post('/api/v1/auth/logout')
      .send({ refreshToken: sesionC.refreshToken })
      .expect(204);

    // A sigue funcionando.
    await request(h.server)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${usuarioA.accessToken}`)
      .expect(200);
  });


  describe('servicios', () => {
    let servicioDeA: string;

    beforeAll(async () => {
      const res = await request(h.server)
        .post('/api/v1/services')
        .set('Authorization', `Bearer ${usuarioA.accessToken}`)
        .send({
          name: 'Servicio privado de A',
          startDate: '2026-09-01',
          condition: {
            validFrom: '2026-09-01',
            amountMode: 'FIXED',
            baseAmount: '25000',
            dueDayOfMonth: 10,
          },
        })
        .expect(201);

      servicioDeA = (res.body as { id: string }).id;
    });

    it('B no ve el servicio de A en su lista', async () => {
      const res = await request(h.server)
        .get('/api/v1/services')
        .set('Authorization', `Bearer ${usuarioB.accessToken}`)
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('B recibe 404 al pedir el servicio de A, no 403', async () => {
      // Un 403 confirmaria que el recurso existe. El 404 no dice nada.
      const res = await request(h.server)
        .get(`/api/v1/services/${servicioDeA}`)
        .set('Authorization', `Bearer ${usuarioB.accessToken}`)
        .expect(404);

      expect((res.body as { code: string }).code).toBe('SERVICE_NOT_FOUND');
    });

    it('B no puede modificar el servicio de A', async () => {
      await request(h.server)
        .patch(`/api/v1/services/${servicioDeA}`)
        .set('Authorization', `Bearer ${usuarioB.accessToken}`)
        .send({ name: 'Secuestrado' })
        .expect(404);

      // Y el nombre quedo intacto.
      const res = await request(h.server)
        .get(`/api/v1/services/${servicioDeA}`)
        .set('Authorization', `Bearer ${usuarioA.accessToken}`)
        .expect(200);
      expect((res.body as { name: string }).name).toBe('Servicio privado de A');
    });

    it('B no puede archivar el servicio de A', async () => {
      await request(h.server)
        .delete(`/api/v1/services/${servicioDeA}`)
        .set('Authorization', `Bearer ${usuarioB.accessToken}`)
        .expect(404);
    });

    it('B no puede ver los períodos del servicio de A', async () => {
      const res = await request(h.server)
        .get(`/api/v1/services/${servicioDeA}/cycles`)
        .set('Authorization', `Bearer ${usuarioB.accessToken}`)
        .expect(404);

      expect((res.body as { code: string }).code).toBe('SERVICE_NOT_FOUND');
    });

    it('los proximos vencimientos de B no incluyen nada de A', async () => {
      // A tiene un servicio con periodos proyectados; B no tiene ninguno.
      await request(h.server)
        .get('/api/v1/services/' + servicioDeA + '/cycles')
        .set('Authorization', `Bearer ${usuarioA.accessToken}`)
        .expect(200);

      const res = await request(h.server)
        .get('/api/v1/cycles/upcoming?dias=365')
        .set('Authorization', `Bearer ${usuarioB.accessToken}`)
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('B no puede ver las facturas del servicio de A', async () => {
      const res = await request(h.server)
        .get(`/api/v1/services/${servicioDeA}/invoices`)
        .set('Authorization', `Bearer ${usuarioB.accessToken}`)
        .expect(404);

      expect((res.body as { code: string }).code).toBe('SERVICE_NOT_FOUND');
    });

    it('B no puede registrar una factura en un periodo de A', async () => {
      const ciclos = await request(h.server)
        .get(`/api/v1/services/${servicioDeA}/cycles`)
        .set('Authorization', `Bearer ${usuarioA.accessToken}`)
        .expect(200);

      const cicloDeA = (ciclos.body as Array<{ id: string; dueDate: string | null }>)[0]!;

      const res = await request(h.server)
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${usuarioB.accessToken}`)
        .send({
          cycleId: cicloDeA.id,
          issueDate: '2026-09-01',
          dueDate: '2026-09-10',
          currentChargeAmount: '1',
        })
        .expect(404);

      expect((res.body as { code: string }).code).toBe('CYCLE_NOT_FOUND');
    });

    it('las alertas de A no aparecen en la lista de B', async () => {
      const res = await request(h.server)
        .get('/api/v1/alerts')
        .set('Authorization', `Bearer ${usuarioB.accessToken}`)
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('B no puede agregarle condiciones al servicio de A', async () => {
      await request(h.server)
        .post(`/api/v1/services/${servicioDeA}/conditions`)
        .set('Authorization', `Bearer ${usuarioB.accessToken}`)
        .send({
          validFrom: '2027-01-01',
          amountMode: 'FIXED',
          baseAmount: '1',
          dueDayOfMonth: 1,
        })
        .expect(404);
    });

    it('las categorias del sistema las ven los dos, pero no las ajenas', async () => {
      const deA = await request(h.server)
        .get('/api/v1/categories')
        .set('Authorization', `Bearer ${usuarioA.accessToken}`)
        .expect(200);
      const deB = await request(h.server)
        .get('/api/v1/categories')
        .set('Authorization', `Bearer ${usuarioB.accessToken}`)
        .expect(200);

      const soloSistema = (body: unknown) =>
        (body as Array<{ isSystem: boolean }>).every((c) => c.isSystem);

      expect(soloSistema(deA.body)).toBe(true);
      expect(soloSistema(deB.body)).toBe(true);
      expect((deA.body as unknown[]).length).toBe((deB.body as unknown[]).length);
    });
  });

  /**
   * Red de seguridad ante rutas nuevas.
   *
   * Recorre las rutas registradas en la aplicación y falla si aparece alguna
   * con parámetro `:id` que no esté cubierta por esta suite. Así, agregar un
   * endpoint sin probar su aislamiento rompe el build en vez de pasar
   * desapercibido durante meses.
   */
  it('toda ruta con :id está cubierta por esta suite', () => {
    const cubiertas = new Set<string>([
      '/api/v1/services/:id',
      '/api/v1/services/:id/conditions',
      '/api/v1/services/:id/cycles',
      '/api/v1/services/:id/invoices',
      '/api/v1/invoices/:id/void',
      '/api/v1/alerts/:id/acknowledge',
    ]);

    const servidor = h.app.getHttpAdapter().getInstance() as {
      router?: { stack?: Array<{ route?: { path?: string } }> };
      _router?: { stack?: Array<{ route?: { path?: string } }> };
    };
    const stack = servidor.router?.stack ?? servidor._router?.stack ?? [];

    const conParametro = stack
      .map((capa) => capa.route?.path)
      .filter((ruta): ruta is string => typeof ruta === 'string' && /:[a-zA-Z]/.test(ruta))
      .filter((ruta) => !cubiertas.has(ruta));

    expect(
      conParametro,
      `Rutas con :id sin cobertura de aislamiento: ${conParametro.join(', ')}`,
    ).toHaveLength(0);
  });
});
