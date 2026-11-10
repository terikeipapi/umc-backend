import {
  IsDefined,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class UpdateMemberDto {
  @IsDefined({ message: '닉네임을 입력해주세요.' })
  @IsString({ message: '닉네임은 문자열이어야 합니다.' })
  @IsNotEmpty({ message: '닉네임을 입력해주세요.' })
  @Matches(/\S/u, { message: '닉네임은 공백만으로 구성할 수 없습니다.' })
  @Length(2, 12, { message: '닉네임은 2자 이상 12자 이하여야 합니다.' })
  nickname!: string;
}
