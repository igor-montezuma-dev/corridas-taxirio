import type { Corrida } from '../corridas/corrida';

export type EventType = 'corrida.criada' | 'corrida.status_alterado';

export interface CorridaEvent {
  tipo: EventType;
  corrida: Corrida;
}
