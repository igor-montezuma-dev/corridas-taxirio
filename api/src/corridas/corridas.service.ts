import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CorridasRepository } from './corridas.repository';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import type { Corrida } from './corrida';
import type { CreateCorrida } from './dto/create-corrida.schema';
import { randomUUID } from 'node:crypto';
import { AcaoCorrida } from './dto/update-corrida-status.schema';
import { TRANSICOES } from './transicoes';
import { EventsPublisher } from '../messaging/events.publisher';
import { Logger } from '@nestjs/common';
import { CorridaEvent } from '../messaging/corrida-event';
import Redis from 'ioredis';
import { REDIS } from '../redis/redis.module';

@Injectable()
export class CorridasService {
  constructor(
    private readonly corridasRepository: CorridasRepository,
    private readonly eventsPublisher: EventsPublisher,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  private readonly logger = new Logger(CorridasService.name);

  private canRead(user: AuthenticatedUser, corrida: Corrida): boolean {
    if (user.perfil === 'passageiro') {
      return corrida.passageiroId === user.sub;
    }
    if (user.perfil === 'motorista') {
      return (
        corrida.status === 'solicitada' || corrida.motoristaId === user.sub
      );
    }
    return false;
  }

  async create(
    user: AuthenticatedUser,
    chave: string,
    body: CreateCorrida,
  ): Promise<{
    corrida: Corrida;
    criada: boolean;
  }> {
    const result = await this.corridasRepository.createWithIdempotency({
      id: randomUUID(),
      passageiroId: user.sub,
      chave,
      origem: body.origem,
      destino: body.destino,
    });

    if (result.criada) {
      await this.publishSafely({
        tipo: 'corrida.criada',
        corrida: result.corrida,
      });
    }

    return result;
  }

  async findAll(user: AuthenticatedUser): Promise<Corrida[]> {
    if (user.perfil === 'passageiro') {
      return this.corridasRepository.findByPassageiroId(user.sub);
    }
    if (user.perfil === 'motorista') {
      return this.corridasRepository.findForMotorista(user.sub);
    }

    throw new ForbiddenException('Perfil inválido');
  }

  async findOne(user: AuthenticatedUser, id: string): Promise<Corrida> {
    const corrida =
      (await this.findInCache(id)) ??
      (await this.corridasRepository.findById(id));

    if (!corrida) {
      throw new NotFoundException('Corrida não encontrada');
    }
    if (!this.canRead(user, corrida)) {
      throw new ForbiddenException('Você não tem acesso a esta corrida');
    }
    return corrida;
  }

  private async findInCache(id: string): Promise<Corrida | null> {
    try {
      const key = `corrida:${id}`;
      const [member] = await this.redis.zrange(key, '-1', '-1');
      if (!member) {
        return null;
      }
      const cachedData = JSON.parse(member) as Corrida;
      return {
        ...cachedData,
        criadoEm: new Date(cachedData.criadoEm),
        atualizadoEm: new Date(cachedData.atualizadoEm),
      };
    } catch (error) {
      this.logger.warn(
        `Falha ao buscar corrida ${id} no cache: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  async updateStatus(
    user: AuthenticatedUser,
    id: string,
    acao: AcaoCorrida,
  ): Promise<Corrida> {
    const { de, para } = TRANSICOES[acao];
    const atualizou = await this.corridasRepository.transitionStatus(
      id,
      user.sub,
      de,
      para,
    );

    const corrida = await this.corridasRepository.findById(id);
    if (!corrida) {
      throw new NotFoundException('Corrida não encontrada');
    }
    if (atualizou) {
      await this.publishSafely({ tipo: 'corrida.status_alterado', corrida });
      return corrida;
    }

    if (
      acao !== 'aceitar' &&
      corrida.motoristaId !== null &&
      corrida.motoristaId !== user.sub
    ) {
      throw new ForbiddenException('Esta corrida pertence a outro motorista');
    }
    throw new ConflictException(
      `Não é possível ${acao} uma corrida com status ${corrida.status}`,
    );
  }

  private async publishSafely(evento: CorridaEvent): Promise<void> {
    try {
      await this.eventsPublisher.publish(evento);
    } catch (error) {
      this.logger.error(
        `Falha ao publicar ${evento.tipo} da corrida ${evento.corrida.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
