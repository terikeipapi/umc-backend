import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ApiException } from '../exception/api.exception.js';
import type { CreateMovieRecordDto } from './dto/create-movie-record.dto.js';
import { FavoriteResponseDto } from './dto/favorite-response.dto.js';
import { MovieRecordResponseDto } from './dto/movie-record-response.dto.js';
import { Favorite } from './entities/favorite.entity.js';
import { Member } from './entities/member.entity.js';
import { Rating } from './entities/rating.entity.js';

function isDuplicateEntry(error: unknown): boolean {
  const candidate = error as {
    code?: string;
    errno?: number;
    driverError?: { code?: string; errno?: number };
  } | null;
  const databaseError = candidate?.driverError ?? candidate;
  return (
    databaseError?.code === 'ER_DUP_ENTRY' || databaseError?.errno === 1062
  );
}

@Injectable()
export class MovieRecordService {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  async create(
    memberId: number,
    dto: CreateMovieRecordDto,
  ): Promise<MovieRecordResponseDto> {
    // Every lookup and write shares this manager's transaction connection.
    // An exception must escape the callback so the earlier rating is rolled back.
    return this.dataSource.transaction(async (manager) => {
      const memberRepository = manager.getRepository(Member);
      const ratingRepository = manager.getRepository(Rating);
      const favoriteRepository = manager.getRepository(Favorite);

      const member = await memberRepository.findOneBy({ memberId });
      if (!member) {
        throw new ApiException(
          HttpStatus.NOT_FOUND,
          'MEMBER404_1',
          '해당 회원을 찾을 수 없습니다.',
        );
      }

      const where = { member: { memberId }, movieId: dto.movieId };
      if (await ratingRepository.findOne({ where })) this.ratingConflict();
      if (dto.addToFavorites && (await favoriteRepository.findOne({ where }))) {
        this.favoriteConflict();
      }

      let savedRating: Rating;
      try {
        savedRating = await ratingRepository.save(
          ratingRepository.create({
            member,
            movieId: dto.movieId,
            score: dto.score,
            comment: dto.comment ?? null,
          }),
        );
      } catch (error) {
        // A second request may insert after our existence check.
        if (isDuplicateEntry(error)) this.ratingConflict();
        throw error;
      }

      let favorite: FavoriteResponseDto | null = null;
      if (dto.addToFavorites) {
        try {
          const savedFavorite = await favoriteRepository.save(
            favoriteRepository.create({ member, movieId: dto.movieId }),
          );
          favorite = FavoriteResponseDto.from(savedFavorite);
        } catch (error) {
          if (isDuplicateEntry(error)) this.favoriteConflict();
          throw error;
        }
      }

      return MovieRecordResponseDto.of(
        {
          ratingId: Number(savedRating.ratingId),
          memberId,
          movieId: Number(savedRating.movieId),
          score: Number(savedRating.score),
          comment: savedRating.comment ?? null,
        },
        favorite,
      );
    });
  }

  private ratingConflict(): never {
    throw new ApiException(
      HttpStatus.CONFLICT,
      'RATING409_1',
      '이미 이 영화에 평점을 남기셨습니다.',
    );
  }

  private favoriteConflict(): never {
    throw new ApiException(
      HttpStatus.CONFLICT,
      'FAVORITE409_1',
      '이미 이 영화를 즐겨찾기하셨습니다.',
    );
  }
}
