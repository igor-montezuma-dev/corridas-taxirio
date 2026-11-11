import type { ReactNode } from 'react';

interface AvisoProps {
  children: ReactNode;
}

export function AvisoErro({ children }: AvisoProps) {
  return <p className="rounded-lg bg-erro-claro px-3.5 py-2.5 text-sm text-erro">{children}</p>;
}
