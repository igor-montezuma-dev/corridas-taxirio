import { Injectable } from '@nestjs/common';
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
}
