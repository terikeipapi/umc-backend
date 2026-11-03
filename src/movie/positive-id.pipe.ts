import { BadRequestException, Injectable } from '@nestjs/common';
import type { PipeTransform } from '@nestjs/common';

@Injectable()
export class PositiveIdPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    if (!/^[0-9]+$/u.test(value)) {
      throw new BadRequestException('ID는 양의 안전한 정수여야 합니다.');
    }
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id < 1) {
      throw new BadRequestException('ID는 양의 안전한 정수여야 합니다.');
    }
    return id;
  }
}
