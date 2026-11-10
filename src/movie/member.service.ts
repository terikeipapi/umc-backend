import {
  ConflictException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { hash } from 'bcrypt';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { DatabaseService } from '../database/database.service.js';
import { ApiException } from '../exception/api.exception.js';
import type { CreateMemberDto } from './dto/create-member.dto.js';
import type { MemberInfoResponseDto } from './dto/member-info-response.dto.js';
import type { UpdateMemberDto } from './dto/update-member.dto.js';

@Injectable()
export class MemberService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async checkEmail(email: string) {
    const [rows] = await this.db.pool.execute<RowDataPacket[]>(
      'SELECT member_id FROM member WHERE email = ? LIMIT 1',
      [email],
    );
    return { email, exists: rows.length > 0 };
  }

  async checkNickname(nickname: string) {
    const [rows] = await this.db.pool.execute<RowDataPacket[]>(
      'SELECT member_id FROM member WHERE nickname = ? LIMIT 1',
      [nickname],
    );
    return { nickname, exists: rows.length > 0 };
  }

  async signUp(dto: CreateMemberDto) {
    if ((await this.checkEmail(dto.email)).exists) {
      throw new ConflictException({
        code: 'MEMBER4091',
        message: '이미 사용 중인 이메일입니다.',
      });
    }
    if ((await this.checkNickname(dto.nickname)).exists) {
      throw new ConflictException({
        code: 'MEMBER4092',
        message: '이미 사용 중인 닉네임입니다.',
      });
    }

    // DB UNIQUE constraints also protect requests racing after these checks.
    const passwordHash = await hash(dto.password, 10);
    const [saved] = await this.db.pool.execute<ResultSetHeader>(
      'INSERT INTO member (email, password, nickname, created_at) VALUES (?, ?, ?, UTC_TIMESTAMP(3))',
      [dto.email, passwordHash, dto.nickname],
    );
    // Only the public response fields leave this service; never return the hash.
    return {
      memberId: saved.insertId,
      email: dto.email,
      nickname: dto.nickname,
    };
  }

  async requireMember(memberId: number): Promise<void> {
    const [rows] = await this.db.pool.execute<RowDataPacket[]>(
      'SELECT member_id FROM member WHERE member_id = ? LIMIT 1',
      [memberId],
    );
    if (!rows.length) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        'MEMBER404_1',
        '해당 회원을 찾을 수 없습니다.',
      );
    }
  }

  async getMyInfo(memberId: number): Promise<MemberInfoResponseDto> {
    const [rows] = await this.db.pool.execute<RowDataPacket[]>(
      'SELECT email, nickname, created_at FROM member WHERE member_id = ? LIMIT 1',
      [memberId],
    );
    if (!rows.length) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        'MEMBER404_1',
        '해당 회원을 찾을 수 없습니다.',
      );
    }
    return {
      email: rows[0].email as string,
      nickname: rows[0].nickname as string,
      createdAt: (rows[0].created_at as Date).toISOString(),
    };
  }

  async updateMyInfo(
    memberId: number,
    dto: UpdateMemberDto,
  ): Promise<MemberInfoResponseDto> {
    const current = await this.getMyInfo(memberId);
    if (current.nickname === dto.nickname) return current;
    const [duplicates] = await this.db.pool.execute<RowDataPacket[]>(
      'SELECT member_id FROM member WHERE nickname = ? AND member_id <> ? LIMIT 1',
      [dto.nickname, memberId],
    );
    if (duplicates.length) this.nicknameConflict();
    try {
      const [updated] = await this.db.pool.execute<ResultSetHeader>(
        'UPDATE member SET nickname = ? WHERE member_id = ?',
        [dto.nickname, memberId],
      );
      if (!updated.affectedRows) {
        throw new ApiException(
          HttpStatus.NOT_FOUND,
          'MEMBER404_1',
          '해당 회원을 찾을 수 없습니다.',
        );
      }
    } catch (error) {
      const dbError = error as { code?: string; errno?: number };
      if (dbError.code === 'ER_DUP_ENTRY' || dbError.errno === 1062)
        this.nicknameConflict();
      throw error;
    }
    return { ...current, nickname: dto.nickname };
  }

  private nicknameConflict(): never {
    throw new ApiException(
      HttpStatus.CONFLICT,
      'MEMBER409_1',
      '이미 사용 중인 닉네임입니다.',
    );
  }
}
