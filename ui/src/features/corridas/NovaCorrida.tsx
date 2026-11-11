import { useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';
import { Botao } from '../../components/ui/Botao';
import { Cartao } from '../../components/ui/Cartao';
import { ESTILO_CAMPO } from '../../components/ui/campo';
import { textoDoErro } from '../../lib/erros';
import { useCriarCorrida } from './hooks';
import type { PedidoCorrida } from './hooks';

interface NovaCorridaProps {
  token: string;
}

export function NovaCorrida({ token }: NovaCorridaProps) {
  const [origem, setOrigem] = useState('');
  const [destino, setDestino] = useState('');
  const [chave, setChave] = useState(() => crypto.randomUUID());
  const [ultimoPedido, setUltimoPedido] = useState<PedidoCorrida | null>(null);
  const criar = useCriarCorrida(token);

  function enviar(pedido: PedidoCorrida) {
    criar.mutate(pedido, {
      onSuccess: ({ status }) => {
        if (status === 201) {
          toast.success('201 · Corrida criada');
        } else {
          toast.info('200 · Pedido repetido: a corrida já existia e não foi criada outra');
        }
        setUltimoPedido(pedido);
        if (pedido.chave === chave) {
          setOrigem('');
          setDestino('');
          setChave(crypto.randomUUID());
        }
      },
      onError: (error) => toast.error(textoDoErro(error)),
    });
  }

  function submeter(event: FormEvent) {
    event.preventDefault();
    enviar({ chave, origem, destino });
  }

  return (
    <Cartao as="form" onSubmit={submeter}>
      <h2 className="mb-3 text-[17px] font-semibold">Pedir corrida</h2>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm text-suave">
          Origem
          <input
            value={origem}
            onChange={(e) => setOrigem(e.target.value)}
            maxLength={255}
            className={ESTILO_CAMPO}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-suave">
          Destino
          <input
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            maxLength={255}
            className={ESTILO_CAMPO}
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Botao type="submit" disabled={criar.isPending}>
          {criar.isPending ? 'Enviando...' : 'Pedir corrida'}
        </Botao>
        {ultimoPedido && (
          <Botao
            variante="secundario"
            disabled={criar.isPending}
            onClick={() => enviar(ultimoPedido)}
            title={`Idempotency-Key: ${ultimoPedido.chave}`}
          >
            Reenviar o último pedido (mesma chave)
          </Botao>
        )}
      </div>
    </Cartao>
  );
}
