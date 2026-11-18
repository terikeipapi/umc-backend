import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseService } from '../database/database.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { MemberController } from './member.controller.js';
import { MemberService } from './member.service.js';
import { RatingController } from './rating.controller.js';
import { RatingService } from './rating.service.js';
import { FavoriteController } from './favorite.controller.js';
import { FavoriteService } from './favorite.service.js';
import { Favorite } from './entities/favorite.entity.js';
import { Member } from './entities/member.entity.js';
import { Rating } from './entities/rating.entity.js';
import { MovieRecordController } from './movie-record.controller.js';
import { MovieRecordService } from './movie-record.service.js';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([Member, Rating, Favorite])],
  controllers: [
    MemberController,
    RatingController,
    FavoriteController,
    MovieRecordController,
  ],
  providers: [
    DatabaseService,
    MemberService,
    RatingService,
    FavoriteService,
    MovieRecordService,
  ],
  exports: [MemberService, RatingService],
})
export class MovieModule {}
