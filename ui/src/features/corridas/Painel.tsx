import type { Usuario } from '../../api/types';
import { ListaCorridas } from './ListaCorridas';
import { NovaCorrida } from './NovaCorrida';

interface PainelProps {
  token: string;
  usuario: Usuario;
}

export function Painel({ token, usuario }: PainelProps) {
  return (
    <main className="flex flex-col gap-4">
      {usuario.perfil === 'passageiro' && <NovaCorrida token={token} />}
      <ListaCorridas token={token} usuario={usuario} />
    </main>
  );
}
