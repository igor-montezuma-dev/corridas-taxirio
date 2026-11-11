export type Perfil = "passageiro" | "motorista";
export type StatusCorrida =
  | "solicitada"
  | "aceita"
  | "em_andamento"
  | "finalizada";
export type AcaoCorrida = "aceitar" | "iniciar" | "finalizar";

export interface Usuario {
  sub: string;
  perfil: Perfil;
}

export interface Corrida {
  id: string;
  passageiroId: string;
  motoristaId: string | null;
  status: StatusCorrida;
  origem: string;
  destino: string;
  criadoEm: string;
  atualizadoEm: string;
}
