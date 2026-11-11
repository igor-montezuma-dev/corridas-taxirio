import type { ButtonHTMLAttributes } from 'react';

type Variante = 'primario' | 'secundario' | 'link';
type Tamanho = 'normal' | 'pequeno';

interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamanho?: Tamanho;
}

const ESTILO_VARIANTE: Record<Variante, string> = {
  primario: 'bg-destaque text-white hover:bg-destaque/90',
  secundario: 'border border-destaque text-destaque hover:bg-destaque-claro',
  link: 'p-0 font-medium text-destaque underline',
};

const ESTILO_TAMANHO: Record<Tamanho, string> = {
  normal: 'px-4 py-2.5',
  pequeno: 'px-3 py-1.5 text-[13px]',
};

export function Botao({
  variante = 'primario',
  tamanho = 'normal',
  className = '',
  type = 'button',
  ...props
}: BotaoProps) {
  const espacamento = variante === 'link' ? '' : ESTILO_TAMANHO[tamanho];

  return (
    <button
      type={type}
      className={`cursor-pointer rounded-lg font-semibold transition-colors disabled:cursor-default disabled:opacity-50 ${ESTILO_VARIANTE[variante]} ${espacamento} ${className}`}
      {...props}
    />
  );
}
