import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { success } from './api-response.js';
import { CreateRatingDto } from './dto/create-rating.dto.js';
import { UpdateRatingDto } from './dto/update-rating.dto.js';
import { PositiveIdPipe } from './positive-id.pipe.js';
import { RatingService } from './rating.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { LoginMember } from '../auth/login-member.decorator.js';

@Controller()
export class RatingController {
  constructor(@Inject(RatingService) private readonly ratings: RatingService) {}

  // Keep path metadata as Object so the global pipe cannot coerce "1e0" to 1
  // before PositiveIdPipe validates the original decimal representation.
  @Get('members/:memberId/ratings')
  async getMemberRatings(@Param('memberId', PositiveIdPipe) memberId: unknown) {
    return success(
      '평점 조회에 성공했습니다.',
      await this.ratings.getRatingsByMember(Number(memberId)),
    );
  }

  @Post('ratings')
  @UseGuards(JwtAuthGuard)
  async create(
    @LoginMember() memberId: number,
    @Body(
      new ValidationPipe({
        expectedType: CreateRatingDto,
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        validationError: { target: false, value: false },
      }),
    )
    dto: CreateRatingDto,
  ) {
    return success(
      '평점 등록에 성공했습니다.',
      await this.ratings.create(Number(memberId), dto),
      true,
    );
  }

  @Patch('ratings/:ratingId')
  @UseGuards(JwtAuthGuard)
  async update(
    @LoginMember() memberId: number,
    @Param('ratingId', PositiveIdPipe) ratingId: unknown,
    @Body(
      new ValidationPipe({
        expectedType: UpdateRatingDto,
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        validationError: { target: false, value: false },
      }),
    )
    dto: UpdateRatingDto,
  ) {
    return success(
      '평점 수정에 성공했습니다.',
      await this.ratings.update(memberId, Number(ratingId), dto),
    );
  }

  @Delete('ratings/:ratingId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async delete(
    @LoginMember() memberId: number,
    @Param('ratingId', PositiveIdPipe) ratingId: unknown,
  ) {
    await this.ratings.delete(memberId, Number(ratingId));
    return success('평점 삭제에 성공했습니다.', null);
  }
}
