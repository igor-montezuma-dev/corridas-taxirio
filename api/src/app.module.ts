import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { CorridasModule } from './corridas/corridas.module';
import { MessagingModule } from './messaging/messaging.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    CorridasModule,
    MessagingModule,
    RedisModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
