import { randomUUID } from 'node:crypto';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect } from 'amqp-connection-manager';
import type {
  AmqpConnectionManager,
  ChannelWrapper,
} from 'amqp-connection-manager';
import type { ConfirmChannel } from 'amqplib';
import { CorridaEvent } from './corrida-event';

export const EXCHANGE = 'corridas';

@Injectable()
export class EventsPublisher implements OnModuleInit, OnModuleDestroy {
  private connection!: AmqpConnectionManager;
  private channel!: ChannelWrapper;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.connection = connect([this.config.getOrThrow<string>('RABBITMQ_URL')]);
    this.channel = this.connection.createChannel({
      json: true,
      publishTimeout: 2000,
      setup: async (channel: ConfirmChannel) => {
        await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
      },
    });
  }

  async publish(evento: CorridaEvent): Promise<string> {
    const eventId = randomUUID();
    await this.channel.publish(
      EXCHANGE,
      evento.tipo,
      { eventId, ...evento },
      {
        persistent: true,
        messageId: eventId,
        contentType: 'application/json',
      },
    );
    return eventId;
  }
  async onModuleDestroy(): Promise<void> {
    await this.channel.close();
    await this.connection.close();
  }
}
