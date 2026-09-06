import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Harness } from './support/app-harness';

describe('Autenticación (e2e)', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await Harness.iniciar();
  });

  afterAll(async () => {
    await h.limpiar();
  });

  describe('registro', () => {
    it('crea la cuenta y devuelve una sesión utilizable', async () => {
      const sesion = await h.registrarUsuario('registro');

      expect(sesion.accessToken).toBeTruthy();
      expect(sesion.refreshToken).toHaveLength(64);

      await request(h.server)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${sesion.accessToken}`)
        .expect(200);
    });

    it('rechaza un email ya registrado, sin filtrar más información', async () => {
      const sesion = await h.registrarUsuario('duplicado');

      const res = await request(h.server)
        .post('/api/v1/auth/register')
        .send({ email: sesion.email, password: 'otra-contrasena-larga' })
        .expect(409);

      expect((res.body as { code: string }).code).toBe('EMAIL_ALREADY_REGISTERED');
    });

    it('normaliza el email: mayúsculas y espacios no crean cuentas distintas', async () => {
      const sesion = await h.registrarUsuario('normaliza');

      await request(h.server)
        .post('/api/v1/auth/register')
        .send({ email: `  ${sesion.email.toUpperCase()} `, password: 'contrasena-larga-123' })
        .expect(409);
    });

    it('exige una contraseña de al menos 10 caracteres', async () => {
      const res = await request(h.server)
        .post('/api/v1/auth/register')
        .send({ email: 'corta@controlito.test', password: 'corta' })
        .expect(422);

      const body = res.body as { code: string; errors?: Array<{ path: string }> };
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.errors?.[0]?.path).toBe('password');
    });

    it('rechaza campos desconocidos, que delatan un cliente desalineado', async () => {
      await request(h.server)
        .post('/api/v1/auth/register')
        .send({ email: 'x@controlito.test', password: 'contrasena-larga-123', esAdmin: true })
        .expect(422);
    });
  });

  describe('login', () => {
    it('devuelve el mismo error para email inexistente que para contraseña incorrecta', async () => {
      const sesion = await h.registrarUsuario('login');

      const contrasenaMal = await request(h.server)
        .post('/api/v1/auth/login')
        .send({ email: sesion.email, password: 'contrasena-incorrecta' })
        .expect(401);

      const emailInexistente = await request(h.server)
        .post('/api/v1/auth/login')
        .send({ email: 'no-existe@controlito.test', password: 'contrasena-incorrecta' })
        .expect(401);

      // Si los mensajes difirieran, se podría averiguar qué emails tienen cuenta.
      expect((contrasenaMal.body as { code: string }).code).toBe('INVALID_CREDENTIALS');
      expect((emailInexistente.body as { code: string }).code).toBe('INVALID_CREDENTIALS');
      expect((contrasenaMal.body as { title: string }).title).toBe(
        (emailInexistente.body as { title: string }).title,
      );
    });

    it('acepta las credenciales correctas', async () => {
      const sesion = await h.registrarUsuario('login-ok');

      await request(h.server)
        .post('/api/v1/auth/login')
        .send({ email: sesion.email, password: 'contrasena-de-prueba-123' })
        .expect(200);
    });
  });

  describe('rutas protegidas', () => {
    it('sin token responde 401 con code MISSING_TOKEN', async () => {
      const res = await request(h.server).get('/api/v1/auth/me').expect(401);
      expect((res.body as { code: string }).code).toBe('MISSING_TOKEN');
    });

    it('con un token inventado responde 401 con code INVALID_TOKEN', async () => {
      const res = await request(h.server)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer esto.no.es-un-token')
        .expect(401);

      expect((res.body as { code: string }).code).toBe('INVALID_TOKEN');
    });

    it('el health check sigue siendo público pese al guard global', async () => {
      await request(h.server).get('/api/v1/health').expect(200);
    });
  });
});
