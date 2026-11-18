import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiException } from '../exception/api.exception.js';
import { FavoriteResponseDto } from './dto/favorite-response.dto.js';
import { FavoriteStatusResponseDto } from './dto/favorite-status-response.dto.js';
import { Favorite } from './entities/favorite.entity.js';
import { Member } from './entities/member.entity.js';

@Injectable()
export class FavoriteService {
  constructor(
    @InjectRepository(Favorite)
    private readonly favorites: Repository<Favorite>,
    @InjectRepository(Member) private readonly members: Repository<Member>,
  ) {}

  async getFavorites(memberId: number): Promise<FavoriteResponseDto[]> {
    await this.requireMember(memberId);
    const favorites = await this.favorites.find({
      where: { member: { memberId } },
      order: { favoriteId: 'DESC' },
    });
    return favorites.map((favorite) => FavoriteResponseDto.from(favorite));
  }

  async getFavorite(memberId: number, movieId: number) {
    await this.requireMember(memberId);
    const exists = await this.favorites.exists({
      where: { member: { memberId }, movieId },
    });
    return FavoriteStatusResponseDto.from(exists);
  }

  async addFavorite(
    memberId: number,
    movieId: number,
  ): Promise<FavoriteResponseDto> {
    const member = await this.requireMember(memberId);
    const existing = await this.favorites.exists({
      where: { member: { memberId }, movieId },
    });
    if (existing) this.duplicateFavorite();
    try {
      return FavoriteResponseDto.from(
        await this.favorites.save(this.favorites.create({ member, movieId })),
      );
    } catch (error) {
      const driver =
        (error as { driverError?: { code?: string; errno?: number } })
          ?.driverError ?? (error as { code?: string; errno?: number });
      // The preliminary check gives normal requests a clear error; UNIQUE also
      // protects concurrent requests that pass that check simultaneously.
      if (driver?.code === 'ER_DUP_ENTRY' || driver?.errno === 1062)
        this.duplicateFavorite();
      throw error;
    }
  }

  async deleteFavorite(memberId: number, movieId: number): Promise<void> {
    await this.requireMember(memberId);
    const result = await this.favorites.delete({
      member: { memberId },
      movieId,
    });
    if (!result.affected) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        'FAVORITE404_1',
        '즐겨찾기한 영화를 찾을 수 없습니다.',
      );
    }
  }

  private async requireMember(memberId: number): Promise<Member> {
    const member = await this.members.findOneBy({ memberId });
    if (!member)
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        'MEMBER404_1',
        '해당 회원을 찾을 수 없습니다.',
      );
    return member;
  }

  private duplicateFavorite(): never {
    throw new ApiException(
      HttpStatus.CONFLICT,
      'FAVORITE409_1',
      '이미 이 영화를 즐겨찾기하셨습니다.',
    );
  }
}
