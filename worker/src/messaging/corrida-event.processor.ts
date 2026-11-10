import { Inject, Injectable, Logger } from '@nestjs/common';
import { MongoServerError } from 'mongodb';
import type { Collection } from 'mongodb';
import { HISTORICO } from '../mongo/mongo.module';
import type { DocHistory } from '../mongo/mongo.module';
import type { CorridaEvent } from './corrida-event.schema';
import type Redis from 'ioredis';
import { REDIS } from '../redis/redis.module';

function isDuplicateKeyError(error: unknown): boolean {
  return error instanceof MongoServerError && error.code === 11000;
}

const CACHE_TTL_SEGUNDOS = 24 * 60 * 60;

@Injectable()
export class CorridaEventProcessor {
  private readonly logger = new Logger(CorridaEventProcessor.name);

  constructor(
    @Inject(HISTORICO) private readonly historico: Collection<DocHistory>,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async process(event: CorridaEvent): Promise<void> {
    await this.saveHistory(event);
    await this.updateCache(event);
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

  private async updateCache(event: CorridaEvent): Promise<void> {
    const chave = `corrida:${event.corrida.id}`;
    const pontuacao = new Date(event.corrida.atualizadoEm).getTime();

    const results = await this.redis
      .multi()
      .zadd(chave, pontuacao, JSON.stringify(event.corrida))
      .zremrangebyrank(chave, 0, -2)
      .expire(chave, CACHE_TTL_SEGUNDOS)
      .exec();

    const failures = results?.filter(([err]) => err !== null);
    if (failures && failures.length > 0) {
      throw (
        failures[0]?.[1] ??
        new Error(`Falha ao atualizar o cache da corrida ${event.corrida.id}`)
      );
    }
  }
}
