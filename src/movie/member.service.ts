import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hash } from 'bcrypt';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { DatabaseService } from '../database/database.service.js';
import type { CreateMemberDto } from './dto/create-member.dto.js';

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
      'INSERT INTO member (email, password, nickname) VALUES (?, ?, ?)',
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
      throw new NotFoundException({
        code: 'MEMBER4041',
        message: '존재하지 않는 유저입니다.',
      });
    }
  }
}
