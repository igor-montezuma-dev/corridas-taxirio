import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import type { Pool } from 'mysql2/promise';
import { DB_POOL } from '../database/database.module';

@Controller('health')
export class HealthController {
    constructor(@Inject(DB_POOL) private readonly pool: Pool) {}

  @Get()
  async check(): Promise<{ status: string }> {
    try {
      await this.pool.query({ sql: 'SELECT 1', timeout: 2000 });
      return { status: 'ok' };
    } catch {
      throw new ServiceUnavailableException({ status: 'error', db: 'down' });
    }
  }
}
