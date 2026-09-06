declare const marcaTenant: unique symbol;

/**
 * Identidad verificada del usuario que hace el pedido.
 *
 * Es un tipo "marcado": no se puede construir escribiendo `{ userId }` a mano.
 * La única fábrica es `crearTenantContext`, que solo debe llamar el guard de
 * autenticación después de verificar la firma del token.
 *
 * Consecuencia práctica: todo repositorio que toque datos de un usuario recibe
 * un `TenantContext` como PRIMER argumento, y el compilador impide olvidarse
 * del filtro por usuario, porque sin este objeto la función no compila.
 */
export interface TenantContext {
  readonly [marcaTenant]: true;
  readonly userId: string;
}

/** Solo debe invocarla el guard de autenticación, con un token ya verificado. */
export function crearTenantContext(userId: string): TenantContext {
  return { userId } as unknown as TenantContext;
}
