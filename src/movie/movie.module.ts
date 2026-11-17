import { Module } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { MemberController } from './member.controller.js';
import { MemberService } from './member.service.js';
import { RatingController } from './rating.controller.js';
import { RatingService } from './rating.service.js';
import { FavoriteController } from './favorite.controller.js';
import { FavoriteService } from './favorite.service.js';

@Module({
  imports: [AuthModule],
  controllers: [MemberController, RatingController, FavoriteController],
  providers: [DatabaseService, MemberService, RatingService, FavoriteService],
  exports: [MemberService, RatingService],
})
export class MovieModule {}
