import { z } from 'zod';

export const joinSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  company: z.string().optional(),
  tier: z.enum(['basic', 'pro']),
});

export type JoinFormData = z.infer<typeof joinSchema>;
