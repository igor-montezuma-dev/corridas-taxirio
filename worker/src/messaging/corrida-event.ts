export type CorridaEventType = 'corrida.criada' | 'corrida.status_alterado';

export interface CorridaSnapshot {
  id: string;
  passageiroId: string;
  motoristaId: string | null;
  status: 'solicitada' | 'aceita' | 'em_andamento' | 'finalizada';
  origem: string;
  destino: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface CorridaEvent {
  eventId: string;
  tipo: CorridaEventType;
  corrida: CorridaSnapshot;
}