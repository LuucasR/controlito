import { SetMetadata } from '@nestjs/common';

export const CLAVE_RUTA_PUBLICA = 'ruta_publica';

/**
 * Marca una ruta como accesible sin token.
 *
 * El guard es GLOBAL: una ruta nueva está protegida por omisión y hay que
 * abrirla a propósito. Es la única configuración segura — al revés, olvidarse
 * de proteger una ruta no da ningún síntoma hasta que se filtran datos.
 */
export const Publico = () => SetMetadata(CLAVE_RUTA_PUBLICA, true);
