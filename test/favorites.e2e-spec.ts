import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { getMetadataArgsStorage } from 'typeorm';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module.js';
import { configureApp } from '../src/common/configure-app.js';
import { DatabaseService } from '../src/database/database.service.js';
import { FavoriteController } from '../src/movie/favorite.controller.js';
import { FavoriteService } from '../src/movie/favorite.service.js';
import { BaseTimeEntity } from '../src/movie/entities/base-time.entity.js';
import { Favorite } from '../src/movie/entities/favorite.entity.js';
import { Member } from '../src/movie/entities/member.entity.js';
import { movieIdTransformer } from '../src/movie/entities/movie-id.transformer.js';

describe('Workbook favorites API (real JWT, validation, service; mock repositories)', () => {
  let app: INestApplication;
  let authorization: string;
  const member = Object.assign(new Member(), { memberId: 7 });
  const createdAt = new Date('2026-11-17T04:00:00.000Z');
  const favorite = Object.assign(new Favorite(), {
    favoriteId: 11,
    member,
    movieId: 550,
    createdAt,
  });
  const members = { findOneBy: vi.fn() };
  const favorites = {
    find: vi.fn(),
    exists: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };

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
        AuthModule,
      ],
      controllers: [FavoriteController],
      providers: [
        FavoriteService,
        { provide: getRepositoryToken(Favorite), useValue: favorites },
        { provide: getRepositoryToken(Member), useValue: members },
      ],
    })
      .overrideProvider(DatabaseService)
      .useValue({ pool: { execute: vi.fn() } })
      .compile();
    app = module.createNestApplication();
    app.useLogger(false);
    configureApp(app);
    await app.init();
    authorization = `Bearer ${app.get(JwtService).sign({ sub: '7', email: 'movie@example.com' })}`;
  });

  beforeEach(() => {
    vi.resetAllMocks();
    members.findOneBy.mockResolvedValue(member);
    favorites.find.mockResolvedValue([]);
    favorites.exists.mockResolvedValue(false);
    favorites.create.mockImplementation((input) =>
      Object.assign(new Favorite(), input),
    );
    favorites.save.mockResolvedValue(favorite);
    favorites.delete.mockResolvedValue({ affected: 1 });
  });
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
    expect(members.findOneBy).not.toHaveBeenCalled();
  });

  it('lists only the token owner in descending order with response timestamps', async () => {
    favorites.find.mockResolvedValue([favorite]);
    const response = await request(app.getHttpServer())
      .get('/favorites')
      .set('Authorization', authorization)
      .expect(200);
    expect(response.body.result).toEqual([
      { favoriteId: 11, movieId: 550, createdAt: createdAt.toISOString() },
    ]);
    expect(favorites.find).toHaveBeenCalledExactlyOnceWith({
      where: { member: { memberId: 7 } },
      order: { favoriteId: 'DESC' },
    });
    expect(Object.keys(response.body.result[0]).sort()).toEqual([
      'createdAt',
      'favoriteId',
      'movieId',
    ]);
  });

  it('returns 200 and [] for a member without favorites', async () => {
    const response = await request(app.getHttpServer())
      .get('/favorites')
      .set('Authorization', authorization)
      .expect(200);
    expect(response.body.result).toEqual([]);
  });

  it.each([false, true])(
    'returns isFavorite=%s without leaking member data',
    async (isFavorite) => {
      favorites.exists.mockResolvedValue(isFavorite);
      const response = await request(app.getHttpServer())
        .get('/favorites/550')
        .set('Authorization', authorization)
        .expect(200);
      expect(response.body.result).toEqual({ isFavorite });
      expect(favorites.exists).toHaveBeenCalledExactlyOnceWith({
        where: { member: { memberId: 7 }, movieId: 550 },
      });
    },
  );

  it('creates one favorite for the token subject and returns only the DTO', async () => {
    const response = await request(app.getHttpServer())
      .post('/favorites')
      .set('Authorization', authorization)
      .send({ movieId: 550 })
      .expect(201);
    expect(response.body.code).toBe('COMMON201');
    expect(response.body.result).toEqual({
      favoriteId: 11,
      movieId: 550,
      createdAt: createdAt.toISOString(),
    });
    expect(favorites.create).toHaveBeenCalledExactlyOnceWith({
      member,
      movieId: 550,
    });
  });

  it('rejects an already registered favorite with the workbook code before saving', async () => {
    favorites.exists.mockResolvedValue(true);
    const response = await request(app.getHttpServer())
      .post('/favorites')
      .set('Authorization', authorization)
      .send({ movieId: 550 })
      .expect(409);
    expect(response.body.code).toBe('FAVORITE409_1');
    expect(favorites.save).not.toHaveBeenCalled();
  });

  it('maps a concurrent UNIQUE failure to the same FAVORITE409_1 response', async () => {
    favorites.save.mockRejectedValue({
      driverError: { code: 'ER_DUP_ENTRY', errno: 1062 },
    });
    const response = await request(app.getHttpServer())
      .post('/favorites')
      .set('Authorization', authorization)
      .send({ movieId: 550 })
      .expect(409);
    expect(response.body.code).toBe('FAVORITE409_1');
  });

  it('removes only the token owner/movie pair and responds 200 with null', async () => {
    const response = await request(app.getHttpServer())
      .delete('/favorites/550')
      .set('Authorization', authorization)
      .expect(200);
    expect(response.body.code).toBe('COMMON200');
    expect(response.body.result).toBeNull();
    expect(favorites.delete).toHaveBeenCalledExactlyOnceWith({
      member: { memberId: 7 },
      movieId: 550,
    });
  });

  it('returns FAVORITE404_1 when no owned row was deleted, including repeat removal', async () => {
    favorites.delete.mockResolvedValue({ affected: 0 });
    const response = await request(app.getHttpServer())
      .delete('/favorites/550')
      .set('Authorization', authorization)
      .expect(404);
    expect(response.body.code).toBe('FAVORITE404_1');
  });

  it.each([
    {},
    { movieId: 0 },
    { movieId: -1 },
    { movieId: 1.5 },
    { movieId: '550' },
    { movieId: null },
    { movieId: Number.MAX_SAFE_INTEGER + 1 },
    { movieId: 550, memberId: 99 },
  ])('rejects invalid POST body %j before repository access', async (body) => {
    await request(app.getHttpServer())
      .post('/favorites')
      .set('Authorization', authorization)
      .send(body)
      .expect(400);
    expect(members.findOneBy).not.toHaveBeenCalled();
    expect(favorites.save).not.toHaveBeenCalled();
  });

  it.each(['get', 'delete'] as const)(
    'validates the original %s path ID before coercion',
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
      expect(members.findOneBy).not.toHaveBeenCalled();
    },
  );

  it('passes the largest safe external movie ID without precision loss', async () => {
    await request(app.getHttpServer())
      .get('/favorites/9007199254740991')
      .set('Authorization', authorization)
      .expect(200);
    expect(favorites.exists).toHaveBeenCalledExactlyOnceWith({
      where: { member: { memberId: 7 }, movieId: Number.MAX_SAFE_INTEGER },
    });
    expect(movieIdTransformer.from('9007199254740991')).toBe(
      Number.MAX_SAFE_INTEGER,
    );
    expect(() => movieIdTransformer.from('9007199254740992')).toThrow();
  });

  it('rejects a token for a deleted member before accessing favorites', async () => {
    members.findOneBy.mockResolvedValue(null);
    const response = await request(app.getHttpServer())
      .get('/favorites')
      .set('Authorization', authorization)
      .expect(404);
    expect(response.body.code).toBe('MEMBER404_1');
    expect(favorites.find).not.toHaveBeenCalled();
  });

  it('maps favorite time columns through BaseTimeEntity and a member/movie UNIQUE', () => {
    expect(new Favorite()).toBeInstanceOf(BaseTimeEntity);
    const metadata = getMetadataArgsStorage();
    expect(
      metadata.columns
        .filter((column) => column.target === BaseTimeEntity)
        .map((column) => column.propertyName)
        .sort(),
    ).toEqual(['createdAt', 'updatedAt']);
    expect(
      metadata.uniques.find((constraint) => constraint.target === Favorite)
        ?.columns,
    ).toEqual(['member', 'movieId']);
    expect(
      metadata.relations.find((relation) => relation.target === Favorite)
        ?.propertyName,
    ).toBe('member');
  });

  it('initializes and updates inherited timestamps as UTC instants rather than database local time', () => {
    const before = Date.now();
    const entity = new Favorite();
    entity.initializeTimestamps();
    const createdAt = entity.createdAt;
    expect(createdAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(createdAt.getTime()).toBeLessThanOrEqual(Date.now());
    expect(entity.updatedAt).toBe(createdAt);
    entity.updateTimestamp();
    expect(entity.createdAt).toBe(createdAt);
    expect(entity.updatedAt.getTime()).toBeGreaterThanOrEqual(
      createdAt.getTime(),
    );
    expect(entity.updatedAt.getTime()).toBeLessThanOrEqual(Date.now());
    const listeners = getMetadataArgsStorage().entityListeners.filter(
      (listener) => listener.target === BaseTimeEntity,
    );
    expect(listeners.map((listener) => listener.type).sort()).toEqual([
      'before-insert',
      'before-update',
    ]);
  });
});
