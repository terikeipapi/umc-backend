import type { INestApplication } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource, type EntityManager } from 'typeorm';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard.js';
import { configureApp } from '../src/common/configure-app.js';
import { MovieRecordController } from '../src/movie/movie-record.controller.js';
import { MovieRecordService } from '../src/movie/movie-record.service.js';
import { Favorite } from '../src/movie/entities/favorite.entity.js';
import { Member } from '../src/movie/entities/member.entity.js';
import { Rating } from '../src/movie/entities/rating.entity.js';

describe('Movie records API (JWT, validation and transaction callback; mock repositories)', () => {
  let app: INestApplication;
  let authorization: string;
  const member = { memberId: 7 };
  const body = {
    movieId: 238,
    score: 5,
    comment: '다시 보고 싶은 영화입니다.',
    addToFavorites: true,
  };
  const createdAt = new Date('2026-11-17T04:00:00.000Z');
  const members = { findOneBy: vi.fn() };
  const ratings = { findOne: vi.fn(), create: vi.fn(), save: vi.fn() };
  const favorites = { findOne: vi.fn(), create: vi.fn(), save: vi.fn() };
  const manager = {
    getRepository: vi.fn((entity: unknown) => {
      if (entity === Member) return members;
      if (entity === Rating) return ratings;
      if (entity === Favorite) return favorites;
      throw new Error('Unexpected transaction repository');
    }),
  };
  const transaction = vi.fn();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'movie-record-e2e-only-key-at-least-32-bytes',
          signOptions: { algorithm: 'HS256', expiresIn: 3600 },
        }),
      ],
      controllers: [MovieRecordController],
      providers: [
        JwtAuthGuard,
        MovieRecordService,
        { provide: DataSource, useValue: { transaction } },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useLogger(false);
    configureApp(app);
    await app.init();
    authorization = `Bearer ${app.get(JwtService).sign({ sub: '7', email: 'movie@example.com' })}`;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    transaction
      .mockReset()
      .mockImplementation(
        (callback: (transactionManager: EntityManager) => Promise<unknown>) =>
          callback(manager as unknown as EntityManager),
      );
    members.findOneBy.mockReset().mockResolvedValue(member);
    ratings.findOne.mockReset().mockResolvedValue(null);
    favorites.findOne.mockReset().mockResolvedValue(null);
    ratings.create.mockReset().mockImplementation((value: unknown) => value);
    favorites.create.mockReset().mockImplementation((value: unknown) => value);
    ratings.save.mockReset().mockImplementation((value: object) => ({
      ...value,
      ratingId: 31,
    }));
    favorites.save.mockReset().mockImplementation((value: object) => ({
      ...value,
      favoriteId: 44,
      createdAt,
      updatedAt: createdAt,
    }));
  });

  afterAll(async () => app?.close());

  function post(payload: unknown = body) {
    return request(app.getHttpServer())
      .post('/movie-records')
      .set('Authorization', authorization)
      .send(payload);
  }

  it('requires a verified token before opening a transaction', async () => {
    const response = await request(app.getHttpServer())
      .post('/movie-records')
      .send(body)
      .expect(401);
    expect(response.body.code).toBe('AUTH401_2');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects a malformed token before opening a transaction', async () => {
    const response = await request(app.getHttpServer())
      .post('/movie-records')
      .set('Authorization', 'Bearer not-a-valid-token')
      .send(body)
      .expect(401);
    expect(response.body.code).toBe('AUTH401_3');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('saves both relations using only repositories from the transaction manager', async () => {
    const response = await request(app.getHttpServer())
      .post('/movie-records?memberId=99')
      .set('Authorization', authorization)
      .send(body)
      .expect(201);
    expect(response.body).toEqual({
      isSuccess: true,
      code: 'COMMON201',
      message: expect.any(String),
      result: {
        rating: {
          ratingId: 31,
          memberId: 7,
          movieId: 238,
          score: 5,
          comment: body.comment,
        },
        favorite: {
          favoriteId: 44,
          movieId: 238,
          createdAt: createdAt.toISOString(),
        },
      },
    });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(manager.getRepository.mock.calls).toEqual([
      [Member],
      [Rating],
      [Favorite],
    ]);
    expect(members.findOneBy).toHaveBeenCalledWith({ memberId: 7 });
    const where = { member: { memberId: 7 }, movieId: 238 };
    expect(ratings.findOne).toHaveBeenCalledWith({ where });
    expect(favorites.findOne).toHaveBeenCalledWith({ where });
    expect(ratings.create).toHaveBeenCalledWith({
      member,
      movieId: 238,
      score: 5,
      comment: body.comment,
    });
    expect(favorites.create).toHaveBeenCalledWith({ member, movieId: 238 });
    expect(ratings.save.mock.invocationCallOrder[0]).toBeLessThan(
      favorites.save.mock.invocationCallOrder[0],
    );
    expect(response.text).not.toContain('password');
  });

  it('saves only the rating when addToFavorites is false, even if a favorite exists', async () => {
    favorites.findOne.mockResolvedValue({ favoriteId: 44 });
    const response = await post({ ...body, addToFavorites: false }).expect(201);
    expect(response.body.result.favorite).toBeNull();
    expect(response.body.result.rating.movieId).toBe(238);
    expect(favorites.findOne).not.toHaveBeenCalled();
    expect(favorites.create).not.toHaveBeenCalled();
    expect(favorites.save).not.toHaveBeenCalled();
    expect(ratings.save).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['missing boolean', { addToFavorites: undefined }],
    ['null boolean', { addToFavorites: null }],
    ['string boolean', { addToFavorites: 'true' }],
    ['numeric boolean', { addToFavorites: 1 }],
    ['missing movie', { movieId: undefined }],
    ['zero movie', { movieId: 0 }],
    ['negative movie', { movieId: -1 }],
    ['fractional movie', { movieId: 1.5 }],
    ['string movie', { movieId: '238' }],
    ['unsafe movie', { movieId: Number.MAX_SAFE_INTEGER + 1 }],
    ['missing score', { score: undefined }],
    ['zero score', { score: 0 }],
    ['score above five', { score: 6 }],
    ['fractional score', { score: 2.5 }],
    ['string score', { score: '5' }],
    ['non-string comment', { comment: 1 }],
    ['long comment', { comment: 'a'.repeat(501) }],
    ['client-supplied member', { memberId: 99 }],
  ])('rejects %s without executing a transaction', async (_name, override) => {
    const response = await post({ ...body, ...override }).expect(400);
    expect(response.body.code).toBe('COMMON4001');
    expect(transaction).not.toHaveBeenCalled();
  });

  it.each([undefined, null])(
    'stores optional comment %s as null',
    async (comment) => {
      const response = await post({ ...body, comment }).expect(201);
      expect(response.body.result.rating.comment).toBeNull();
      expect(ratings.create.mock.calls[0][0].comment).toBeNull();
    },
  );

  it('accepts the largest safe external movie ID without precision loss', async () => {
    const response = await post({
      ...body,
      movieId: Number.MAX_SAFE_INTEGER,
    }).expect(201);
    expect(response.body.result.rating.movieId).toBe(Number.MAX_SAFE_INTEGER);
    expect(response.body.result.favorite.movieId).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('rejects a missing token owner without saving either record', async () => {
    members.findOneBy.mockResolvedValue(null);
    const response = await post().expect(404);
    expect(response.body.code).toBe('MEMBER404_1');
    expect(ratings.findOne).not.toHaveBeenCalled();
    expect(ratings.save).not.toHaveBeenCalled();
    expect(favorites.save).not.toHaveBeenCalled();
  });

  it('rejects an existing rating before either write', async () => {
    ratings.findOne.mockResolvedValue({ ratingId: 30 });
    const response = await post().expect(409);
    expect(response.body.code).toBe('RATING409_1');
    expect(ratings.save).not.toHaveBeenCalled();
    expect(favorites.save).not.toHaveBeenCalled();
  });

  it('rejects an existing favorite before writing a new rating', async () => {
    favorites.findOne.mockResolvedValue({ favoriteId: 43 });
    const response = await post().expect(409);
    expect(response.body.code).toBe('FAVORITE409_1');
    expect(ratings.save).not.toHaveBeenCalled();
    expect(favorites.save).not.toHaveBeenCalled();
  });

  const duplicates = [
    { code: 'ER_DUP_ENTRY', errno: 1062 },
    { driverError: { code: 'ER_DUP_ENTRY', errno: 1062 } },
  ];
  it.each(duplicates)(
    'normalizes a rating duplicate race %j',
    async (error) => {
      ratings.save.mockRejectedValue(error);
      const response = await post().expect(409);
      expect(response.body.code).toBe('RATING409_1');
      expect(favorites.save).not.toHaveBeenCalled();
    },
  );

  it.each(duplicates)(
    'lets a favorite duplicate race %j escape the transaction',
    async (error) => {
      favorites.save.mockRejectedValue(error);
      const response = await post().expect(409);
      expect(response.body.code).toBe('FAVORITE409_1');
      expect(ratings.save).toHaveBeenCalledTimes(1);
      expect(favorites.save).toHaveBeenCalledTimes(1);
      await expect(transaction.mock.results[0].value).rejects.toMatchObject({
        code: 'FAVORITE409_1',
      });
    },
  );

  it('propagates a second-save failure rather than committing the earlier rating', async () => {
    // This asserts propagation, not actual database rollback. The separate live
    // MySQL verifier exercises this failure after a real rating insert.
    favorites.save.mockRejectedValue(new Error('private database failure'));
    const response = await post().expect(500);
    expect(response.body.code).toBe('COMMON500');
    expect(response.text).not.toContain('private database failure');
    expect(ratings.save).toHaveBeenCalledTimes(1);
    expect(favorites.save).toHaveBeenCalledTimes(1);
    await expect(transaction.mock.results[0].value).rejects.toThrow(
      'private database failure',
    );
  });
});
