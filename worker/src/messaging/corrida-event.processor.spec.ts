import { MongoServerError } from 'mongodb';
import type { Collection } from 'mongodb';
import type { Redis } from 'ioredis';
import { CorridaEventProcessor } from './corrida-event.processor';
import type { CorridaEvent } from './corrida-event.schema';
import type { DocHistory } from '../mongo/mongo.module';

function buildEvent(
  overrides: Partial<CorridaEvent['corrida']> = {},
): CorridaEvent {
  return {
    eventId: '22222222-2222-4222-8222-222222222222',
    tipo: 'corrida.status_alterado',
    corrida: {
      id: '11111111-1111-4111-8111-111111111111',
      passageiroId: 'passageiro-1',
      motoristaId: 'motorista-1',
      status: 'aceita',
      origem: 'Centro',
      destino: 'Barra',
      criadoEm: '2026-11-10T12:00:00.000Z',
      atualizadoEm: '2026-11-10T12:00:05.000Z',
      ...overrides,
    },
  };
}

describe('CorridaEventProcessor', () => {
  let processor: CorridaEventProcessor;
  let historico: { insertOne: jest.Mock };
  let pipeline: {
    zadd: jest.Mock;
    zremrangebyrank: jest.Mock;
    expire: jest.Mock;
    exec: jest.Mock;
  };
  let redis: { multi: jest.Mock };

  beforeEach(() => {
    historico = {
      insertOne: jest.fn().mockResolvedValue({ acknowledged: true }),
    };

    pipeline = {
      zadd: jest.fn().mockReturnThis(),
      zremrangebyrank: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        [null, 1],
        [null, 0],
        [null, 1],
      ]),
    };
    redis = { multi: jest.fn().mockReturnValue(pipeline) };

    processor = new CorridaEventProcessor(
      historico as unknown as Collection<DocHistory>,
      redis as unknown as Redis,
    );
  });

  it('(f1) Evento novo vai para o histórico e para o cache', async () => {
    const event = buildEvent();

    await processor.process(event);

    expect(historico.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: event.eventId,
        corridaId: event.corrida.id,
      }),
    );
    expect(pipeline.zadd).toHaveBeenCalledWith(
      `corrida:${event.corrida.id}`,
      new Date(event.corrida.atualizadoEm).getTime(),
      JSON.stringify(event.corrida),
    );
    expect(pipeline.zremrangebyrank).toHaveBeenCalledWith(
      `corrida:${event.corrida.id}`,
      0,
      -2,
    );
  });

  it('(f2) Evento duplicado não quebra e ainda atualiza o cache', async () => {
    const event = buildEvent();
    historico.insertOne.mockRejectedValue(
      new MongoServerError({ message: 'E11000 duplicate key', code: 11000 }),
    );

    await expect(processor.process(event)).resolves.toBeUndefined();

    expect(pipeline.zadd).toHaveBeenCalledWith(
      `corrida:${event.corrida.id}`,
      new Date(event.corrida.atualizadoEm).getTime(),
      JSON.stringify(event.corrida),
    );
  });
  it('(f3) Outro erro do Mongo propaga e o cache não é atualizado', async () => {
    const event = buildEvent();
    historico.insertOne.mockRejectedValue(
      new MongoServerError({ message: 'E99999 unknown error', code: 99999 }),
    );

    await expect(processor.process(event)).rejects.toThrow(MongoServerError);
    expect(redis.multi).not.toHaveBeenCalled();
  });
  it('(f4) Falha dentro do exec do Redis propaga', async () => {
    const event = buildEvent();

    pipeline.exec.mockResolvedValue([
      [null, 1],
      [null, 0],
      [new Error('Redis error'), null],
    ]);

    await expect(processor.process(event)).rejects.toThrow(
      'Falha ao atualizar o cache',
    );
  });

  it('(f4b) Exec sem resultado (transação abortada) propaga', async () => {
    const event = buildEvent();

    pipeline.exec.mockResolvedValue(null);

    await expect(processor.process(event)).rejects.toThrow(
      'Falha ao atualizar o cache',
    );
  });
});
