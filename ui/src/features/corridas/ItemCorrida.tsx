import { toast } from 'sonner';
import type { AcaoCorrida, Corrida, Usuario } from '../../api/types';
import { Botao } from '../../components/ui/Botao';
import { ESTILO_STATUS, ROTULO_ACAO, ROTULO_STATUS } from './constantes';
import { acaoDisponivel } from './regras';

interface ItemCorridaProps {
  corrida: Corrida;
  usuario: Usuario;
  ocupado: boolean;
  onAcao: (acao: AcaoCorrida) => void;
}

export function ItemCorrida({ corrida, usuario, ocupado, onAcao }: ItemCorridaProps) {
  const acao = acaoDisponivel(corrida, usuario);
  const outraPessoa =
    usuario.perfil === 'passageiro'
      ? (corrida.motoristaId ?? 'sem motorista')
      : corrida.passageiroId;

  function copiarId() {
    void navigator.clipboard
      ?.writeText(corrida.id)
      .then(() => toast('Id copiado', { description: corrida.id }));
  }

  return (
    <li className="flex flex-col items-start gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex gap-2 font-medium">
          <span>{corrida.origem}</span>
          <span className="text-suave">→</span>
          <span>{corrida.destino}</span>
        </div>
        <button
          type="button"
          title="Copiar o id completo"
          onClick={copiarId}
          className="cursor-pointer self-start font-mono text-xs text-suave hover:text-destaque hover:underline"
        >
          {corrida.id}
        </button>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ESTILO_STATUS[corrida.status]}`}
        >
          {ROTULO_STATUS[corrida.status]}
        </span>
        <span className="text-[13px] text-suave">
          {outraPessoa} · {new Date(corrida.criadoEm).toLocaleTimeString('pt-BR')}
        </span>
        {acao && (
          <Botao tamanho="pequeno" disabled={ocupado} onClick={() => onAcao(acao)}>
            {ocupado ? '...' : ROTULO_ACAO[acao]}
          </Botao>
        )}
      </div>
    </li>
  );
}
