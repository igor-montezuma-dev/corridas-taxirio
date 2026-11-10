import { Injectable, Logger } from '@nestjs/common';
import type { CorridaEvent } from './corrida-event';

@Injectable()
export class CorridaEventProcessor {
  private readonly logger = new Logger(CorridaEventProcessor.name);

  process(evento: CorridaEvent): Promise<void> {
    this.logger.log(
      `Recebido ${evento.tipo} (${evento.eventId}) da corrida ${evento.corrida.id}: ${evento.corrida.status}`,
    );
    return Promise.resolve();
  }
}