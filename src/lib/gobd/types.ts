/**
 * GoBD Validation Types
 * Type definitions for GoBD compliance validation
 */

import { GoBDComplianceStatus, ViolationSeverity } from './constants';

// Invoice data structure for validation
export interface InvoiceData {
  id?: string;
  number?: string | null;
  issueDate?: Date | string | null;
  dueDate?: Date | string | null;
  currency?: string | null;
  netAmount?: number | string | null;
  taxAmount?: number | string | null;
  grossAmount?: number | string | null;
  supplierName?: string | null;
  customerName?: string | null;
  lineItems?: LineItemData[];
}

// Line item data structure
export interface LineItemData {
  id?: string;
  positionIndex?: number;
  description?: string | null;
  quantity?: number | string | null;
  unitPrice?: number | string | null;
  taxRate?: number | string | null;
  netAmount?: number | string | null;
  taxAmount?: number | string | null;
  grossAmount?: number | string | null;
}

// Single validation violation
export interface GoBDViolation {
  code: string;
  message: string;
  field: string;
  severity: ViolationSeverity;
  details?: Record<string, unknown>;
}

// Validation warning (non-critical)
export interface GoBDWarning {
  code: string;
  message: string;
  field?: string;
  details?: Record<string, unknown>;
}

// Complete validation result
export interface GoBDValidationResult {
  isCompliant: boolean;
  badge: GoBDComplianceStatus;
  violations: GoBDViolation[];
  warnings: GoBDWarning[];
  validatedAt: Date;
  invoiceId?: string;
}

// Validation context for rule execution
export interface ValidationContext {
  invoice: InvoiceData;
  strictMode?: boolean;
  tolerance?: number;
}

// Individual rule result
export interface RuleResult {
  passed: boolean;
  violations: GoBDViolation[];
  warnings: GoBDWarning[];
}

// Validation rule function type
export type ValidationRule = (context: ValidationContext) => RuleResult;

// Validation options
export interface ValidationOptions {
  strictMode?: boolean;
  tolerance?: number;
  validateLineItems?: boolean;
  validateCalculations?: boolean;
}

// Badge display props
export interface GoBDBadgeProps {
  status: GoBDComplianceStatus;
  violationsCount?: number;
  warningsCount?: number;
  showDetails?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// API response type
export interface GoBDValidationResponse {
  success: boolean;
  result?: GoBDValidationResult;
  error?: string;
}
