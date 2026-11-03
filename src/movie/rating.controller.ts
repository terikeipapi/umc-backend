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
  ValidationPipe,
} from '@nestjs/common';
import { success } from './api-response.js';
import { CreateRatingDto } from './dto/create-rating.dto.js';
import { UpdateRatingDto } from './dto/update-rating.dto.js';
import { PositiveIdPipe } from './positive-id.pipe.js';
import { RatingService } from './rating.service.js';

@Controller('members')
export class RatingController {
  constructor(@Inject(RatingService) private readonly ratings: RatingService) {}

  // Keep path metadata as Object so the global pipe cannot coerce "1e0" to 1
  // before PositiveIdPipe validates the original decimal representation.
  @Get(':memberId/ratings')
  async getMemberRatings(@Param('memberId', PositiveIdPipe) memberId: unknown) {
    return success(
      '평점 조회에 성공했습니다.',
      await this.ratings.getRatingsByMember(Number(memberId)),
    );
  }

  @Post(':memberId/ratings')
  async create(
    @Param('memberId', PositiveIdPipe) memberId: unknown,
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

  @Patch(':memberId/ratings/:ratingId')
  async update(
    @Param('memberId', PositiveIdPipe) memberId: unknown,
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
    await this.ratings.update(Number(ratingId), Number(memberId), dto);
    return success('평점 수정에 성공했습니다.', null);
  }

  @Delete(':memberId/ratings/:ratingId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('memberId', PositiveIdPipe) memberId: unknown,
    @Param('ratingId', PositiveIdPipe) ratingId: unknown,
  ): Promise<void> {
    await this.ratings.delete(Number(ratingId), Number(memberId));
  }
}
