import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { CorridasModule } from './corridas/corridas.module';
import { MessagingModule } from './messaging/messaging.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule, AuthModule, CorridasModule, MessagingModule, RedisModule],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
