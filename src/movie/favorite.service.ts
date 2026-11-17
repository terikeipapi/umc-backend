import { Inject, Injectable } from '@nestjs/common';
import type { RowDataPacket } from 'mysql2/promise';
import { DatabaseService } from '../database/database.service.js';
import { MemberService } from './member.service.js';

@Injectable()
export class FavoriteService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(MemberService) private readonly members: MemberService,
  ) {}

  async getFavorites(memberId: number): Promise<{ movieId: number }[]> {
    await this.members.requireMember(memberId);
    const [rows] = await this.db.pool.execute<RowDataPacket[]>(
      'SELECT movie_id FROM favorite WHERE member_id = ? ORDER BY favorite_id DESC',
      [memberId],
    );
    return rows.map((row) => ({ movieId: Number(row.movie_id) }));
  }

  async getFavorite(memberId: number, movieId: number) {
    await this.members.requireMember(memberId);
    const [rows] = await this.db.pool.execute<RowDataPacket[]>(
      'SELECT favorite_id FROM favorite WHERE member_id = ? AND movie_id = ? LIMIT 1',
      [memberId, movieId],
    );
    return { movieId, isFavorite: rows.length > 0 };
  }

  async addFavorite(memberId: number, movieId: number) {
    await this.members.requireMember(memberId);
    // The unique pair and upsert also make simultaneous or retried adds safe.
    await this.db.pool.execute(
      'INSERT INTO favorite (member_id, movie_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE movie_id = VALUES(movie_id)',
      [memberId, movieId],
    );
    return { movieId, isFavorite: true };
  }

  async deleteFavorite(memberId: number, movieId: number): Promise<void> {
    await this.members.requireMember(memberId);
    // Repeat removals succeed; ownership is part of the actual write predicate.
    await this.db.pool.execute(
      'DELETE FROM favorite WHERE member_id = ? AND movie_id = ?',
      [memberId, movieId],
    );
  }
}
