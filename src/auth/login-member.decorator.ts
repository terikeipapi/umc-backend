import { createParamDecorator, HttpStatus } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { ApiException } from '../exception/api.exception.js';
import type { AuthenticatedRequest } from './jwt-auth.guard.js';

/** Read only the identity established by JwtAuthGuard, never a client field. */
export const LoginMember = createParamDecorator(
  (_data: unknown, context: ExecutionContext): number => {
    const { memberId } = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();
    if (!Number.isSafeInteger(memberId) || (memberId ?? 0) < 1) {
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        'AUTH401_2',
        '로그인이 필요한 요청입니다.',
      );
    }
    return memberId as number;
  },
);
