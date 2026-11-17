import { IsDefined, IsInt, Max, Min } from 'class-validator';

export class CreateFavoriteDto {
  @IsDefined({ message: '영화 ID를 입력해주세요.' })
  @IsInt({ message: '영화 ID는 정수여야 합니다.' })
  @Min(1, { message: '영화 ID는 양수여야 합니다.' })
  @Max(Number.MAX_SAFE_INTEGER, {
    message: '영화 ID가 허용 범위를 벗어났습니다.',
  })
  movieId!: number;
}
