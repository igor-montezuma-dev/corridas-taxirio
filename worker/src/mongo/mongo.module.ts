import { Global, Inject, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongoClient } from 'mongodb';
import type { Collection } from 'mongodb';

export const HISTORICO = Symbol('HISTORICO');
export const MONGO_CLIENT = Symbol('MONGO_CLIENT');

export interface DocHistory {
  _id: string;
  corridaId: string;
  tipo: string;
  status: string;
  motoristaId: string | null;
  ocorridoEm: string;
  registradoEm: Date;
}

@Global()
@Module({
  providers: [
    {
      provide: MONGO_CLIENT,
      inject: [ConfigService],
      useFactory: async (config: ConfigService): Promise<MongoClient> => {
        const client = new MongoClient(config.getOrThrow<string>('MONGO_URL'), {
          serverSelectionTimeoutMS: 2000,
        });
        await client.connect();
        return client;
      },
    },
    {
      provide: HISTORICO,
      inject: [MONGO_CLIENT],
      useFactory: async (
        client: MongoClient,
      ): Promise<Collection<DocHistory>> => {
        const collection = client
          .db()
          .collection<DocHistory>('historico_corridas');
        await collection.createIndex({ corridaId: 1, ocorridoEm: 1 });
        return collection;
      },
    },
  ],
  exports: [HISTORICO, MONGO_CLIENT],
})
export class MongoModule implements OnModuleDestroy {
  constructor(@Inject(MONGO_CLIENT) private readonly client: MongoClient) {}

  async onModuleDestroy(): Promise<void> {
    await this.client.close();
  }
}
