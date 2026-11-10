import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  ValidationPipe,
} from '@nestjs/common';
import { success } from '../movie/api-response.js';
import { AuthService } from './auth.service.js';
import { LoginRequestDto } from './dto/login-request.dto.js';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(
      new ValidationPipe({
        expectedType: LoginRequestDto,
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        validationError: { target: false, value: false },
      }),
    )
    dto: LoginRequestDto,
  ) {
    return success('로그인에 성공했습니다.', await this.auth.login(dto));
  }
}
