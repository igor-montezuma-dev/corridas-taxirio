import type { StatusCorrida } from './corrida';
import { AcaoCorrida } from './dto/update-corrida-status.schema';


export const TRANSICOES: Record<AcaoCorrida, { de: StatusCorrida; para: StatusCorrida }> = {
  aceitar: { de: 'solicitada', para: 'aceita' },
  iniciar: { de: 'aceita', para: 'em_andamento' },
  finalizar: { de: 'em_andamento', para: 'finalizada' },
};