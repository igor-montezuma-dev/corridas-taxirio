import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect } from 'amqp-connection-manager';
import type {
  AmqpConnectionManager,
  ChannelWrapper,
} from 'amqp-connection-manager';
import type { ConfirmChannel, ConsumeMessage } from 'amqplib';
import { CorridaEventProcessor } from './corrida-event.processor';
import {
  EXCHANGE,
  FILA,
  FILA_DLQ,
  FILA_RETRY,
  MAX_TENTATIVAS,
  RETRY_DELAY_MS,
} from './topology';
import { CorridaEvent, corridaEventSchema } from './corrida-event.schema';

@Injectable()
export class CorridasConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CorridasConsumer.name);
  private connection!: AmqpConnectionManager;
  private channel!: ChannelWrapper;

  constructor(
    private readonly config: ConfigService,
    private readonly processor: CorridaEventProcessor,
  ) {}

  onModuleInit(): void {
    this.connection = connect([this.config.getOrThrow<string>('RABBITMQ_URL')]);
    this.channel = this.connection.createChannel({
      setup: async (ch: ConfirmChannel) => {
        await ch.assertExchange(EXCHANGE, 'topic', { durable: true });

        await ch.assertQueue(FILA, { durable: true });
        await ch.bindQueue(FILA, EXCHANGE, 'corrida.*');

        await ch.assertQueue(FILA_RETRY, {
          durable: true,
          arguments: {
            'x-message-ttl': RETRY_DELAY_MS,
            'x-dead-letter-exchange': '',
            'x-dead-letter-routing-key': FILA,
          },
        });

        await ch.assertQueue(FILA_DLQ, { durable: true });

        await ch.prefetch(10);
        await ch.consume(FILA, (msg) => {
          if (msg) void this.handle(ch, msg);
        });
      },
    });
  }

  isConnected(): boolean {
    return this.connection.isConnected();
  }

  private async handle(ch: ConfirmChannel, msg: ConsumeMessage): Promise<void> {
    let payload: unknown;
    try {
      payload = JSON.parse(msg.content.toString());
    } catch {
      this.logger.error(
        'Mensagem com JSON inválido; enviada direto para a DLQ',
      );
      await this.forward(ch, FILA_DLQ, msg, 0);
      ch.ack(msg);
      return;
    }

    const result = corridaEventSchema.safeParse(payload);
    if (!result.success) {
      this.logger.error(
        `Evento inválido enviado para a DLQ: ${result.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ')}`,
      );
      await this.forward(ch, FILA_DLQ, msg, 0);
      ch.ack(msg);
      return;
    }
    const evento = result.data;

    try {
      await this.processor.process(evento);
      ch.ack(msg);
    } catch (error) {
      const tentativas =
        Number(msg.properties.headers?.['x-tentativas'] ?? 0) + 1;
      const destino = tentativas < MAX_TENTATIVAS ? FILA_RETRY : FILA_DLQ;
      this.logger.warn(
        `Falha ao processar ${evento.eventId} (tentativa ${tentativas}); enviando para ${destino}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      await this.forward(ch, destino, msg, tentativas);
      ch.ack(msg);
    }
  }
  private async forward(
    ch: ConfirmChannel,
    fila: string,
    msg: ConsumeMessage,
    tentativas: number,
  ): Promise<void> {
    ch.sendToQueue(fila, msg.content, {
      persistent: true,
      messageId: msg.properties.messageId as string,
      contentType: msg.properties.contentType as string,
      headers: { ...msg.properties.headers, 'x-tentativas': tentativas },
    });
    await ch.waitForConfirms();
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel.close();
    await this.connection.close();
  }
}
