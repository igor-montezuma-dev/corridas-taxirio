import { describe, expect, it } from 'vitest';
import { acaoDisponivel } from './regras';
import { Corrida, Usuario } from '../../api/types';

const motorista1: Usuario = { sub: 'motorista-1', perfil: 'motorista' };
const motorista2: Usuario = { sub: 'motorista-2', perfil: 'motorista' };
const passageiro1: Usuario = { sub: 'passageiro-1', perfil: 'passageiro' };

function buildCorrida(overrides: Partial<Corrida> = {}): Corrida {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    passageiroId: 'passageiro-1',
    motoristaId: null,
    status: 'solicitada',
    origem: 'Centro',
    destino: 'Barra',
    criadoEm: '2026-11-10T12:00:00.000Z',
    atualizadoEm: '2026-11-10T12:00:00.000Z',
    ...overrides,
  };
}

describe('acaoDisponivel', () => {
  it('passageiro não vê nenhuma ação', () => {
    expect(acaoDisponivel(buildCorrida(), passageiro1)).toBeNull();
  });

  it('qualquer motorista vê "aceitar" numa corrida solicitada', () => {
    expect(acaoDisponivel(buildCorrida(), motorista1)).toBe('aceitar');
    expect(acaoDisponivel(buildCorrida(), motorista2)).toBe('aceitar');
  });

  it('o motorista da corrida vê "iniciar" e depois "finalizar"', () => {
    const aceita = buildCorrida({ status: 'aceita', motoristaId: 'motorista-1' });
    const emAndamento = buildCorrida({ status: 'em_andamento', motoristaId: 'motorista-1' });

    expect(acaoDisponivel(aceita, motorista1)).toBe('iniciar');
    expect(acaoDisponivel(emAndamento, motorista1)).toBe('finalizar');
  });

  it('outro motorista não vê ação numa corrida que não é dele', () => {
    const aceita = buildCorrida({ status: 'aceita', motoristaId: 'motorista-1' });

    expect(acaoDisponivel(aceita, motorista2)).toBeNull();
  });

  it('corrida finalizada não tem ação', () => {
    const finalizada = buildCorrida({ status: 'finalizada', motoristaId: 'motorista-1' });

    expect(acaoDisponivel(finalizada, motorista1)).toBeNull();
  });
});
