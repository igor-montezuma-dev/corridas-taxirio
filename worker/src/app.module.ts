import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MessagingModule } from './messaging/messaging.module';
import { MongoModule } from './mongo/mongo.module';
import { RedisModule } from './redis/redis.module';
import { HealthController } from './health/health.controller';
import { LoggerModule } from 'nestjs-pino';
import { correlation } from './common/correlation';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        mixin: () => {
          const id = correlation.get();
          return id ? { correlation_id: id } : {};
        },
        serializers: {
          req: (req: { method: string; url: string }) => ({
            method: req.method,
            url: req.url,
          }),
          res: (res: { statusCode: number }) => ({
            statusCode: res.statusCode,
          }),
        },
        autoLogging: { ignore: (req) => req.url === '/health' },
      },
    }),
    MessagingModule,
    MongoModule,
    RedisModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
