import type { AcaoCorrida, StatusCorrida } from '../../api/types';

export const POLLING_MS = 3000;

export const ROTULO_STATUS: Record<StatusCorrida, string> = {
  solicitada: 'Solicitada',
  aceita: 'Aceita',
  em_andamento: 'Em andamento',
  finalizada: 'Finalizada',
};

export const ESTILO_STATUS: Record<StatusCorrida, string> = {
  solicitada: 'bg-fundo text-suave',
  aceita: 'bg-destaque-claro text-destaque',
  em_andamento: 'bg-destaque-claro text-destaque',
  finalizada: 'bg-neutro text-suave',
};

export const ROTULO_ACAO: Record<AcaoCorrida, string> = {
  aceitar: 'Aceitar',
  iniciar: 'Iniciar',
  finalizar: 'Finalizar',
};

export const MENSAGEM_ACAO: Record<AcaoCorrida, string> = {
  aceitar: 'Corrida aceita',
  iniciar: 'Corrida iniciada',
  finalizar: 'Corrida finalizada',
};
