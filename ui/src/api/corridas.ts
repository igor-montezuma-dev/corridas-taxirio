import { request } from "./http";
import type { AcaoCorrida, Corrida } from "./types";

export const corridasApi = {
  listar: (token: string) => request<Corrida[]>(token, "/corridas"),

  criar: (token: string, chave: string, origem: string, destino: string) =>
    request<Corrida>(token, "/corridas", {
      method: "POST",
      headers: { "Idempotency-Key": chave },
      body: JSON.stringify({ origem, destino }),
    }),

  alterarStatus: (token: string, id: string, acao: AcaoCorrida) =>
    request<Corrida>(token, `/corridas/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ acao }),
    }),
};
