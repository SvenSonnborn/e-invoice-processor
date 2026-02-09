export interface InvoiceData {
  id?: string; number?: string | null; issueDate?: Date | string | null; dueDate?: Date | string | null;
  currency?: string | null; netAmount?: number | string | null; taxAmount?: number | string | null;
  grossAmount?: number | string | null; supplierName?: string | null; customerName?: string | null;
  lineItems?: LineItemData[];
}
export interface LineItemData {
  id?: string; positionIndex?: number; description?: string | null; quantity?: number | string | null;
  unitPrice?: number | string | null; taxRate?: number | string | null; netAmount?: number | string | null;
  taxAmount?: number | string | null; grossAmount?: number | string | null;
}
export interface GoBDViolation {
  code: string; message: string; field: string; severity: 'error' | 'warning'; details?: Record<string, unknown>;
}
export interface GoBDWarning {
  code: string; message: string; field?: string; details?: Record<string, unknown>;
}
export interface GoBDValidationResult {
  isCompliant: boolean; badge: 'compliant' | 'non-compliant' | 'warning';
  violations: GoBDViolation[]; warnings: GoBDWarning[]; validatedAt: Date; invoiceId?: string;
}
export interface ValidationContext {
  invoice: InvoiceData; strictMode?: boolean; tolerance?: number;
}
export interface RuleResult {
  passed: boolean; violations: GoBDViolation[]; warnings: GoBDWarning[];
}
export interface ValidationOptions {
  strictMode?: boolean; tolerance?: number; validateLineItems?: boolean;
}
