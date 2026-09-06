import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Harness, type Sesion } from './support/app-harness';

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
describe('Aislamiento entre usuarios (e2e)', () => {
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
      // Se completa a medida que aparezcan rutas con :id (Etapa 2 en adelante).
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
