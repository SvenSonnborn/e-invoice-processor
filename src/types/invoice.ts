export type InvoiceFormat = "ZUGFERD" | "XRECHNUNG" | "UNKNOWN";

export interface InvoiceTotals {
  currency: string;
  netAmount?: string;
  taxAmount?: string;
  grossAmount?: string;
}

export interface InvoiceParty {
  name?: string;
}

export interface Invoice {
  id: string;
  format: InvoiceFormat;
  number?: string;
  supplier?: InvoiceParty;
  customer?: InvoiceParty;
  issueDate?: string;
  dueDate?: string;
  totals?: InvoiceTotals;
}

