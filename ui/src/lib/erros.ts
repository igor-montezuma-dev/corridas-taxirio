import { ApiError } from '../api/http';

export function textoDoErro(error: unknown): string {
  if (error instanceof ApiError) return `${error.status} · ${error.message}`;
  return 'Não foi possível falar com a API';
}
