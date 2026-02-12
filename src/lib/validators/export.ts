/**
 * Export Validators
 * Zod schemas for export validation
 */

import { z } from 'zod';

export const exportSchema = z.object({
  format: z.enum(['csv', 'datev']),
  dateRange: z.object({
    from: z.date(),
    to: z.date(),
  }),
  filters: z.record(z.string(), z.unknown()).optional(),
});

export type ExportInput = z.infer<typeof exportSchema>;
