import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { corridasApi } from '../../api/corridas';
import type { AcaoCorrida } from '../../api/types';
import { POLLING_MS } from './constantes';

export const corridasKey = (token: string) => ['corridas', token] as const;

export function useCorridas(token: string) {
  return useQuery({
    queryKey: corridasKey(token),
    queryFn: async () => (await corridasApi.listar(token)).body,
    refetchInterval: POLLING_MS,
  });
}

export interface PedidoCorrida {
  chave: string;
  origem: string;
  destino: string;
}

export function useCriarCorrida(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pedido: PedidoCorrida) =>
      corridasApi.criar(token, pedido.chave, pedido.origem, pedido.destino),
    onSettled: () => queryClient.invalidateQueries({ queryKey: corridasKey(token) }),
  });
}

export function useAlterarStatus(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, acao }: { id: string; acao: AcaoCorrida }) =>
      corridasApi.alterarStatus(token, id, acao),
    onSettled: () => queryClient.invalidateQueries({ queryKey: corridasKey(token) }),
  });
}
