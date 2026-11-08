import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CorridasRepository } from './corridas.repository';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import type { Corrida } from './corrida';
import type { CreateCorrida } from './dto/create-corrida.schema';
import { randomUUID } from 'node:crypto';

@Injectable()
export class CorridasService {
  constructor(private readonly corridasRepository: CorridasRepository) {}

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

private canRead(user: AuthenticatedUser, corrida: Corrida): boolean {
  if (user.perfil === 'passageiro') {
    return corrida.passageiroId === user.sub;
  }
  if (user.perfil === 'motorista') {
    return corrida.status === 'solicitada' || corrida.motoristaId === user.sub;
  }
  return false;
}
}
