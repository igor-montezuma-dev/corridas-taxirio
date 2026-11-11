import { describe, expect, it } from 'vitest';
import { mensagemDeErro } from './http';

describe('mensagemDeErro', () => {
  it('usa a mensagem do erro padrão do Nest', () => {
    const body = { statusCode: 409, message: 'Não é possível aceitar uma corrida com status aceita' };

    expect(mensagemDeErro(body, 409)).toBe('Não é possível aceitar uma corrida com status aceita');
  });

  it('lista os campos do erro de validação do Zod', () => {
    const body = {
      message: 'Dados inválidos',
      erros: [
        { campo: 'origem', mensagem: 'Obrigatório' },
        { campo: 'destino', mensagem: 'Obrigatório' },
      ],
    };

    expect(mensagemDeErro(body, 400)).toBe('origem: Obrigatório; destino: Obrigatório');
  });

  it('junta as mensagens quando o Nest devolve uma lista', () => {
    expect(mensagemDeErro({ message: ['a', 'b'] }, 400)).toBe('a; b');
  });

  it('usa o status quando o corpo não é JSON', () => {
    expect(mensagemDeErro(null, 502)).toBe('Erro 502: a API não respondeu com JSON');
  });
});
