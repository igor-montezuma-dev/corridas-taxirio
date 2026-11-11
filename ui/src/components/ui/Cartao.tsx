import type { HTMLAttributes } from 'react';

type CartaoProps = HTMLAttributes<HTMLElement> & {
  as?: 'section' | 'form' | 'div';
};

export function Cartao({ as: Elemento = 'section', className = '', ...props }: CartaoProps) {
  return (
    <Elemento
      className={`rounded-xl border border-borda bg-white p-5 ${className}`}
      {...(props as HTMLAttributes<HTMLElement>)}
    />
  );
}
