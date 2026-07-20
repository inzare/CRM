import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface ExceptionBody {
  code?: string;
  message?: string | string[];
  details?: Record<string, string[]>;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw = exception instanceof HttpException ? exception.getResponse() : undefined;
    const body = typeof raw === 'object' && raw !== null ? (raw as ExceptionBody) : {};
    const validationMessages = Array.isArray(body.message) ? body.message : undefined;

    response.status(status).json({
      code:
        body.code ??
        (status === 400
          ? 'VALIDATION_ERROR'
          : status === 500
            ? 'INTERNAL_ERROR'
            : `HTTP_${status}`),
      message:
        status === 500
          ? 'An unexpected error occurred.'
          : validationMessages
            ? 'The request is invalid.'
            : (body.message ?? 'Request failed.'),
      requestId: request.id,
      ...(validationMessages ? { details: { fields: validationMessages } } : {}),
      ...(body.details ? { details: body.details } : {}),
    });
  }
}
