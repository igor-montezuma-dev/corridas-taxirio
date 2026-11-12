import { Inject, Injectable } from '@nestjs/common';
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { DB_POOL } from '../database/database.module';
import type { Corrida, StatusCorrida } from './corrida';

interface CorridaRow extends RowDataPacket {
  id: string;
  passageiro_id: string;
  motorista_id: string | null;
  status: StatusCorrida;
  origem: string;
  destino: string;
  criado_em: Date;
  atualizado_em: Date;
}

export interface NovaCorrida {
  id: string;
  passageiroId: string;
  chave: string;
  origem: string;
  destino: string;
}

const COLUNAS =
  'id, passageiro_id, motorista_id, status, origem, destino, criado_em, atualizado_em';

// Colunas com o alias "c" para evitar ambiguidades em joins
const COLUNAS_C =
  'c.id, c.passageiro_id, c.motorista_id, c.status, c.origem, c.destino, c.criado_em, c.atualizado_em';

function toCorrida(row: CorridaRow): Corrida {
  return {
    id: row.id,
    passageiroId: row.passageiro_id,
    motoristaId: row.motorista_id,
    status: row.status,
    origem: row.origem,
    destino: row.destino,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
  };
}

function isDuplicateKeyError(erro: unknown): boolean {
  return (
    typeof erro === 'object' &&
    erro !== null &&
    'code' in erro &&
    erro.code === 'ER_DUP_ENTRY'
  );
}

@Injectable()
export class CorridasRepository {
  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}

  async findByPassageiroId(passageiroId: string): Promise<Corrida[]> {
    const [rows] = await this.pool.execute<CorridaRow[]>(
      `SELECT ${COLUNAS} FROM corridas WHERE passageiro_id = ? 
      ORDER BY criado_em DESC
      LIMIT 50`,
      [passageiroId],
    );
    return rows.map(toCorrida);
  }

  async findForMotorista(motoristaId: string): Promise<Corrida[]> {
    const [rows] = await this.pool.execute<CorridaRow[]>(
      `SELECT ${COLUNAS} FROM corridas
      WHERE status = 'solicitada' OR motorista_id = ?
      ORDER BY status = 'solicitada' DESC,
        CASE WHEN status = 'solicitada' THEN criado_em END ASC,
        criado_em DESC
      LIMIT 50`,
      [motoristaId],
    );
    return rows.map(toCorrida);
  }

  async findById(id: string): Promise<Corrida | null> {
    const [rows] = await this.pool.execute<CorridaRow[]>(
      `SELECT ${COLUNAS} FROM corridas WHERE id = ?`,
      [id],
    );
    return rows[0] ? toCorrida(rows[0]) : null;
  }

  async findByIdempotencyKey(
    passageiroId: string,
    chave: string,
  ): Promise<Corrida | null> {
    const [rows] = await this.pool.execute<CorridaRow[]>(
      `SELECT ${COLUNAS_C}
         FROM corridas c
        INNER JOIN idempotency_keys ik ON ik.corrida_id = c.id
        WHERE ik.passageiro_id = ? AND ik.chave = ?`,
      [passageiroId, chave],
    );
    return rows[0] ? toCorrida(rows[0]) : null;
  }

  async createWithIdempotency(
    dados: NovaCorrida,
  ): Promise<{ corrida: Corrida; criada: boolean }> {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute(
        `INSERT INTO corridas (id, passageiro_id,  origem, destino, criado_em, atualizado_em)
           VALUES (?, ?,?, ?, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))`,
        [dados.id, dados.passageiroId, dados.origem, dados.destino],
      );
      await conn.execute(
        `INSERT INTO idempotency_keys (passageiro_id, chave, corrida_id)
           VALUES (?, ?, ?)`,
        [dados.passageiroId, dados.chave, dados.id],
      );
      await conn.commit();
      const corrida = await this.findById(dados.id);
      if (!corrida) {
        throw new Error('Corrida não encontrada após a criação');
      }
      return { corrida: corrida, criada: true };
    } catch (error) {
      await conn.rollback();

      if (isDuplicateKeyError(error)) {
        const corridaExistente = await this.findByIdempotencyKey(
          dados.passageiroId,
          dados.chave,
        );
        if (corridaExistente) {
          return { corrida: corridaExistente, criada: false };
        }
      }

      throw error;
    } finally {
      conn.release();
    }
  }

  async transitionStatus(
    id: string,
    motoristaId: string,
    de: StatusCorrida,
    para: StatusCorrida,
  ): Promise<boolean> {
    if (de === 'solicitada') {
      const [result] = await this.pool.execute<ResultSetHeader>(
        `UPDATE corridas SET status = ?, motorista_id = ? WHERE id = ? AND status = ? AND motorista_id IS NULL`,
        [para, motoristaId, id, de],
      );
      return result.affectedRows > 0;
    }

    const [result] = await this.pool.execute<ResultSetHeader>(
      `UPDATE corridas SET status = ? WHERE id = ? AND status = ? AND motorista_id = ?`,
      [para, id, de, motoristaId],
    );
    return result.affectedRows > 0;
  }
}
