import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseService } from '../database/database.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.getOrThrow<string>('JWT_SECRET');
        if (Buffer.byteLength(secret, 'utf8') < 32) {
          throw new Error('JWT_SECRET must contain at least 32 UTF-8 bytes.');
        }
        const rawExpiration = config.get<string>(
          'JWT_ACCESS_EXPIRATION',
          '3600',
        );
        const expiration = Number(rawExpiration);
        if (!Number.isSafeInteger(expiration) || expiration <= 0) {
          throw new Error(
            'JWT_ACCESS_EXPIRATION must be positive integer seconds.',
          );
        }
        return {
          secret,
          signOptions: { algorithm: 'HS256' as const, expiresIn: expiration },
          verifyOptions: { algorithms: ['HS256' as const] },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [DatabaseService, AuthService, JwtAuthGuard],
  exports: [JwtModule, AuthService, JwtAuthGuard],
})
export class AuthModule {}
