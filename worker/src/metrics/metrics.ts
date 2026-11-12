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

const TYPES = ['corrida.criada', 'corrida.status_alterado'] as const;
const RESULTS = ['success', 'retry', 'dlq'] as const;

for (const type of TYPES) {
  for (const result of RESULTS) {
    processedEvents.inc({ type, result }, 0);
  }
}
processedEvents.inc({ type: 'unknown', result: 'invalid' }, 0);

export const processingDuration = new Histogram({
  name: 'event_processing_duration_seconds',
  help: 'Tempo de processamento de um evento (histórico e cache)',
  labelNames: ['type'] as const,
  buckets: [0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [registry],
});

export const queueDelay = new Histogram({
  name: 'event_queue_delay_seconds',
  help: 'Tempo entre a mudança da corrida na API e o início do processamento no worker',
  labelNames: ['type'] as const,
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 15, 60],
  registers: [registry],
});
