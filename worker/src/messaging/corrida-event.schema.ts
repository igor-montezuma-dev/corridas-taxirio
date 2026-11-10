import { z } from 'zod';

const corridaSnapshotSchema = z.object({
  id: z.string().uuid('corrida.id deve ser um UUID'),
  passageiroId: z.string().min(1, 'passageiroId é obrigatório'),
  motoristaId: z.string().min(1, 'motoristaId não pode ser vazio').nullable(),
  status: z.enum(['solicitada', 'aceita', 'em_andamento', 'finalizada'], {
    message: 'status inválido',
  }),
  origem: z.string().min(1, 'origem é obrigatória').max(255, 'origem muito longa'),
  destino: z.string().min(1, 'destino é obrigatório').max(255, 'destino muito longo'),
  criadoEm: z.string().datetime({ message: 'criadoEm deve ser uma data ISO' }),
  atualizadoEm: z.string().datetime({ message: 'atualizadoEm deve ser uma data ISO' }),
});

export const corridaEventSchema = z.object({
  eventId: z.string().uuid('eventId deve ser um UUID'),
  tipo: z.enum(['corrida.criada', 'corrida.status_alterado'], {
    message: 'tipo de evento inválido',
  }),
  corrida: corridaSnapshotSchema,
});

export type CorridaEvent = z.infer<typeof corridaEventSchema>;