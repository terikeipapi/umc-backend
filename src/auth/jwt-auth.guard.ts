import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService, TokenExpiredError } from '@nestjs/jwt';
import type { Request } from 'express';
import { ApiException } from '../exception/api.exception.js';

export interface AuthenticatedRequest extends Request {
  memberId?: number;
}

interface AccessTokenClaims {
  sub?: unknown;
  email?: unknown;
  exp?: unknown;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Inject(JwtService) private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        'AUTH401_2',
        '로그인이 필요한 요청입니다.',
      );
    }

    try {
      const payload = await this.jwt.verifyAsync<AccessTokenClaims>(
        header.slice('Bearer '.length),
        { algorithms: ['HS256'] },
      );
      const memberId = Number(payload.sub);
      if (
        typeof payload.sub !== 'string' ||
        !/^[1-9]\d*$/u.test(payload.sub) ||
        !Number.isSafeInteger(memberId) ||
        typeof payload.email !== 'string' ||
        !payload.email ||
        typeof payload.exp !== 'number' ||
        !Number.isSafeInteger(payload.exp) ||
        payload.exp <= 0
      ) {
        throw new Error('Invalid access token claims');
      }
      // The subject is written only after signature, expiry and claims succeed.
      request.memberId = memberId;
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        throw new ApiException(
          HttpStatus.UNAUTHORIZED,
          'AUTH401_4',
          '토큰이 만료되었습니다. 다시 로그인해주세요.',
        );
      }
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        'AUTH401_3',
        '유효하지 않은 토큰입니다.',
      );
    }
    return true;
  }
}
