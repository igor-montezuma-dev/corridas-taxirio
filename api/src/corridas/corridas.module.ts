import { Module } from '@nestjs/common';
import { CorridasController } from './corridas.controller';
import { CorridasService } from './corridas.service';
import { CorridasRepository } from './corridas.repository';
import { AuthModule } from '../auth/auth.module';

@Module({
   imports: [AuthModule],
  controllers: [CorridasController],
  providers: [CorridasService, CorridasRepository],
})
export class CorridasModule {}
