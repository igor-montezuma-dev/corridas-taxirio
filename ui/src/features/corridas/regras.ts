import type { AcaoCorrida, Corrida, Usuario } from "../../api/types";

export function acaoDisponivel(corrida: Corrida, usuario: Usuario): AcaoCorrida | null {
  if (usuario.perfil !== 'motorista') return null;
  if (corrida.status === 'solicitada') return 'aceitar';
  if (corrida.motoristaId !== usuario.sub) return null;
  if (corrida.status === 'aceita') return 'iniciar';
  if (corrida.status === 'em_andamento') return 'finalizar';
  return null;
}
