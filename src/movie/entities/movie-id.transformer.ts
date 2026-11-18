import type { ValueTransformer } from 'typeorm';

// mysql2 returns BIGINT as strings. The API and DB constrain IDs to safe values.
export const movieIdTransformer: ValueTransformer = {
  to: (value: number) => value,
  from: (value: string | number) => {
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new Error('Stored movie ID is outside the safe integer range.');
    }
    return id;
  },
};
