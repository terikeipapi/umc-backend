import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hashSync } from 'bcrypt';
import { randomBytes } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { DatabaseService } from '../database/database.service.js';
import { ApiException } from '../exception/api.exception.js';
import type { LoginRequestDto } from './dto/login-request.dto.js';

interface LoginMemberRow extends RowDataPacket {
  member_id: number;
  email: string;
  password: string;
  nickname: string;
}

// A missing account still performs one cost-10 password comparison. This random
// hash is unrelated to any account and is never used to create a valid login.
const dummyPasswordHash = hashSync(randomBytes(32).toString('hex'), 10);

@Injectable()
export class AuthService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(JwtService) private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginRequestDto) {
    const [rows] = await this.db.pool.execute<LoginMemberRow[]>(
      'SELECT member_id, email, password, nickname FROM member WHERE email = ? LIMIT 1',
      [dto.email],
    );
    const member = rows[0];
    const matched = await compare(
      dto.password,
      member?.password ?? dummyPasswordHash,
    );
    if (!member || !matched) {
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        'AUTH401_1',
        '이메일 또는 비밀번호가 올바르지 않습니다.',
      );
    }

    const accessToken = await this.jwt.signAsync({
      sub: String(member.member_id),
      email: member.email,
    });
    return { nickname: member.nickname, accessToken };
  }
}
