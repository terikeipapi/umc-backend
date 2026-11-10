import {
  Controller,
  Get,
  HttpStatus,
  type INestApplication,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { configureApp } from '../src/common/configure-app.js';
import { DatabaseService } from '../src/database/database.service.js';
import { ApiException } from '../src/exception/api.exception.js';
import { MovieModule } from '../src/movie/movie.module.js';

const TEST_SECRET = 'week7-e2e-only-signing-key-at-least-32-bytes';
const tokenIssuer = new JwtService({ secret: TEST_SECRET });
const createdAt = new Date('2026-11-01T00:00:00.000Z');
const profile = {
  email: 'movie@example.com',
  nickname: '영화회원',
  created_at: createdAt,
};
const credentials = { email: profile.email, password: 'Movie!123' };

@Controller('test')
class ExceptionProbeController {
  @Get('api-exception')
  probe() {
    throw new ApiException(
      HttpStatus.CONFLICT,
      'TEST409',
      '정해진 오류 메시지',
    );
  }
}

describe('Week 7 authentication and member identity (real JWT, mock database)', () => {
  let app: INestApplication;
  let passwordHash: string;
  const execute = vi.fn();
  const rows = (value: unknown[]) => [value, []];
  const accessToken = (memberId = 7) =>
    tokenIssuer.sign(
      { sub: String(memberId), email: profile.email },
      { algorithm: 'HS256', expiresIn: 3600 },
    );

  function failure(body: unknown, code: string) {
    expect(body).toEqual({
      isSuccess: false,
      code,
      message: expect.any(String),
      result: null,
    });
  }

  beforeAll(async () => {
    passwordHash = await bcrypt.hash(credentials.password, 10);
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({ JWT_SECRET: TEST_SECRET, JWT_ACCESS_EXPIRATION: '3600' }),
          ],
        }),
        MovieModule,
      ],
      controllers: [ExceptionProbeController],
    })
      .overrideProvider(DatabaseService)
      .useValue({ pool: { execute } })
      .compile();
    app = module.createNestApplication();
    app.useLogger(false);
    configureApp(app);
    await app.init();
  });

  beforeEach(() => execute.mockReset());
  afterAll(async () => app?.close());

  it('preserves ApiException status, code and message in the existing global filter', async () => {
    const response = await request(app.getHttpServer())
      .get('/test/api-exception')
      .expect(409);
    expect(response.body).toEqual({
      isSuccess: false,
      code: 'TEST409',
      message: '정해진 오류 메시지',
      result: null,
    });
  });

  it('logs in with bcrypt, issues a verifiable expiring token and excludes secret account fields', async () => {
    execute.mockResolvedValueOnce(
      rows([{ member_id: 7, ...profile, password: passwordHash }]),
    );
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send(credentials)
      .expect(200);
    expect(response.body).toEqual({
      isSuccess: true,
      code: 'COMMON200',
      message: expect.any(String),
      result: { nickname: profile.nickname, accessToken: expect.any(String) },
    });
    const claims = tokenIssuer.verify(response.body.result.accessToken, {
      algorithms: ['HS256'],
    });
    expect(claims.sub).toBe('7');
    expect(claims.email).toBe(profile.email);
    expect(claims.exp - claims.iat).toBe(3600);
    expect(Object.keys(claims).sort()).toEqual(['email', 'exp', 'iat', 'sub']);
    expect(response.text).not.toContain(passwordHash);
    expect(response.text).not.toContain(credentials.password);
    expect(execute.mock.calls[0][1]).toEqual([credentials.email]);
  });

  it('gives identical credentials errors for an unknown email and an incorrect password', async () => {
    execute.mockResolvedValueOnce(rows([]));
    const unknown = await request(app.getHttpServer())
      .post('/auth/login')
      .send(credentials)
      .expect(401);
    execute.mockResolvedValueOnce(
      rows([{ member_id: 7, ...profile, password: passwordHash }]),
    );
    const wrong = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ ...credentials, password: 'incorrect' })
      .expect(401);
    failure(unknown.body, 'AUTH401_1');
    expect(wrong.body).toEqual(unknown.body);
    expect(unknown.text).not.toContain('accessToken');
  });

  it.each([
    {},
    { email: credentials.email },
    { email: 'invalid', password: 'anything' },
    { email: credentials.email, password: '' },
    { email: credentials.email, password: null },
    { email: credentials.email, password: 12345678 },
    { ...credentials, memberId: 99 },
  ])(
    'rejects invalid login payload %j before querying credentials',
    async (body) => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(body)
        .expect(400);
      failure(response.body, 'COMMON4001');
      expect(execute).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['get', '/members/me', undefined],
    ['patch', '/members/me', { nickname: '변경회원' }],
    ['post', '/ratings', { movieId: 550, score: 5 }],
    ['patch', '/ratings/11', { score: 3 }],
    ['delete', '/ratings/11', undefined],
  ] as const)(
    'requires authentication for %s %s before all database operations',
    async (method, path, body) => {
      const response = await request(app.getHttpServer())
        [method](path)
        .send(body)
        .expect(401);
      failure(response.body, 'AUTH401_2');
      expect(execute).not.toHaveBeenCalled();
    },
  );

  it.each(['Basic abc', 'Token abc', 'bearer abc', 'Bearer'])(
    'rejects unsupported authorization header %s',
    async (authorization) => {
      const response = await request(app.getHttpServer())
        .get('/members/me')
        .set('Authorization', authorization)
        .expect(401);
      failure(response.body, 'AUTH401_2');
      expect(execute).not.toHaveBeenCalled();
    },
  );

  it.each(['Bearer not.a.jwt', 'Bearer abc'])(
    'rejects malformed bearer token %s',
    async (authorization) => {
      const response = await request(app.getHttpServer())
        .get('/members/me')
        .set('Authorization', authorization)
        .expect(401);
      failure(response.body, 'AUTH401_3');
      expect(execute).not.toHaveBeenCalled();
    },
  );

  it('rejects a changed token payload even though it still decodes as valid JSON', async () => {
    const [header, payload, signature] = accessToken().split('.');
    const claims = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    );
    const changed = Buffer.from(
      JSON.stringify({ ...claims, sub: '8' }),
    ).toString('base64url');
    const response = await request(app.getHttpServer())
      .get('/members/me')
      .set('Authorization', `Bearer ${header}.${changed}.${signature}`)
      .expect(401);
    failure(response.body, 'AUTH401_3');
    expect(execute).not.toHaveBeenCalled();
  });

  it('distinguishes expired tokens from absent and malformed tokens', async () => {
    const expired = tokenIssuer.sign(
      { sub: '7', email: profile.email },
      { expiresIn: -1 },
    );
    const response = await request(app.getHttpServer())
      .get('/members/me')
      .set('Authorization', `Bearer ${expired}`)
      .expect(401);
    failure(response.body, 'AUTH401_4');
    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects tokens signed by another key and tokens using another HMAC algorithm', async () => {
    const foreign = new JwtService({
      secret: 'another-e2e-signing-secret-at-least-32-bytes',
    }).sign({ sub: '7', email: profile.email }, { expiresIn: 3600 });
    const wrongAlgorithm = tokenIssuer.sign(
      { sub: '7', email: profile.email },
      { algorithm: 'HS384', expiresIn: 3600 },
    );
    for (const token of [foreign, wrongAlgorithm]) {
      const response = await request(app.getHttpServer())
        .get('/members/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
      failure(response.body, 'AUTH401_3');
    }
    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects an unsigned JWT even when its identity and expiration look valid', async () => {
    const encode = (value: unknown) =>
      Buffer.from(JSON.stringify(value)).toString('base64url');
    const unsigned = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ sub: '7', email: profile.email, exp: Math.floor(Date.now() / 1000) + 3600 })}.`;
    const response = await request(app.getHttpServer())
      .get('/members/me')
      .set('Authorization', `Bearer ${unsigned}`)
      .expect(401);
    failure(response.body, 'AUTH401_3');
    expect(execute).not.toHaveBeenCalled();
  });

  it.each([
    { sub: '0', email: profile.email },
    { sub: '-1', email: profile.email },
    { sub: '1.5', email: profile.email },
    { sub: '9007199254740992', email: profile.email },
    { sub: '07', email: profile.email },
    { sub: 7, email: profile.email },
    { email: profile.email },
    { sub: '7' },
    { sub: '7', email: '' },
  ])(
    'rejects signed tokens with invalid identity claims %j',
    async (claims) => {
      const token = tokenIssuer.sign(claims, { expiresIn: 3600 });
      const response = await request(app.getHttpServer())
        .get('/members/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
      failure(response.body, 'AUTH401_3');
      expect(execute).not.toHaveBeenCalled();
    },
  );

  it('rejects a signed token without expiration', async () => {
    const token = tokenIssuer.sign({ sub: '7', email: profile.email });
    const response = await request(app.getHttpServer())
      .get('/members/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
    failure(response.body, 'AUTH401_3');
    expect(execute).not.toHaveBeenCalled();
  });

  it('queries my profile by the verified subject and returns only public fields', async () => {
    execute.mockResolvedValueOnce(
      rows([{ ...profile, password: passwordHash, member_id: 999 }]),
    );
    const response = await request(app.getHttpServer())
      .get('/members/me')
      .query({ memberId: 999 })
      .set('Authorization', `Bearer ${accessToken(7)}`)
      .expect(200);
    expect(response.body.result).toEqual({
      email: profile.email,
      nickname: profile.nickname,
      createdAt: createdAt.toISOString(),
    });
    expect(execute.mock.calls[0][1]).toEqual([7]);
    expect(response.text).not.toContain(passwordHash);
    expect(response.text).not.toContain('password');
    expect(response.body.code).toBe('COMMON200');
  });

  it('returns a member-specific 404 when the verified subject no longer exists', async () => {
    execute.mockResolvedValueOnce(rows([]));
    const response = await request(app.getHttpServer())
      .get('/members/me')
      .set('Authorization', `Bearer ${accessToken()}`)
      .expect(404);
    failure(response.body, 'MEMBER404_1');
  });

  it('updates only the verified member nickname and preserves registration time', async () => {
    execute
      .mockResolvedValueOnce(rows([profile]))
      .mockResolvedValueOnce(rows([]))
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const response = await request(app.getHttpServer())
      .patch('/members/me')
      .set('Authorization', `Bearer ${accessToken(7)}`)
      .send({ nickname: '변경회원' })
      .expect(200);
    expect(response.body.result).toEqual({
      email: profile.email,
      nickname: '변경회원',
      createdAt: createdAt.toISOString(),
    });
    expect(execute.mock.calls[0][1]).toEqual([7]);
    expect(execute.mock.calls[1][1]).toEqual(['변경회원', 7]);
    expect(execute.mock.calls[2][1]).toEqual(['변경회원', 7]);
    expect(response.body.code).toBe('COMMON200');
  });

  it('accepts saving the unchanged current nickname without a duplicate lookup or write', async () => {
    execute.mockResolvedValueOnce(rows([profile]));
    const response = await request(app.getHttpServer())
      .patch('/members/me')
      .set('Authorization', `Bearer ${accessToken()}`)
      .send({ nickname: profile.nickname })
      .expect(200);
    expect(response.body.result).toEqual({
      email: profile.email,
      nickname: profile.nickname,
      createdAt: createdAt.toISOString(),
    });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('returns a member-specific 404 before patching a nonexistent current account', async () => {
    execute.mockResolvedValueOnce(rows([]));
    const response = await request(app.getHttpServer())
      .patch('/members/me')
      .set('Authorization', `Bearer ${accessToken()}`)
      .send({ nickname: '변경회원' })
      .expect(404);
    failure(response.body, 'MEMBER404_1');
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('returns 404 if the current member disappears between profile read and update', async () => {
    execute
      .mockResolvedValueOnce(rows([profile]))
      .mockResolvedValueOnce(rows([]))
      .mockResolvedValueOnce([{ affectedRows: 0 }]);
    const response = await request(app.getHttpServer())
      .patch('/members/me')
      .set('Authorization', `Bearer ${accessToken()}`)
      .send({ nickname: '변경회원' })
      .expect(404);
    failure(response.body, 'MEMBER404_1');
  });

  it.each([
    {},
    { nickname: '' },
    { nickname: ' ' },
    { nickname: '가' },
    { nickname: '가'.repeat(13) },
    { nickname: null },
    { nickname: 123 },
    { nickname: '변경회원', memberId: 99 },
    { nickname: '변경회원', email: 'other@example.com' },
  ])(
    'rejects invalid or identity-changing profile patch %j before touching the database',
    async (body) => {
      const response = await request(app.getHttpServer())
        .patch('/members/me')
        .set('Authorization', `Bearer ${accessToken()}`)
        .send(body)
        .expect(400);
      failure(response.body, 'COMMON4001');
      expect(execute).not.toHaveBeenCalled();
    },
  );

  it('rejects an occupied nickname and excludes the current member in its duplicate query', async () => {
    execute
      .mockResolvedValueOnce(rows([profile]))
      .mockResolvedValueOnce(rows([{ member_id: 8 }]));
    const response = await request(app.getHttpServer())
      .patch('/members/me')
      .set('Authorization', `Bearer ${accessToken()}`)
      .send({ nickname: '다른회원' })
      .expect(409);
    failure(response.body, 'MEMBER409_1');
    expect(execute.mock.calls[1][1]).toEqual(['다른회원', 7]);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('maps a nickname race after its precheck to the same profile conflict', async () => {
    execute
      .mockResolvedValueOnce(rows([profile]))
      .mockResolvedValueOnce(rows([]))
      .mockRejectedValueOnce({
        code: 'ER_DUP_ENTRY',
        errno: 1062,
        sqlMessage:
          "Duplicate entry 'redacted' for key 'member.uq_member_nickname'",
      });
    const response = await request(app.getHttpServer())
      .patch('/members/me')
      .set('Authorization', `Bearer ${accessToken()}`)
      .send({ nickname: '변경회원' })
      .expect(409);
    failure(response.body, 'MEMBER409_1');
    expect(response.text).not.toContain('Duplicate entry');
  });

  it('creates the rating under the token subject even if the query string names another member', async () => {
    execute
      .mockResolvedValueOnce(rows([{ member_id: 7 }]))
      .mockResolvedValueOnce(rows([]))
      .mockResolvedValueOnce([{ insertId: 11, affectedRows: 1 }]);
    const response = await request(app.getHttpServer())
      .post('/ratings')
      .query({ memberId: 99 })
      .set('Authorization', `Bearer ${accessToken(7)}`)
      .send({ movieId: 550, score: 5 })
      .expect(201);
    expect(response.body.result.memberId).toBe(7);
    expect(execute.mock.calls[2][1]).toEqual([7, 550, 5, null]);
  });

  it.each(['post', 'patch', 'delete'] as const)(
    'removes the old member-ID-controlled %s rating mutation route',
    async (method) => {
      const path =
        method === 'post' ? '/members/99/ratings' : '/members/99/ratings/11';
      const response = await request(app.getHttpServer())
        [method](path)
        .set('Authorization', `Bearer ${accessToken()}`)
        .send({ movieId: 550, score: 5 })
        .expect(404);
      failure(response.body, 'COMMON404');
      expect(execute).not.toHaveBeenCalled();
    },
  );

  it('allows Authorization preflight requests without requiring a bearer token', async () => {
    const response = await request(app.getHttpServer())
      .options('/ratings')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type')
      .expect(204);
    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173',
    );
    expect(response.headers['access-control-allow-headers']).toMatch(
      /authorization/i,
    );
    expect(execute).not.toHaveBeenCalled();
  });
});
