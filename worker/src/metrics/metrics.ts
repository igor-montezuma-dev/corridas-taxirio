import {
  collectDefaultMetrics,
  Counter,
  Histogram,
  Registry,
} from '@prometheus-io/client';

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const processedEvents = new Counter({
  name: 'events_processed_total',
  help: 'Mensagens consumidas pelo worker, por tipo de evento e resultado',
  labelNames: ['type', 'result'] as const,
  registers: [registry],
});

export const processingDuration = new Histogram({
  name: 'event_processing_duration_seconds',
  help: 'Tempo de processamento de um evento (histórico e cache)',
  labelNames: ['type'] as const,
  buckets: [0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [registry],
});