import {
  IsDefined,
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateBy,
} from 'class-validator';

export class CreateMemberDto {
  @IsDefined({ message: '이메일을 입력해주세요.' })
  @IsString({ message: '이메일은 문자열이어야 합니다.' })
  @IsNotEmpty({ message: '이메일을 입력해주세요.' })
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  @MaxLength(254, { message: '이메일은 254자 이하여야 합니다.' })
  email!: string;

  @IsDefined({ message: '비밀번호를 입력해주세요.' })
  @IsString({ message: '비밀번호는 문자열이어야 합니다.' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/u, {
    message:
      '비밀번호는 대문자/소문자/숫자/특수문자를 포함한 8자 이상이어야 합니다.',
  })
  @ValidateBy(
    {
      name: 'maxBcryptBytes',
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && Buffer.byteLength(value, 'utf8') <= 72,
      },
    },
    { message: '비밀번호는 UTF-8 기준 72바이트 이하여야 합니다.' },
  )
  password!: string;

  @IsDefined({ message: '닉네임을 입력해주세요.' })
  @IsString({ message: '닉네임은 문자열이어야 합니다.' })
  @IsNotEmpty({ message: '닉네임을 입력해주세요.' })
  @Matches(/\S/u, { message: '닉네임은 공백만으로 구성할 수 없습니다.' })
  @MinLength(2, { message: '닉네임은 2자 이상이어야 합니다.' })
  @MaxLength(12, { message: '닉네임은 12자 이하여야 합니다.' })
  nickname!: string;
}
