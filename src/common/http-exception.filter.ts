import { Catch, HttpException, Logger } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';

/** A single response boundary for validation, business and database failures. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    let status = 500;
    let code = 'COMMON500';
    let message = '서버 내부 오류가 발생했습니다.';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      const details = typeof body === 'string' ? { message: body } : body;
      const fields = details as { message?: string | string[]; code?: string };
      code = fields.code ?? (status === 400 ? 'COMMON4001' : `COMMON${status}`);
      message = Array.isArray(fields.message)
        ? fields.message[0]
        : (fields.message ?? exception.message);
    } else {
      const candidate = exception as {
        code?: string;
        errno?: number;
        sqlMessage?: string;
        message?: string;
        driverError?: unknown;
      } | null;
      const db = (candidate?.driverError ?? candidate) as typeof candidate;
      if (db?.code === 'ER_DUP_ENTRY' || db?.errno === 1062) {
        status = 409;
        // Inspect only the key suffix, never return raw SQL or input values.
        const key = /for key ['`]([^'`]+)['`]\s*$/iu
          .exec(db.sqlMessage ?? db.message ?? '')?.[1]
          .split('.')
          .at(-1);
        const conflicts: Record<string, [string, string]> = {
          uq_member_email: ['MEMBER4091', '이미 사용 중인 이메일입니다.'],
          uq_member_nickname: ['MEMBER4092', '이미 사용 중인 닉네임입니다.'],
          uq_rating_member_movie: [
            'RATING4091',
            '이미 이 영화에 평점을 남기셨습니다.',
          ],
        };
        [code, message] = conflicts[key ?? ''] ?? [
          'COMMON4091',
          '이미 존재하는 데이터입니다.',
        ];
      } else if (db?.errno === 1452 || db?.code === 'ER_NO_REFERENCED_ROW_2') {
        status = 409;
        code = 'COMMON4092';
        message = '참조 대상이 존재하지 않습니다.';
      } else if (db?.errno === 3819 || db?.errno === 4025) {
        status = 400;
        code = 'COMMON4001';
        message = '입력값이 데이터베이스 제약 조건을 만족하지 않습니다.';
      } else {
        // Error objects may contain SQL and passwords. Keep those out of logs.
        this.logger.error('An unexpected request error occurred.');
      }
    }

    response
      .status(status)
      .json({ isSuccess: false, code, message, result: null });
  }
}
