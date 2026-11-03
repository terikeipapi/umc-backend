import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  ValidationPipe,
} from '@nestjs/common';
import { success } from './api-response.js';
import { CreateMemberDto } from './dto/create-member.dto.js';
import { MemberService } from './member.service.js';

@Controller('members')
export class MemberController {
  constructor(@Inject(MemberService) private readonly members: MemberService) {}

  @Get('email/:email')
  async checkEmail(@Param('email') email: string) {
    return success(
      '이메일 중복 확인에 성공했습니다.',
      await this.members.checkEmail(email),
    );
  }

  @Get('nickname/:nickname')
  async checkNickname(@Param('nickname') nickname: string) {
    return success(
      '닉네임 중복 확인에 성공했습니다.',
      await this.members.checkNickname(nickname),
    );
  }

  @Post()
  async signUp(
    @Body(
      new ValidationPipe({
        expectedType: CreateMemberDto,
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        validationError: { target: false, value: false },
      }),
    )
    dto: CreateMemberDto,
  ) {
    return success(
      '회원가입에 성공했습니다.',
      await this.members.signUp(dto),
      true,
    );
  }
}
