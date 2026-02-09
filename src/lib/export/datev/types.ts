export interface DatevEntry {
  datum: string; konto: string; gegenkonto: string; buchungstext: string;
  umsatzSoll: number; umsatzHaben: number; steuerschluessel?: string;
  steuerbetrag?: number; belegnummer?: string; belegdatum?: string;
  kostenstelle?: string; kostentraeger?: string; waehrung?: string;
}
export interface DatevExportConfig {
  beraterNummer?: string; mandantenNummer?: string; wirtschaftsjahrBeginn?: string;
  sachkontenrahmen?: string; bezeichnung?: string; buchungsstapelStart?: number;
  datumVon?: string; datumBis?: string; encoding: "UTF-8" | "ISO-8859-1" | "WINDOWS-1252";
}
export interface DatevInvoiceMapping {
  kontoEingangsrechnung: string; kontoAusgangsrechnung: string; gegenkontoBank: string;
  steuerschluesselStandard: string; steuerschluesselErmäßigt: string; steuerschluesselSteuerfrei: string;
  defaultKostenstelle?: string; defaultKostenträger?: string;
}
export interface DatevExportResult {
  success: boolean; csv: string; filename: string; entryCount: number; totalAmount: number; errors?: DatevValidationError[];
}
export interface DatevValidationError { field: string; message: string; value?: unknown; }
export interface DatevInvoice {
  id: string; number?: string; supplierName?: string; customerName?: string; issueDate: Date;
  dueDate?: Date; currency: string; netAmount: number; taxAmount: number; grossAmount: number;
  taxRate?: number; isIncoming: boolean; lineItems?: DatevLineItem[]; kostenstelle?: string; kostentraeger?: string;
}
export interface DatevLineItem {
  description: string; netAmount: number; taxAmount: number; grossAmount: number;
  taxRate: number; konto?: string; kostenstelle?: string; kostentraeger?: string;
}
export interface DatevHeader { formatIdentifier: "DTVF" | "EXTF"; version: number; category: number; formatName: string; formatVersion: number; generatedOn: string; reserved: string; currency: string; revision: string; }
export interface DatevExportOptions { format: "standard" | "extended"; detailed: boolean; config: DatevExportConfig; mapping?: DatevInvoiceMapping; filename?: string; }
