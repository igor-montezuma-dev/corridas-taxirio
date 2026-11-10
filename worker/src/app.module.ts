import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MessagingModule } from './messaging/messaging.module';
import { MongoModule } from './mongo/mongo.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), MessagingModule, MongoModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}