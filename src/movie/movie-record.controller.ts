import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { LoginMember } from '../auth/login-member.decorator.js';
import { success } from './api-response.js';
import { CreateMovieRecordDto } from './dto/create-movie-record.dto.js';
import { MovieRecordService } from './movie-record.service.js';

@Controller('movie-records')
@UseGuards(JwtAuthGuard)
export class MovieRecordController {
  constructor(
    @Inject(MovieRecordService) private readonly records: MovieRecordService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @LoginMember() memberId: number,
    @Body(
      new ValidationPipe({
        expectedType: CreateMovieRecordDto,
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        validationError: { target: false, value: false },
      }),
    )
    dto: CreateMovieRecordDto,
  ) {
    return success(
      '영화 기록을 저장했습니다.',
      await this.records.create(memberId, dto),
      true,
    );
  }
}
