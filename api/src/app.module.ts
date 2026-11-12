import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { CorridasModule } from './corridas/corridas.module';
import { MessagingModule } from './messaging/messaging.module';
import { RedisModule } from './redis/redis.module';
import { LoggerModule } from 'nestjs-pino';
import { MetricsController } from './metrics/metrics.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        genReqId: (req) => req.headers['x-request-id'] as string,
        customAttributeKeys: { reqId: 'correlation_id' },
        quietReqLogger: true,
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
    DatabaseModule,
    AuthModule,
    CorridasModule,
    MessagingModule,
    RedisModule,
  ],
  controllers: [HealthController, MetricsController],
})
export class AppModule {}
