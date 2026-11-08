import { z } from 'zod';

export const createCorridaSchema = z
  .object({
    origem: z.string().trim().min(1, 'Origem é obrigatória').max(255, 'Origem muito longa'),
    destino: z.string().trim().min(1, 'Destino é obrigatório').max(255, 'Destino muito longo'),
  })
  .strict();

export type CreateCorrida = z.infer<typeof createCorridaSchema>;
