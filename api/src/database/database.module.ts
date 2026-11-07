import { Global, Inject, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPool } from 'mysql2/promise';
import type { Pool } from 'mysql2/promise';

export const DB_POOL = Symbol('DB_POOL');

@Global()
@Module({
     providers: [
    {
      provide: DB_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Pool =>
        createPool({
          host: config.getOrThrow<string>('DB_HOST'),
          port: Number(config.getOrThrow<string>('DB_PORT')),
          user: config.getOrThrow<string>('DB_USER'),
          password: config.getOrThrow<string>('DB_PASSWORD'),
          database: config.getOrThrow<string>('DB_NAME'),
          connectionLimit: 10,
          connectTimeout: 2000,
          timezone: 'Z',
        }),
    },
  ],
  exports: [DB_POOL],
})
export class DatabaseModule {
     constructor(@Inject(DB_POOL) private readonly pool: Pool) {}

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
