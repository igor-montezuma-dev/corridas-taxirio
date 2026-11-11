import { toast } from 'sonner';
import type { AcaoCorrida, Usuario } from '../../api/types';
import { AvisoErro } from '../../components/ui/Aviso';
import { Cartao } from '../../components/ui/Cartao';
import { textoDoErro } from '../../lib/erros';
import { MENSAGEM_ACAO, POLLING_MS } from './constantes';
import { useAlterarStatus, useCorridas } from './hooks';
import { ItemCorrida } from './ItemCorrida';

interface ListaCorridasProps {
  token: string;
  usuario: Usuario;
}

export function ListaCorridas({ token, usuario }: ListaCorridasProps) {
  const corridas = useCorridas(token);
  const alterarStatus = useAlterarStatus(token);

  function executar(id: string, acao: AcaoCorrida) {
    alterarStatus.mutate(
      { id, acao },
      {
        onSuccess: () => toast.success(MENSAGEM_ACAO[acao]),
        onError: (error) => toast.error(textoDoErro(error)),
      },
    );
  }

  const titulo = usuario.perfil === 'passageiro' ? 'Minhas corridas' : 'Corridas';
  const lista = corridas.data ?? [];

  return (
    <Cartao>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[17px] font-semibold">{titulo}</h2>
        <span className="text-[13px] text-suave">
          {corridas.isFetching ? 'atualizando...' : `atualiza a cada ${POLLING_MS / 1000} s`}
        </span>
      </div>

      {corridas.isError && <AvisoErro>{textoDoErro(corridas.error)}</AvisoErro>}

      {corridas.isPending ? (
        <p className="mt-2 text-suave">Carregando...</p>
      ) : lista.length === 0 ? (
        <p className="mt-2 text-suave">Nenhuma corrida por aqui.</p>
      ) : (
        <ul className="divide-y divide-borda">
          {lista.map((corrida) => (
            <ItemCorrida
              key={corrida.id}
              corrida={corrida}
              usuario={usuario}
              ocupado={alterarStatus.isPending && alterarStatus.variables?.id === corrida.id}
              onAcao={(acao) => executar(corrida.id, acao)}
            />
          ))}
        </ul>
      )}
    </Cartao>
  );
}
