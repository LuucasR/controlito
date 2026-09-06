import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Error de aplicación con un `code` estable.
 *
 * El cliente hace `switch` sobre `code`, nunca sobre el mensaje: el mensaje es
 * texto para mostrarle a la persona y puede cambiar sin previo aviso.
 */
export class AppException extends HttpException {
  constructor(
    readonly code: string,
    message: string,
    status: HttpStatus,
    readonly detail?: string,
    readonly errors?: Array<{ path: string; code: string; message: string }>,
  ) {
    super(message, status);
  }

  static badRequest(code: string, message: string, detail?: string): AppException {
    return new AppException(code, message, HttpStatus.BAD_REQUEST, detail);
  }

  static unauthorized(code: string, message: string, detail?: string): AppException {
    return new AppException(code, message, HttpStatus.UNAUTHORIZED, detail);
  }

  static notFound(code: string, message: string, detail?: string): AppException {
    return new AppException(code, message, HttpStatus.NOT_FOUND, detail);
  }

  static conflict(code: string, message: string, detail?: string): AppException {
    return new AppException(code, message, HttpStatus.CONFLICT, detail);
  }

  static validation(
    errors: Array<{ path: string; code: string; message: string }>,
  ): AppException {
    return new AppException(
      'VALIDATION_ERROR',
      'Los datos enviados no son válidos',
      HttpStatus.UNPROCESSABLE_ENTITY,
      undefined,
      errors,
    );
  }
}
