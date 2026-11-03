import { Module } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { MemberController } from './member.controller.js';
import { MemberService } from './member.service.js';
import { RatingController } from './rating.controller.js';
import { RatingService } from './rating.service.js';

@Module({
  controllers: [MemberController, RatingController],
  providers: [DatabaseService, MemberService, RatingService],
  exports: [MemberService, RatingService],
})
export class MovieModule {}
