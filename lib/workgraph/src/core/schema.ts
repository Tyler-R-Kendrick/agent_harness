import { z } from 'zod';

export const workGraphActorSchema = z.object({
  type: z.enum(['user', 'agent', 'system']),
  id: z.string().min(1),
  name: z.string().min(1).optional(),
});

export const workGraphPrioritySchema = z.enum(['none', 'low', 'medium', 'high', 'urgent']);
