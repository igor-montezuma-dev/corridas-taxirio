import { z } from 'zod';

export const updateCorridaStatusSchema = z
  .object({
    acao: z.enum(['aceitar', 'iniciar', 'finalizar']),
  })
  .strict();

export type UpdateCorridaStatus = z.infer<typeof updateCorridaStatusSchema>;
export type AcaoCorrida = UpdateCorridaStatus['acao'];