import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { MongoClient } from 'mongodb';
import { Redis } from 'ioredis';
import { CorridasConsumer } from '../messaging/corridas.consumer';
import { REDIS } from '../redis/redis.module';
import { MONGO_CLIENT } from '../mongo/mongo.module';

const HEALTH_TIMEOUT_MS = 2000;

@Controller('health')
export class HealthController {
  constructor(
    private readonly consumer: CorridasConsumer,
    @Inject(MONGO_CLIENT) private readonly mongo: MongoClient,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Get()
  async check() {
    const [mongo, redis] = await Promise.all([
      this.ping(() => this.mongo.db().command({ ping: 1 })),
      this.ping(() => this.redis.ping()),
    ]);
    const status = { rabbitmq: this.consumer.isConnected(), mongo, redis };

    if (!status.rabbitmq || !status.mongo || !status.redis) {
      throw new ServiceUnavailableException(status);
    }
    return status;
  }

  private async ping(fn: () => Promise<unknown>): Promise<boolean> {
    try {
      await Promise.race([
        fn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), HEALTH_TIMEOUT_MS),
        ),
      ]);
      return true;
    } catch {
      return false;
    }
  }
}
