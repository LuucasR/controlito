import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { AppException } from './app-exception';

/** Cuerpo de error según RFC 9457, extendido con `code` estable y `traceId`. */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  code: string;
  instance: string;
  traceId?: string;
  errors?: Array<{ path: string; code: string; message: string }>;
}

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const esApp = exception instanceof AppException;
    const esHttp = exception instanceof HttpException;
    const status = esHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    // Los errores inesperados nunca exponen el stack al cliente: solo van al
    // log, correlacionables por traceId.
    if (!esHttp) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    const title = esHttp ? exception.message : 'Error interno del servidor';
    const code = esApp ? exception.code : esHttp ? httpCodeFor(status) : 'INTERNAL_ERROR';

    const problem: ProblemDetails = {
      type: `https://controlito.app/errors/${code.toLowerCase().replace(/_/g, '-')}`,
      title,
      status,
      code,
      instance: request.url,
      traceId: (request.headers['x-request-id'] as string | undefined) ?? undefined,
      ...(esApp && exception.detail ? { detail: exception.detail } : {}),
      ...(esApp && exception.errors ? { errors: exception.errors } : {}),
    };

    response.status(status).type('application/problem+json').send(problem);
  }
}

function httpCodeFor(status: number): string {
  const map: Record<number, string> = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    422: 'UNPROCESSABLE_ENTITY',
    429: 'TOO_MANY_REQUESTS',
  };
  return map[status] ?? 'HTTP_ERROR';
}
