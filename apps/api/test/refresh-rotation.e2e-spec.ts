import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Harness } from './support/app-harness';

interface RespuestaTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

describe('Rotación de refresh tokens (e2e)', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await Harness.iniciar();
  });

  afterAll(async () => {
    await h.limpiar();
  });

  it('cada refresh devuelve un token nuevo y distinto', async () => {
    const sesion = await h.registrarUsuario('rotacion');

    const res = await request(h.server)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: sesion.refreshToken })
      .expect(200);

    const nuevos = res.body as RespuestaTokens;
    expect(nuevos.refreshToken).not.toBe(sesion.refreshToken);
    expect(nuevos.accessToken).toBeTruthy();
  });

  it('el token rotado sirve para acceder a rutas protegidas', async () => {
    const sesion = await h.registrarUsuario('rotacion-usa');

    const res = await request(h.server)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: sesion.refreshToken })
      .expect(200);

    await request(h.server)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${(res.body as RespuestaTokens).accessToken}`)
      .expect(200);
  });

  it('reutilizar un token ya consumido revoca TODA la familia', async () => {
    const sesion = await h.registrarUsuario('robo');

    // Rotación legítima: el token original queda consumido.
    const primera = await request(h.server)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: sesion.refreshToken })
      .expect(200);
    const vigente = (primera.body as RespuestaTokens).refreshToken;

    // Un atacante que copió el token original intenta usarlo.
    const reuso = await request(h.server)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: sesion.refreshToken })
      .expect(401);

    expect((reuso.body as { code: string }).code).toBe('REFRESH_TOKEN_REUSED');

    // Y lo importante: el token que SÍ era válido también queda inutilizado.
    // Ante un robo no se puede saber quién es el legítimo, así que caen los dos
    // y la persona vuelve a iniciar sesión.
    const victima = await request(h.server)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: vigente })
      .expect(401);

    expect((victima.body as { code: string }).code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('el logout invalida el refresh token', async () => {
    const sesion = await h.registrarUsuario('logout');

    await request(h.server)
      .post('/api/v1/auth/logout')
      .send({ refreshToken: sesion.refreshToken })
      .expect(204);

    await request(h.server)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: sesion.refreshToken })
      .expect(401);
  });

  it('un refresh token inventado no sirve', async () => {
    await request(h.server)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'a'.repeat(64) })
      .expect(401);
  });
});
