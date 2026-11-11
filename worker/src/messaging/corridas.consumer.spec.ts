import type { ConfigService } from '@nestjs/config';
import type { ConfirmChannel, ConsumeMessage } from 'amqplib';
import { CorridasConsumer } from './corridas.consumer';
import type { CorridaEventProcessor } from './corrida-event.processor';
import { FILA_DLQ, FILA_RETRY } from './topology';

const eventoValido = {
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
  },
};

function buildMessage(
  body: unknown,
  headers: Record<string, unknown> = {},
): ConsumeMessage {
  const content = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    content: Buffer.from(content),
    fields: {},
    properties: {
      messageId: 'msg-1',
      contentType: 'application/json',
      headers,
    },
  } as unknown as ConsumeMessage;
}

type Handle = (ch: ConfirmChannel, msg: ConsumeMessage) => Promise<void>;

describe('CorridasConsumer', () => {
  let ch: {
    sendToQueue: jest.Mock;
    waitForConfirms: jest.Mock;
    ack: jest.Mock;
  };
  let processor: { process: jest.Mock };
  let handle: Handle;

  beforeEach(() => {
    ch = {
      sendToQueue: jest.fn().mockReturnValue(true),
      waitForConfirms: jest.fn().mockResolvedValue(undefined),
      ack: jest.fn(),
    };
    processor = { process: jest.fn().mockResolvedValue(undefined) };

    const consumer = new CorridasConsumer(
      {} as ConfigService,
      processor as unknown as CorridaEventProcessor,
    );
    handle = (consumer as unknown as { handle: Handle }).handle.bind(consumer);
  });

  it('(c1) JSON inválido vai para a DLQ sem chamar o processor', async () => {
    const msg = buildMessage('{ isso não é json');

    await handle(ch as unknown as ConfirmChannel, msg);

    expect(ch.sendToQueue).toHaveBeenCalledWith(
      FILA_DLQ,
      msg.content,
      expect.objectContaining({ headers: { 'x-tentativas': 0 } }),
    );
    expect(ch.waitForConfirms).toHaveBeenCalled();
    expect(ch.ack).toHaveBeenCalledWith(msg);
    expect(processor.process).not.toHaveBeenCalled();
  });

  it('(c2) Evento que falha no Zod vai para a DLQ sem chamar o processor', async () => {
    const msg = buildMessage({
      eventId: '123',
      tipo: 'corrida.status_alterado',
    });

    await handle(ch as unknown as ConfirmChannel, msg);

    expect(ch.sendToQueue).toHaveBeenCalledWith(
      FILA_DLQ,
      msg.content,
      expect.objectContaining({ headers: { 'x-tentativas': 0 } }),
    );
    expect(ch.waitForConfirms).toHaveBeenCalled();
    expect(ch.ack).toHaveBeenCalledWith(msg);
    expect(processor.process).not.toHaveBeenCalled();
  });

  it('(c3) Falha na 1ª tentativa vai para o retry com x-tentativas 1', async () => {
    const msg = buildMessage(eventoValido);
    processor.process.mockRejectedValue(new Error('falhou'));

    await handle(ch as unknown as ConfirmChannel, msg);

    expect(processor.process).toHaveBeenCalled();
    expect(ch.sendToQueue).toHaveBeenCalledWith(
      FILA_RETRY,
      msg.content,
      expect.objectContaining({ headers: { 'x-tentativas': 1 } }),
    );
    expect(ch.waitForConfirms.mock.invocationCallOrder[0]).toBeLessThan(
      ch.ack.mock.invocationCallOrder[0],
    );
    expect(ch.ack).toHaveBeenCalledWith(msg);
  });

  it('(c4) Falha com x-tentativas 2 vai para a DLQ', async () => {
    const msg = buildMessage(eventoValido, { 'x-tentativas': 2 });
    processor.process.mockRejectedValue(new Error('falhou'));

    await handle(ch as unknown as ConfirmChannel, msg);

    expect(processor.process).toHaveBeenCalled();
    expect(ch.sendToQueue).toHaveBeenCalledWith(
      FILA_DLQ,
      msg.content,
      expect.objectContaining({ headers: { 'x-tentativas': 3 } }),
    );
    expect(ch.waitForConfirms.mock.invocationCallOrder[0]).toBeLessThan(
      ch.ack.mock.invocationCallOrder[0],
    );
    expect(ch.ack).toHaveBeenCalledWith(msg);
  });

  it('(c5) Processamento com sucesso só faz ack', async () => {
    const msg = buildMessage(eventoValido);

    await handle(ch as unknown as ConfirmChannel, msg);

    expect(processor.process).toHaveBeenCalledWith(eventoValido);
    expect(ch.sendToQueue).not.toHaveBeenCalled();
    expect(ch.waitForConfirms).not.toHaveBeenCalled();
    expect(ch.ack).toHaveBeenCalledWith(msg);
  });

  it('(c6) O retry mantém o correlationId da mensagem original', async () => {
    const msg = buildMessage(eventoValido);
    msg.properties.correlationId = 'rastro-123';
    processor.process.mockRejectedValue(new Error('falhou'));

    await handle(ch as unknown as ConfirmChannel, msg);

    expect(ch.sendToQueue).toHaveBeenCalledWith(
      FILA_RETRY,
      msg.content,
      expect.objectContaining({ correlationId: 'rastro-123' }),
    );
  });
});
