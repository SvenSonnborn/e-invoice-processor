/**
 * Invoice Validators
 * Zod schemas for invoice validation
 */

import { z } from 'zod';

export const invoiceSchema = z.object({
  id: z.string().optional(),
  invoiceNumber: z.string().min(1),
  issueDate: z.date(),
  dueDate: z.date().optional(),
  amount: z.number().positive(),
  currency: z.string().length(3),
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']),
});

export type InvoiceInput = z.infer<typeof invoiceSchema>;
