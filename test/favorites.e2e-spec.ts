import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureApp } from '../src/common/configure-app.js';
import { DatabaseService } from '../src/database/database.service.js';
import { MovieModule } from '../src/movie/movie.module.js';

describe('Favorites API (real JWT, validation and services; mock database)', () => {
  let app: INestApplication;
  let authorization: string;
  const execute = vi.fn();
  const rows = (value: unknown[]) => [value, []];

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              JWT_SECRET: 'favorites-e2e-signing-key-at-least-32-bytes',
              JWT_ACCESS_EXPIRATION: '3600',
            }),
          ],
        }),
        MovieModule,
      ],
    })
      .overrideProvider(DatabaseService)
      .useValue({ pool: { execute } })
      .compile();
    app = module.createNestApplication();
    app.useLogger(false);
    configureApp(app);
    await app.init();
    authorization = `Bearer ${app.get(JwtService).sign({ sub: '7', email: 'movie@example.com' })}`;
  });

  beforeEach(() => execute.mockReset());
  afterAll(async () => app?.close());

  it.each([
    ['get', '/favorites'],
    ['get', '/favorites/550'],
    ['post', '/favorites'],
    ['delete', '/favorites/550'],
  ] as const)('requires authentication for %s %s', async (method, url) => {
    const response = await request(app.getHttpServer())
      [method](url)
      .send(method === 'post' ? { movieId: 550 } : undefined)
      .expect(401);
    expect(response.body.code).toBe('AUTH401_2');
    expect(execute).not.toHaveBeenCalled();
  });

  it('lists only the token owner favorites with numeric external movie IDs', async () => {
    execute
      .mockResolvedValueOnce(rows([{ member_id: 7 }]))
      .mockResolvedValueOnce(rows([{ movie_id: '550' }, { movie_id: '13' }]));
    const response = await request(app.getHttpServer())
      .get('/favorites?memberId=99')
      .set('Authorization', authorization)
      .expect(200);
    expect(response.body).toEqual({
      isSuccess: true,
      code: 'COMMON200',
      message: expect.any(String),
      result: [{ movieId: 550 }, { movieId: 13 }],
    });
    expect(execute.mock.calls[1][1]).toEqual([7]);
  });

  it('returns an empty array for an owner without favorites', async () => {
    execute
      .mockResolvedValueOnce(rows([{ member_id: 7 }]))
      .mockResolvedValueOnce(rows([]));
    const response = await request(app.getHttpServer())
      .get('/favorites')
      .set('Authorization', authorization)
      .expect(200);
    expect(response.body.result).toEqual([]);
  });

  it.each([false, true])(
    'returns explicit isFavorite=%s for the member/movie pair',
    async (isFavorite) => {
      execute
        .mockResolvedValueOnce(rows([{ member_id: 7 }]))
        .mockResolvedValueOnce(rows(isFavorite ? [{ favorite_id: 11 }] : []));
      const response = await request(app.getHttpServer())
        .get('/favorites/550')
        .set('Authorization', authorization)
        .expect(200);
      expect(response.body.result).toEqual({ movieId: 550, isFavorite });
      expect(execute.mock.calls[1][1]).toEqual([7, 550]);
    },
  );

  it.each([1, 0])(
    'adds idempotently under the token subject (affectedRows=%i)',
    async (affectedRows) => {
      execute
        .mockResolvedValueOnce(rows([{ member_id: 7 }]))
        .mockResolvedValueOnce([{ insertId: 11, affectedRows }]);
      const response = await request(app.getHttpServer())
        .post('/favorites?memberId=99')
        .set('Authorization', authorization)
        .send({ movieId: 550 })
        .expect(201);
      expect(response.body.result).toEqual({ movieId: 550, isFavorite: true });
      expect(response.body.code).toBe('COMMON201');
      expect(execute.mock.calls[1][0]).toContain('ON DUPLICATE KEY UPDATE');
      expect(execute.mock.calls[1][1]).toEqual([7, 550]);
    },
  );

  it.each([1, 0])(
    'removes idempotently with ownership in the write (affectedRows=%i)',
    async (affectedRows) => {
      execute
        .mockResolvedValueOnce(rows([{ member_id: 7 }]))
        .mockResolvedValueOnce([{ affectedRows }]);
      const response = await request(app.getHttpServer())
        .delete('/favorites/550?memberId=99')
        .set('Authorization', authorization)
        .expect(200);
      expect(response.body.result).toBeNull();
      expect(execute.mock.calls[1][1]).toEqual([7, 550]);
    },
  );

  it.each([
    {},
    { movieId: 0 },
    { movieId: -1 },
    { movieId: 1.5 },
    { movieId: '550' },
    { movieId: null },
    { movieId: Number.MAX_SAFE_INTEGER + 1 },
    { movieId: 550, memberId: 99 },
  ])('rejects invalid POST body %j before database access', async (body) => {
    await request(app.getHttpServer())
      .post('/favorites')
      .set('Authorization', authorization)
      .send(body)
      .expect(400);
    expect(execute).not.toHaveBeenCalled();
  });

  it.each(['get', 'delete'] as const)(
    'validates the original %s path ID before numeric coercion',
    async (method) => {
      for (const movieId of [
        '0',
        '-1',
        '1.5',
        '1e0',
        'abc',
        '9007199254740992',
      ]) {
        await request(app.getHttpServer())
          [method](`/favorites/${movieId}`)
          .set('Authorization', authorization)
          .expect(400);
      }
      expect(execute).not.toHaveBeenCalled();
    },
  );

  it('accepts the largest safe external movie ID without precision loss', async () => {
    execute
      .mockResolvedValueOnce(rows([{ member_id: 7 }]))
      .mockResolvedValueOnce(rows([]));
    const response = await request(app.getHttpServer())
      .get('/favorites/9007199254740991')
      .set('Authorization', authorization)
      .expect(200);
    expect(response.body.result.movieId).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('rejects a token for a deleted member before accessing favorites', async () => {
    execute.mockResolvedValueOnce(rows([]));
    const response = await request(app.getHttpServer())
      .get('/favorites')
      .set('Authorization', authorization)
      .expect(404);
    expect(response.body.code).toBe('MEMBER404_1');
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
