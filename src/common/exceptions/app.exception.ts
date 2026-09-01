import { HttpException, HttpStatus } from '@nestjs/common';

export class AppException extends HttpException {
  constructor(
    message = 'Invalid request',
    statusCode = HttpStatus.BAD_REQUEST,
    public readonly code = 'APP_ERROR',
  ) {
    super({ statusCode, code, message }, statusCode);
  }
}
