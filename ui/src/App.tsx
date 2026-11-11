import { useState } from 'react';
import type { Usuario } from './api/types';
import { Botao } from './components/ui/Botao';
import { Login } from './features/auth/Login';
import { Painel } from './features/corridas/Painel';

interface Sessao {
  token: string;
  usuario: Usuario;
}

export function App() {
  const [sessao, setSessao] = useState<Sessao | null>(null);

  return (
    <div className="mx-auto max-w-3xl px-5 pt-8 pb-16">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Corridas</h1>
        {sessao && (
          <div className="flex items-center gap-3 text-sm text-suave">
            <span>
              {sessao.usuario.sub} · <strong>{sessao.usuario.perfil}</strong>
            </span>
            <Botao variante="link" onClick={() => setSessao(null)}>
              Trocar token
            </Botao>
          </div>
        )}
      </header>

      {sessao ? (
        <Painel token={sessao.token} usuario={sessao.usuario} />
      ) : (
        <Login onEntrar={(token, usuario) => setSessao({ token, usuario })} />
      )}
    </div>
  );
}
