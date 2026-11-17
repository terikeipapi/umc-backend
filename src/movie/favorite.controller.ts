import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { LoginMember } from '../auth/login-member.decorator.js';
import { success } from './api-response.js';
import { CreateFavoriteDto } from './dto/create-favorite.dto.js';
import { FavoriteService } from './favorite.service.js';
import { PositiveIdPipe } from './positive-id.pipe.js';

@Controller('favorites')
@UseGuards(JwtAuthGuard)
export class FavoriteController {
  constructor(
    @Inject(FavoriteService) private readonly favorites: FavoriteService,
  ) {}

  @Get()
  async list(@LoginMember() memberId: number) {
    return success(
      '찜한 영화를 조회했습니다.',
      await this.favorites.getFavorites(memberId),
    );
  }

  @Get(':movieId')
  async get(
    @LoginMember() memberId: number,
    @Param('movieId', PositiveIdPipe) movieId: unknown,
  ) {
    return success(
      '영화의 찜 여부를 조회했습니다.',
      await this.favorites.getFavorite(memberId, Number(movieId)),
    );
  }

  @Post()
  async create(
    @LoginMember() memberId: number,
    @Body(
      new ValidationPipe({
        expectedType: CreateFavoriteDto,
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        validationError: { target: false, value: false },
      }),
    )
    dto: CreateFavoriteDto,
  ) {
    return success(
      '찜한 영화에 추가했습니다.',
      await this.favorites.addFavorite(memberId, dto.movieId),
      true,
    );
  }

  @Delete(':movieId')
  @HttpCode(HttpStatus.OK)
  async delete(
    @LoginMember() memberId: number,
    @Param('movieId', PositiveIdPipe) movieId: unknown,
  ) {
    await this.favorites.deleteFavorite(memberId, Number(movieId));
    return success('찜한 영화에서 삭제했습니다.', null);
  }
}
