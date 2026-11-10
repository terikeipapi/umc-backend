import { HttpException, HttpStatus } from '@nestjs/common';

/** Carry the workbook's domain error code through the existing response filter. */
export class ApiException extends HttpException {
  constructor(
    status: HttpStatus,
    public readonly code: string,
    message: string,
  ) {
    super({ code, message }, status);
  }
}
