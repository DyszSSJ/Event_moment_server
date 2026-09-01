import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

type ErrorResponse = {
  statusCode: number;
  code: string;
  message: string | string[];
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = isHttpException ? exception.getResponse() : null;
    const body = this.normalizeResponse(statusCode, exceptionResponse);

    if (statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(statusCode).json(body);
  }

  private normalizeResponse(
    statusCode: number,
    exceptionResponse: string | object | null,
  ): ErrorResponse {
    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const response = exceptionResponse as Partial<ErrorResponse>;

      return {
        statusCode,
        code: response.code ?? this.defaultCode(statusCode),
        message: response.message ?? this.defaultMessage(statusCode),
      };
    }

    return {
      statusCode,
      code: this.defaultCode(statusCode),
      message:
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : this.defaultMessage(statusCode),
    };
  }

  private defaultCode(statusCode: number) {
    if (statusCode === Number(HttpStatus.BAD_REQUEST)) {
      return 'VALIDATION_ERROR';
    }

    if (statusCode >= 500) {
      return 'INTERNAL_SERVER_ERROR';
    }

    return 'REQUEST_ERROR';
  }

  private defaultMessage(statusCode: number) {
    if (statusCode >= 500) {
      return 'Internal server error';
    }

    return 'Invalid request';
  }
}
