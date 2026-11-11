import { ForbiddenException, ConflictException } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { EventsPublisher } from '../messaging/events.publisher';
import { Corrida } from './corrida';
import { CorridasRepository } from './corridas.repository';
import { CorridasService } from './corridas.service';

const passageiro1: AuthenticatedUser = {
  sub: 'passageiro-1',
  perfil: 'passageiro',
};
const passageiro2: AuthenticatedUser = {
  sub: 'passageiro-2',
  perfil: 'passageiro',
};
const motorista1: AuthenticatedUser = {
  sub: 'motorista-1',
  perfil: 'motorista',
};
const motorista2: AuthenticatedUser = {
  sub: 'motorista-2',
  perfil: 'motorista',
};

function buildCorrida(overrides: Partial<Corrida> = {}): Corrida {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    passageiroId: 'passageiro-1',
    motoristaId: null,
    status: 'solicitada',
    origem: 'Centro',
    destino: 'Barra',
    criadoEm: new Date('2026-11-10T12:00:00.000Z'),
    atualizadoEm: new Date('2026-11-10T12:00:00.000Z'),
    ...overrides,
  };
}

describe('CorridasService', () => {
  let service: CorridasService;
  let repository: jest.Mocked<
    Pick<
      CorridasRepository,
      'createWithIdempotency' | 'findById' | 'transitionStatus'
    >
  >;
  let publisher: jest.Mocked<Pick<EventsPublisher, 'publish'>>;
  let redis: { zrange: jest.Mock };

  beforeEach(() => {
    repository = {
      createWithIdempotency: jest.fn(),
      findById: jest.fn(),
      transitionStatus: jest.fn(),
    };
    publisher = { publish: jest.fn().mockResolvedValue(undefined) };
    redis = { zrange: jest.fn().mockResolvedValue([]) };

    service = new CorridasService(
      repository as unknown as CorridasRepository,
      publisher as unknown as EventsPublisher,
      redis as unknown as Redis,
    );
  });

  it('(a) Motorista aceita uma corrida solicitada e o evento é publicado', async () => {
    repository.transitionStatus.mockResolvedValue(true);
    const aceita = buildCorrida({
      status: 'aceita',
      motoristaId: 'motorista-1',
    });
    repository.findById.mockResolvedValue(aceita);

    const resultado = await service.updateStatus(
      motorista1,
      aceita.id,
      'aceitar',
    );

    expect(resultado.status).toBe('aceita');
    expect(resultado.motoristaId).toBe('motorista-1');

    expect(repository.transitionStatus).toHaveBeenCalledWith(
      aceita.id,
      'motorista-1',
      'solicitada',
      'aceita',
    );

    expect(publisher.publish).toHaveBeenCalledTimes(1);
    expect(publisher.publish).toHaveBeenCalledWith({
      tipo: 'corrida.status_alterado',
      corrida: aceita,
    });
  });

  it('(b) Passageiro cria uma corrida e o evento corrida.criada é publicado', async () => {
    const corrida = buildCorrida();
    repository.createWithIdempotency.mockResolvedValue({
      corrida,
      criada: true,
    });

    const resultado = await service.create(passageiro1, 'chave-teste', {
      origem: 'Centro',
      destino: 'Barra',
    });

    expect(resultado.criada).toBe(true);
    expect(publisher.publish).toHaveBeenCalledTimes(1);
    expect(publisher.publish).toHaveBeenCalledWith({
      tipo: 'corrida.criada',
      corrida: resultado.corrida,
    });
  });

  it('(b2) Repetição com a mesma chave não publica o evento de novo', async () => {
    const corrida = buildCorrida();
    repository.createWithIdempotency
      .mockResolvedValueOnce({ corrida, criada: true })
      .mockResolvedValueOnce({ corrida, criada: false });

    const body = { origem: 'Centro', destino: 'Barra' };
    const primeira = await service.create(passageiro1, 'chave-teste', body);
    const repeticao = await service.create(passageiro1, 'chave-teste', body);

    expect(primeira.criada).toBe(true);
    expect(repeticao.criada).toBe(false);
    expect(repeticao.corrida.id).toBe(primeira.corrida.id);

    expect(repository.createWithIdempotency).toHaveBeenCalledTimes(2);
    expect(
      repository.createWithIdempotency.mock.calls.map(([dados]) => dados.chave),
    ).toEqual(['chave-teste', 'chave-teste']);

    expect(publisher.publish).toHaveBeenCalledTimes(1);
    expect(publisher.publish).toHaveBeenCalledWith({
      tipo: 'corrida.criada',
      corrida,
    });
  });

  it('(c) motorista-2 não pode finalizar a corrida do motorista-1 (403)', async () => {
    repository.transitionStatus.mockResolvedValue(false);
    const corrida = buildCorrida({
      status: 'em_andamento',
      motoristaId: 'motorista-1',
    });
    repository.findById.mockResolvedValue(corrida);

    await expect(
      service.updateStatus(motorista2, corrida.id, 'finalizar'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(publisher.publish).not.toHaveBeenCalled();
  });

  it('(d) Iniciar uma corrida solicitada dá 409, não 403', async () => {
    repository.transitionStatus.mockResolvedValue(false);
    const corrida = buildCorrida({
      status: 'em_andamento',
      motoristaId: 'motorista-1',
    });
    repository.findById.mockResolvedValue(corrida);

    await expect(
      service.updateStatus(motorista1, corrida.id, 'iniciar'),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(publisher.publish).not.toHaveBeenCalled();
  });

  it('(e) Passageiro-2 não lê a corrida do passageiro-1, nem vinda do cache (403)', async () => {
    const corrida = buildCorrida();
    redis.zrange.mockResolvedValue([JSON.stringify(corrida)]);

    await expect(
      service.findOne(passageiro2, corrida.id),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(repository.findById).not.toHaveBeenCalled();
  });
});
