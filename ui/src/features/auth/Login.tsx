import { useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';
import type { Usuario } from '../../api/types';
import { AvisoErro } from '../../components/ui/Aviso';
import { Botao } from '../../components/ui/Botao';
import { Cartao } from '../../components/ui/Cartao';
import { ESTILO_CAMPO } from '../../components/ui/campo';
import { textoDoErro } from '../../lib/erros';
import { useValidarToken } from './hooks';

interface LoginProps {
  onEntrar: (token: string, usuario: Usuario) => void;
}

export function Login({ onEntrar }: LoginProps) {
  const [valor, setValor] = useState('');
  const validar = useValidarToken();

  function entrar(event: FormEvent) {
    event.preventDefault();
    const token = valor.trim();
    if (!token) return;
    validar.mutate(token, {
      onSuccess: (usuario) => {
        toast.success(`Entrou como ${usuario.sub} (${usuario.perfil})`);
        onEntrar(token, usuario);
      },
    });
  }

  return (
    <Cartao as="form" className="flex flex-col gap-3" onSubmit={entrar}>
      <h2 className="text-[17px] font-semibold">Entrar com um token</h2>
      <p className="text-[13px] text-suave">
        Gere os tokens com{' '}
        <code className="rounded bg-fundo px-1.5 py-px font-mono">
          node scripts/generate-token.mjs
        </code>{' '}
        e cole um deles aqui.
      </p>
      <textarea
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        placeholder="eyJhbGciOiJSUzI1NiIs..."
        rows={4}
        spellCheck={false}
        className={`${ESTILO_CAMPO} resize-y font-mono text-[13px]`}
      />
      {validar.isError && <AvisoErro>{textoDoErro(validar.error)}</AvisoErro>}
      <Botao type="submit" disabled={validar.isPending || !valor.trim()}>
        {validar.isPending ? 'Validando...' : 'Entrar'}
      </Botao>
    </Cartao>
  );
}
