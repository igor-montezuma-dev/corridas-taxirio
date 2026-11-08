export type StatusCorrida = 'solicitada' | 'aceita' | 'em_andamento' | 'finalizada';

export interface Corrida {
  id: string;
  passageiroId: string;
  motoristaId: string | null;
  status: StatusCorrida;
  origem: string;
  destino: string;
  criadoEm: Date;
  atualizadoEm: Date;
}