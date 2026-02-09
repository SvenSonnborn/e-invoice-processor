import { z } from 'zod';

export const joinSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  company: z.string().optional(),
  tier: z.enum(['pro', 'business']),
});

export type JoinFormData = z.infer<typeof joinSchema>;
