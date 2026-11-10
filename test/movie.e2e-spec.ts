import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { configureApp } from '../src/common/configure-app.js';
import { DatabaseService } from '../src/database/database.service.js';
import { MovieModule } from '../src/movie/movie.module.js';

describe('Week 7 movie API (JWT, validation, services; mock database)', () => {
  let app: INestApplication;
  let authorization: string;
  const execute = vi.fn();
  const signUp = {
    email: 'umc@example.com',
    password: 'Umc!1234',
    nickname: 'moviefan',
  };
  const rating = { movieId: 550, score: 5, comment: 'A memorable film.' };

  function rows(value: unknown[]) {
    return [value, []];
  }

  function failure(body: unknown, code: string) {
    expect(body).toEqual({
      isSuccess: false,
      code,
      message: expect.any(String),
      result: null,
    });
  }

  beforeEach(async () => {
    execute.mockReset();
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              JWT_SECRET: 'week7-e2e-only-signing-key-at-least-32-bytes',
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
    authorization = `Bearer ${app.get(JwtService).sign({ sub: '7', email: signUp.email })}`;
  });

  afterEach(async () => {
    await app.close();
  });

  it('creates a member with a bcrypt hash and returns only public member fields', async () => {
    execute
      .mockResolvedValueOnce(rows([]))
      .mockResolvedValueOnce(rows([]))
      .mockResolvedValueOnce([{ insertId: 7, affectedRows: 1 }]);

    const response = await request(app.getHttpServer())
      .post('/members')
      .send(signUp)
      .expect(201);

    expect(response.body).toEqual({
      isSuccess: true,
      code: 'COMMON201',
      message: expect.any(String),
      result: { memberId: 7, email: signUp.email, nickname: signUp.nickname },
    });
    expect(response.text).not.toContain('password');
    const params = execute.mock.calls[2][1] as string[];
    expect(params[0]).toBe(signUp.email);
    expect(params[2]).toBe(signUp.nickname);
    expect(params[1]).toMatch(/^\$2[aby]\$10\$.{53}$/);
    expect(params[1]).toHaveLength(60);
    expect(await bcrypt.compare(signUp.password, params[1])).toBe(true);
  });

  it.each([
    ['malformed email', { email: 'not-an-email' }],
    ['empty email', { email: '' }],
    ['short nickname', { nickname: 'a' }],
    ['long nickname', { nickname: 'a'.repeat(13) }],
    ['blank nickname', { nickname: '   ' }],
    ['password without an uppercase letter', { password: 'umc!1234' }],
    ['password without a lowercase letter', { password: 'UMC!1234' }],
    ['password without a digit', { password: 'Umc!abcd' }],
    ['password without a special character', { password: 'Umc12345' }],
    ['short password', { password: 'Umc!123' }],
    [
      'password exceeding bcrypt byte limit',
      { password: `Aa1!${'가'.repeat(23)}` },
    ],
    ['undeclared request field', { memberId: 99 }],
  ])('rejects %s before accessing the database', async (_, override) => {
    const response = await request(app.getHttpServer())
      .post('/members')
      .send({ ...signUp, ...override })
      .expect(400);
    failure(response.body, 'COMMON4001');
    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects a missing required signup field', async () => {
    const response = await request(app.getHttpServer())
      .post('/members')
      .send({ email: signUp.email, nickname: signUp.nickname })
      .expect(400);
    failure(response.body, 'COMMON4001');
    expect(execute).not.toHaveBeenCalled();
  });

  it('reports a duplicate email without inserting a member', async () => {
    execute.mockResolvedValueOnce(rows([{ member_id: 1 }]));
    const response = await request(app.getHttpServer())
      .post('/members')
      .send(signUp)
      .expect(409);
    failure(response.body, 'MEMBER4091');
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('distinguishes a duplicate nickname from a duplicate email', async () => {
    execute
      .mockResolvedValueOnce(rows([]))
      .mockResolvedValueOnce(rows([{ member_id: 2 }]));
    const response = await request(app.getHttpServer())
      .post('/members')
      .send(signUp)
      .expect(409);
    failure(response.body, 'MEMBER4092');
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['uq_member_email', 'MEMBER4091'],
    ['uq_member_nickname', 'MEMBER4092'],
  ])('normalizes a concurrent database conflict on %s', async (key, code) => {
    execute
      .mockResolvedValueOnce(rows([]))
      .mockResolvedValueOnce(rows([]))
      .mockRejectedValueOnce({
        code: 'ER_DUP_ENTRY',
        errno: 1062,
        sqlMessage: `Duplicate entry 'redacted' for key 'member.${key}'`,
        message: `Duplicate entry 'redacted' for key 'member.${key}'`,
      });
    const response = await request(app.getHttpServer())
      .post('/members')
      .send(signUp)
      .expect(409);
    failure(response.body, code);
    expect(response.text).not.toContain('Duplicate entry');
  });

  it('creates a rating with a positive external movie ID and returns its ID', async () => {
    execute
      .mockResolvedValueOnce(rows([{ member_id: 7 }]))
      .mockResolvedValueOnce(rows([]))
      .mockResolvedValueOnce([{ insertId: 11, affectedRows: 1 }]);
    const response = await request(app.getHttpServer())
      .post('/ratings')
      .set('Authorization', authorization)
      .send(rating)
      .expect(201);
    expect(response.body).toEqual({
      isSuccess: true,
      code: 'COMMON201',
      message: expect.any(String),
      result: {
        ratingId: 11,
        memberId: 7,
        movieId: 550,
        score: 5,
        comment: rating.comment,
      },
    });
    expect(execute.mock.calls[2][1]).toEqual([7, 550, 5, rating.comment]);
  });

  it.each([
    [1, undefined, null],
    [5, null, null],
    [3, 'a'.repeat(500), 'a'.repeat(500)],
  ])(
    'accepts valid score %i and optional comment boundaries',
    async (score, comment, storedComment) => {
      execute
        .mockResolvedValueOnce(rows([{ member_id: 7 }]))
        .mockResolvedValueOnce(rows([]))
        .mockResolvedValueOnce([{ insertId: 11, affectedRows: 1 }]);
      await request(app.getHttpServer())
        .post('/ratings')
        .set('Authorization', authorization)
        .send({ movieId: 550, score, comment })
        .expect(201);
      expect(execute.mock.calls[2][1]).toEqual([7, 550, score, storedComment]);
    },
  );

  it.each([
    ['zero movie ID', { movieId: 0 }],
    ['fractional movie ID', { movieId: 1.5 }],
    ['string movie ID', { movieId: '550' }],
    ['unsafe movie ID', { movieId: Number.MAX_SAFE_INTEGER + 1 }],
    ['score below range', { score: 0 }],
    ['score above range', { score: 6 }],
    ['fractional score', { score: 4.5 }],
    ['string score', { score: '5' }],
    ['null score', { score: null }],
    ['non-string comment', { comment: {} }],
    ['overlong comment', { comment: 'a'.repeat(501) }],
    ['undeclared ownership field', { memberId: 99 }],
  ])(
    'rejects a rating with %s before accessing the database',
    async (_, override) => {
      const response = await request(app.getHttpServer())
        .post('/ratings')
        .set('Authorization', authorization)
        .send({ ...rating, ...override })
        .expect(400);
      failure(response.body, 'COMMON4001');
      expect(execute).not.toHaveBeenCalled();
    },
  );

  it('returns 404 for a nonexistent member without inserting a rating', async () => {
    execute.mockResolvedValueOnce(rows([]));
    const response = await request(app.getHttpServer())
      .post('/ratings')
      .set('Authorization', authorization)
      .send(rating)
      .expect(404);
    failure(response.body, 'MEMBER404_1');
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('rejects a second rating for the same member and movie', async () => {
    execute
      .mockResolvedValueOnce(rows([{ member_id: 7 }]))
      .mockResolvedValueOnce(rows([{ rating_id: 11 }]));
    const response = await request(app.getHttpServer())
      .post('/ratings')
      .set('Authorization', authorization)
      .send(rating)
      .expect(409);
    failure(response.body, 'RATING409_1');
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('maps the database unique pair conflict to the same rating error', async () => {
    execute
      .mockResolvedValueOnce(rows([{ member_id: 7 }]))
      .mockResolvedValueOnce(rows([]))
      .mockRejectedValueOnce({
        code: 'ER_DUP_ENTRY',
        errno: 1062,
        message:
          "Duplicate entry '7-550' for key 'rating.uq_rating_member_movie'",
        sqlMessage:
          "Duplicate entry '7-550' for key 'rating.uq_rating_member_movie'",
      });
    const response = await request(app.getHttpServer())
      .post('/ratings')
      .set('Authorization', authorization)
      .send(rating)
      .expect(409);
    failure(response.body, 'RATING409_1');
  });

  it('lists the member ratings using public response fields', async () => {
    execute
      .mockResolvedValueOnce(rows([{ member_id: 7 }]))
      .mockResolvedValueOnce(
        rows([
          {
            rating_id: 11,
            member_id: 7,
            movie_id: 550,
            score: 5,
            comment: null,
          },
        ]),
      );
    const response = await request(app.getHttpServer())
      .get('/members/7/ratings')
      .expect(200);
    expect(response.body.isSuccess).toBe(true);
    expect(response.body.code).toBe('COMMON200');
    expect(response.body.result).toEqual([
      { ratingId: 11, memberId: 7, movieId: 550, score: 5, comment: null },
    ]);
  });

  it('updates an owned rating and clears an omitted optional comment', async () => {
    execute
      .mockResolvedValueOnce(
        rows([
          {
            rating_id: 11,
            member_id: 7,
            movie_id: 550,
            score: 5,
            comment: null,
          },
        ]),
      )
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const response = await request(app.getHttpServer())
      .patch('/ratings/11')
      .set('Authorization', authorization)
      .send({ score: 3 })
      .expect(200);
    expect(response.body).toEqual({
      isSuccess: true,
      code: 'COMMON200',
      message: expect.any(String),
      result: {
        ratingId: 11,
        memberId: 7,
        movieId: 550,
        score: 3,
        comment: null,
      },
    });
    expect(execute.mock.calls[1][1]).toEqual([3, null, 11, 7]);
  });

  it('deletes an owned rating with 200 and the common null result envelope', async () => {
    execute
      .mockResolvedValueOnce(rows([{ rating_id: 11, member_id: 7 }]))
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const response = await request(app.getHttpServer())
      .delete('/ratings/11')
      .set('Authorization', authorization)
      .expect(200);
    expect(response.body).toEqual({
      isSuccess: true,
      code: 'COMMON200',
      message: expect.any(String),
      result: null,
    });
    expect(execute.mock.calls[1][1]).toEqual([11, 7]);
  });

  it.each(['patch', 'delete'] as const)(
    'prevents %s of another member rating with 403',
    async (method) => {
      execute.mockResolvedValueOnce(rows([{ rating_id: 11, member_id: 8 }]));
      const response = await request(app.getHttpServer())
        [method]('/ratings/11')
        .set('Authorization', authorization)
        .send(method === 'patch' ? { score: 3 } : undefined)
        .expect(403);
      failure(response.body, 'RATING403_1');
      expect(execute).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['patch', 'delete'] as const)(
    'returns 404 on %s of a nonexistent rating',
    async (method) => {
      execute.mockResolvedValueOnce(rows([]));
      const response = await request(app.getHttpServer())
        [method]('/ratings/11')
        .set('Authorization', authorization)
        .send(method === 'patch' ? { score: 3 } : undefined)
        .expect(404);
      failure(response.body, 'RATING404_1');
      expect(execute).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['patch', 'delete'] as const)(
    'returns 404 when a rating disappears during %s',
    async (method) => {
      execute
        .mockResolvedValueOnce(rows([{ rating_id: 11, member_id: 7 }]))
        .mockResolvedValueOnce([{ affectedRows: 0 }]);
      const response = await request(app.getHttpServer())
        [method]('/ratings/11')
        .set('Authorization', authorization)
        .send(method === 'patch' ? { score: 3 } : undefined)
        .expect(404);
      failure(response.body, 'RATING404_1');
    },
  );

  it.each([{}, { score: 0 }, { score: 3.5 }, { score: 3, movieId: 123 }])(
    'validates PATCH input %j before checking ownership',
    async (body) => {
      const response = await request(app.getHttpServer())
        .patch('/ratings/11')
        .set('Authorization', authorization)
        .send(body)
        .expect(400);
      failure(response.body, 'COMMON4001');
      expect(execute).not.toHaveBeenCalled();
    },
  );

  it.each(['0', '-1', '1.5', 'abc', '9007199254740992'])(
    'rejects the invalid rating path parameter %s',
    async (ratingId) => {
      const response = await request(app.getHttpServer())
        .patch(`/ratings/${ratingId}`)
        .set('Authorization', authorization)
        .send({ score: 3 })
        .expect(400);
      failure(response.body, 'COMMON4001');
      expect(execute).not.toHaveBeenCalled();
    },
  );
});
