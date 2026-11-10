import {
  IsDefined,
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

export class LoginRequestDto {
  @IsDefined({ message: '이메일을 입력해주세요.' })
  @IsString({ message: '이메일은 문자열이어야 합니다.' })
  @IsNotEmpty({ message: '이메일을 입력해주세요.' })
  @IsEmail({}, { message: '이메일 형식이 올바르지 않습니다.' })
  @MaxLength(254, { message: '이메일은 254자 이하여야 합니다.' })
  email!: string;

  // Existing members can log in even if the signup policy has since changed.
  @IsDefined({ message: '비밀번호를 입력해주세요.' })
  @IsString({ message: '비밀번호는 문자열이어야 합니다.' })
  @IsNotEmpty({ message: '비밀번호를 입력해주세요.' })
  password!: string;
}
