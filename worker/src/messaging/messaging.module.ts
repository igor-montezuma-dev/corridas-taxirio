import { Module } from '@nestjs/common';
import { CorridaEventProcessor } from './corrida-event.processor';
import { CorridasConsumer } from './corridas.consumer';

@Module({
  providers: [CorridasConsumer, CorridaEventProcessor],
  exports: [CorridasConsumer],
})
export class MessagingModule {}