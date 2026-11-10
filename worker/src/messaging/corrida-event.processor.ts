import { Inject, Injectable, Logger } from '@nestjs/common';
import { MongoServerError } from 'mongodb';
import type { Collection } from 'mongodb';
import { HISTORICO } from '../mongo/mongo.module';
import type { DocHistory } from '../mongo/mongo.module';
import type { CorridaEvent } from './corrida-event.schema';

function isDuplicateKeyError(error: unknown): boolean {
  return error instanceof MongoServerError && error.code === 11000;
}

@Injectable()
export class CorridaEventProcessor {
  private readonly logger = new Logger(CorridaEventProcessor.name);

  constructor(
    @Inject(HISTORICO) private readonly historico: Collection<DocHistory>,
  ) {}

  async process(event: CorridaEvent): Promise<void> {
    await this.saveHistory(event);
    this.logger.log(
      `Processado ${event.tipo} (${event.eventId}) da corrida ${event.corrida.id}: ${event.corrida.status}`,
    );
  }

  private async saveHistory(event: CorridaEvent): Promise<void> {
    const doc: DocHistory = {
      _id: event.eventId,
      corridaId: event.corrida.id,
      tipo: event.tipo,
      status: event.corrida.status,
      motoristaId: event.corrida.motoristaId,
      ocorridoEm: event.corrida.atualizadoEm,
      registradoEm: new Date(),
    };

    try {
      await this.historico.insertOne(doc);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        this.logger.warn(
          `Evento ${event.eventId} já estava no histórico; seguindo para o cache`,
        );
        return;
      }
      throw error;
    }
  }
}
