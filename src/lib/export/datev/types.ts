/**
 * DATEV Export Types
 * Type definitions for DATEV CSV export format (Buchungsstapel)
 */

/**
 * DATEV Buchungsstapel Header Structure
 * Based on DATEV Format 2017/2018 (Standard Buchungsstapel)
 */
export interface DatevHeader {
  formatIdentifier: "DTVF" | "EXTF";
  version: number;
  category: number;
  formatName: string;
  formatVersion: number;
  generatedOn: string;
  reserved: string;
  currency: "EUR" | string;
  revision: string;
}

/**
 * DATEV Buchungssatz (Booking Entry)
 * Single row in the DATEV CSV export
 */
export interface DatevEntry {
  datum: string;
  konto: string;
  gegenkonto: string;
  buchungstext: string;
  umsatzSoll: number;
  umsatzHaben: number;
  steuerschluessel?: string;
  steuerbetrag?: number;
  belegnummer?: string;
  belegdatum?: string;
  geschaeftsjahr?: string;
  buchungsperiode?: string;
  kostenstelle?: string;
  kostentraeger?: string;
  waehrung?: string;
  basiswaehrungsbetrag?: number;
  basiswaehrung?: string;
}

/**
 * DATEV Export Configuration
 */
export interface DatevExportConfig {
  beraterNummer?: string;
  mandantenNummer?: string;
  wirtschaftsjahrBeginn?: string;
  sachkontenrahmen?: string;
  bezeichnung?: string;
  buchungsstapelStart?: number;
  datumVon?: string;
  datumBis?: string;
  defaultKonto?: string;
  defaultGegenkonto?: string;
  defaultSteuerschluessel?: string;
  encoding: "UTF-8" | "ISO-8859-1" | "WINDOWS-1252";
}

/**
 * Invoice to DATEV mapping configuration
 */
export interface DatevInvoiceMapping {
  kontoEingangsrechnung: string;
  kontoAusgangsrechnung: string;
  gegenkontoBank: string;
  steuerschluesselStandard: string;
  steuerschluesselErmäßigt: string;
  steuerschluesselSteuerfrei: string;
  defaultKostenstelle?: string;
  defaultKostenträger?: string;
}

/**
 * Export result
 */
export interface DatevExportResult {
  success: boolean;
  csv: string;
  filename: string;
  entryCount: number;
  totalAmount: number;
  errors?: DatevValidationError[];
}

/**
 * Validation error
 */
export interface DatevValidationError {
  field: string;
  message: string;
  value?: unknown;
}

/**
 * Extended Invoice type for DATEV export
 */
export interface DatevInvoice {
  id: string;
  number?: string;
  supplierName?: string;
  customerName?: string;
  issueDate: Date;
  dueDate?: Date;
  currency: string;
  netAmount: number;
  taxAmount: number;
  grossAmount: number;
  taxRate?: number;
  isIncoming: boolean;
  lineItems?: DatevLineItem[];
  kostenstelle?: string;
  kostentraeger?: string;
}

/**
 * Line item for DATEV export
 */
export interface DatevLineItem {
  description: string;
  netAmount: number;
  taxAmount: number;
  grossAmount: number;
  taxRate: number;
  konto?: string;
  kostenstelle?: string;
  kostentraeger?: string;
}
