import { Module } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { MemberController } from './member.controller.js';
import { MemberService } from './member.service.js';
import { RatingController } from './rating.controller.js';
import { RatingService } from './rating.service.js';

@Module({
  imports: [AuthModule],
  controllers: [MemberController, RatingController],
  providers: [DatabaseService, MemberService, RatingService],
  exports: [MemberService, RatingService],
})
export class MovieModule {}
