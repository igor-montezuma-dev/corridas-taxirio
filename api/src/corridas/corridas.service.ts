import {
  ConflictException,
  ForbiddenException,
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

@Injectable()
export class CorridasService {
  constructor(private readonly corridasRepository: CorridasRepository) {}

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
    return this.corridasRepository.createWithIdempotency({
      id: randomUUID(),
      passageiroId: user.sub,
      chave,
      origem: body.origem,
      destino: body.destino,
    });
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
    const corrida = await this.corridasRepository.findById(id);
    if (!corrida) {
      throw new NotFoundException('Corrida não encontrada');
    }
    if (!this.canRead(user, corrida)) {
      throw new ForbiddenException('Você não tem acesso a esta corrida');
    }
    return corrida;
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
}
