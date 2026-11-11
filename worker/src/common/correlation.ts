import { AsyncLocalStorage } from 'node:async_hooks';

const storage = new AsyncLocalStorage<string>();

export const correlation = {
  run: <T>(id: string, fn: () => T): T => storage.run(id, fn),
  get: (): string | undefined => storage.getStore(),
};
