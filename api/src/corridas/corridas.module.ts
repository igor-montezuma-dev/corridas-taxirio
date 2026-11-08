import { Module } from '@nestjs/common';
import { CorridasController } from './corridas.controller';
import { CorridasService } from './corridas.service';
import { CorridasRepository } from './corridas.repository';

@Module({
  controllers: [CorridasController],
  providers: [CorridasService, CorridasRepository],
})
export class CorridasModule {}
