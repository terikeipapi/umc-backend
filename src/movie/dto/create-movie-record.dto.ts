import { IsBoolean, IsDefined } from 'class-validator';
import { CreateRatingDto } from './create-rating.dto.js';

/** The rating fields keep the same validation rules as POST /ratings. */
export class CreateMovieRecordDto extends CreateRatingDto {
  @IsDefined({ message: '즐겨찾기 추가 여부를 입력해주세요.' })
  @IsBoolean({
    message: '즐겨찾기 추가 여부는 true 또는 false여야 합니다.',
  })
  addToFavorites!: boolean;
}
