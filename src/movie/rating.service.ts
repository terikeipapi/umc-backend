import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { DatabaseService } from '../database/database.service.js';
import type { CreateRatingDto } from './dto/create-rating.dto.js';
import type { UpdateRatingDto } from './dto/update-rating.dto.js';
import type { RatingResponseDto } from './dto/rating-response.dto.js';
import { MemberService } from './member.service.js';

@Injectable()
export class RatingService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(MemberService) private readonly members: MemberService,
  ) {}

  async getRatingsByMember(memberId: number) {
    await this.members.requireMember(memberId);
    const [rows] = await this.db.pool.execute<RowDataPacket[]>(
      'SELECT rating_id, member_id, movie_id, score, comment FROM rating WHERE member_id = ? ORDER BY rating_id DESC',
      [memberId],
    );
    return rows.map((row) => ({
      ratingId: Number(row.rating_id),
      memberId: Number(row.member_id),
      movieId: Number(row.movie_id),
      score: Number(row.score),
      comment: row.comment as string | null,
    }));
  }

  async create(
    memberId: number,
    dto: CreateRatingDto,
  ): Promise<RatingResponseDto> {
    await this.members.requireMember(memberId);
    const [existing] = await this.db.pool.execute<RowDataPacket[]>(
      'SELECT rating_id FROM rating WHERE member_id = ? AND movie_id = ? LIMIT 1',
      [memberId, dto.movieId],
    );
    if (existing.length) {
      throw new ConflictException({
        code: 'RATING409_1',
        message: '이미 이 영화에 평점을 남기셨습니다.',
      });
    }
    const [saved] = await this.db.pool.execute<ResultSetHeader>(
      'INSERT INTO rating (member_id, movie_id, score, comment) VALUES (?, ?, ?, ?)',
      [memberId, dto.movieId, dto.score, dto.comment ?? null],
    );
    return {
      ratingId: saved.insertId,
      memberId,
      movieId: dto.movieId,
      score: dto.score,
      comment: dto.comment ?? null,
    };
  }

  async update(
    memberId: number,
    ratingId: number,
    dto: UpdateRatingDto,
  ): Promise<RatingResponseDto> {
    const rating = await this.requireOwnedRating(ratingId, memberId);
    // The owner predicate also protects the actual write after the initial read.
    const [updated] = await this.db.pool.execute<ResultSetHeader>(
      'UPDATE rating SET score = ?, comment = ? WHERE rating_id = ? AND member_id = ?',
      [dto.score, dto.comment ?? null, ratingId, memberId],
    );
    if (!updated.affectedRows) this.ratingNotFound();
    return {
      ratingId,
      memberId,
      movieId: Number(rating.movie_id),
      score: dto.score,
      comment: dto.comment ?? null,
    };
  }

  async delete(memberId: number, ratingId: number): Promise<void> {
    await this.requireOwnedRating(ratingId, memberId);
    const [deleted] = await this.db.pool.execute<ResultSetHeader>(
      'DELETE FROM rating WHERE rating_id = ? AND member_id = ?',
      [ratingId, memberId],
    );
    if (!deleted.affectedRows) this.ratingNotFound();
  }

  private async requireOwnedRating(
    ratingId: number,
    memberId: number,
  ): Promise<RowDataPacket> {
    const [rows] = await this.db.pool.execute<RowDataPacket[]>(
      'SELECT rating_id, member_id, movie_id, score, comment FROM rating WHERE rating_id = ? LIMIT 1',
      [ratingId],
    );
    if (!rows.length) this.ratingNotFound();
    if (Number(rows[0].member_id) !== memberId) {
      throw new ForbiddenException({
        code: 'RATING403_1',
        message: '본인이 작성한 평점만 수정하거나 삭제할 수 있습니다.',
      });
    }
    return rows[0];
  }

  private ratingNotFound(): never {
    throw new NotFoundException({
      code: 'RATING404_1',
      message: '해당 평점을 찾을 수 없습니다.',
    });
  }
}
