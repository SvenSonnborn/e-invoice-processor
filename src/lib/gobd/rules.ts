/**
 * GoBD Validation Rules
 * Individual validation rules for German tax compliance
 */

import {
  VALID_TAX_RATES,
  DEFAULT_CURRENCY,
  SUM_TOLERANCE,
  GOB_ERROR_CODES,
  GOB_ERROR_MESSAGES,
  GOB_WARNING_CODES,
  GOB_WARNING_MESSAGES,
} from './constants';
import {
  ValidationContext,
  RuleResult,
  GoBDViolation,
  GoBDWarning,
  InvoiceData,
} from './types';

// Helper to convert to number
function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
}

// Helper to check if date is in the future
function isFutureDate(date: Date | string | null | undefined): boolean {
  if (!date) return false;
  const checkDate = date instanceof Date ? date : new Date(date);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return checkDate > today;
}

// Helper to check if date is valid
function isValidDate(date: Date | string | null | undefined): boolean {
  if (!date) return false;
  const checkDate = date instanceof Date ? date : new Date(date);
  return !isNaN(checkDate.getTime());
}

// Create a violation
function createViolation(
  code: string,
  field: string,
  severity: 'error' | 'warning' = 'error',
  details?: Record<string, unknown>
): GoBDViolation {
  return {
    code,
    message: GOB_ERROR_MESSAGES[code] || 'Unbekannter Fehler',
    field,
    severity,
    details,
  };
}

// Create a warning
function createWarning(
  code: string,
  field?: string,
  details?: Record<string, unknown>
): GoBDWarning {
  return {
    code,
    message: GOB_WARNING_MESSAGES[code] || 'Warnung',
    field,
    details,
  };
}

export function validateRequiredFields(context: ValidationContext): RuleResult {
  const { invoice } = context;
  const violations: GoBDViolation[] = [];
  const warnings: GoBDWarning[] = [];

  if (!invoice.number || invoice.number.trim() === '') {
    violations.push(createViolation(GOB_ERROR_CODES.MISSING_INVOICE_NUMBER, 'number'));
  }
  if (!invoice.issueDate) {
    violations.push(createViolation(GOB_ERROR_CODES.MISSING_ISSUE_DATE, 'issueDate'));
  }
  if (invoice.netAmount === null || invoice.netAmount === undefined) {
    violations.push(createViolation(GOB_ERROR_CODES.MISSING_NET_AMOUNT, 'netAmount'));
  }
  if (invoice.taxAmount === null || invoice.taxAmount === undefined) {
    violations.push(createViolation(GOB_ERROR_CODES.MISSING_TAX_AMOUNT, 'taxAmount'));
  }
  if (invoice.grossAmount === null || invoice.grossAmount === undefined) {
    violations.push(createViolation(GOB_ERROR_CODES.MISSING_GROSS_AMOUNT, 'grossAmount'));
  }
  if (!invoice.currency || invoice.currency.trim() === '') {
    violations.push(createViolation(GOB_ERROR_CODES.MISSING_CURRENCY, 'currency'));
  }
  if (!invoice.supplierName || invoice.supplierName.trim() === '') {
    violations.push(createViolation(GOB_ERROR_CODES.MISSING_SUPPLIER, 'supplierName'));
  }
  if (!invoice.customerName || invoice.customerName.trim() === '') {
    violations.push(createViolation(GOB_ERROR_CODES.MISSING_CUSTOMER, 'customerName'));
  }
  if (!invoice.dueDate) {
    warnings.push(createWarning(GOB_WARNING_CODES.MISSING_DUE_DATE, 'dueDate'));
  }

  return { passed: violations.length === 0, violations, warnings };
}

export function validateDateConstraints(context: ValidationContext): RuleResult {
  const { invoice } = context;
  const violations: GoBDViolation[] = [];
  const warnings: GoBDWarning[] = [];

  if (invoice.issueDate) {
    if (!isValidDate(invoice.issueDate)) {
      violations.push(createViolation(GOB_ERROR_CODES.INVALID_DATE_FORMAT, 'issueDate'));
    } else if (isFutureDate(invoice.issueDate)) {
      violations.push(createViolation(GOB_ERROR_CODES.FUTURE_DATE, 'issueDate'));
    }
  }

  return { passed: violations.length === 0, violations, warnings };
}

export function validateSumCalculation(context: ValidationContext): RuleResult {
  const { invoice, tolerance = SUM_TOLERANCE } = context;
  const violations: GoBDViolation[] = [];
  const warnings: GoBDWarning[] = [];

  const net = toNumber(invoice.netAmount);
  const tax = toNumber(invoice.taxAmount);
  const gross = toNumber(invoice.grossAmount);

  if (net === null || tax === null || gross === null) {
    return { passed: true, violations, warnings };
  }

  const calculatedGross = net + tax;
  const difference = Math.abs(calculatedGross - gross);

  if (difference > tolerance) {
    violations.push(
      createViolation(GOB_ERROR_CODES.SUM_MISMATCH, 'grossAmount', 'error', {
        expected: calculatedGross.toFixed(2),
        actual: gross.toFixed(2),
        difference: difference.toFixed(2),
      })
    );
  }

  return { passed: violations.length === 0, violations, warnings };
}

export function validateTaxRates(context: ValidationContext): RuleResult {
  const { invoice, tolerance = SUM_TOLERANCE } = context;
  const violations: GoBDViolation[] = [];
  const warnings: GoBDWarning[] = [];

  if (invoice.lineItems && invoice.lineItems.length > 0) {
    for (const item of invoice.lineItems) {
      const taxRate = toNumber(item.taxRate);

      if (taxRate === null) {
        violations.push(createViolation(GOB_ERROR_CODES.MISSING_LINE_ITEM_TAX_RATE, `lineItems[${item.positionIndex}].taxRate`));
      } else if (!VALID_TAX_RATES.includes(taxRate as (typeof VALID_TAX_RATES)[number])) {
        violations.push(createViolation(GOB_ERROR_CODES.INVALID_TAX_RATE, `lineItems[${item.positionIndex}].taxRate`, 'error', { actual: taxRate, allowed: VALID_TAX_RATES }));
      }

      const itemNet = toNumber(item.netAmount);
      const itemTax = toNumber(item.taxAmount);

      if (itemNet !== null && taxRate !== null && itemTax !== null) {
        const calculatedTax = (itemNet * taxRate) / 100;
        const taxDifference = Math.abs(calculatedTax - itemTax);

        if (taxDifference > tolerance) {
          violations.push(createViolation(GOB_ERROR_CODES.TAX_CALCULATION_ERROR, `lineItems[${item.positionIndex}].taxAmount`, 'error', { expected: calculatedTax.toFixed(2), actual: itemTax.toFixed(2) }));
        }
      }
    }
  } else {
    warnings.push(createWarning(GOB_WARNING_CODES.NO_LINE_ITEMS));
  }

  return { passed: violations.length === 0, violations, warnings };
}

export function validateCurrency(context: ValidationContext): RuleResult {
  const { invoice } = context;
  const violations: GoBDViolation[] = [];
  const warnings: GoBDWarning[] = [];

  if (invoice.currency) {
    const currency = invoice.currency.toUpperCase();
    if (currency.length !== 3) {
      violations.push(createViolation(GOB_ERROR_CODES.INVALID_CURRENCY, 'currency'));
    } else if (currency !== DEFAULT_CURRENCY) {
      warnings.push(createWarning(GOB_WARNING_CODES.UNCOMMON_CURRENCY, 'currency', { currency, expected: DEFAULT_CURRENCY }));
    }
  }

  return { passed: violations.length === 0, violations, warnings };
}

export function validateLineItems(context: ValidationContext): RuleResult {
  const { invoice, tolerance = SUM_TOLERANCE } = context;
  const violations: GoBDViolation[] = [];
  const warnings: GoBDWarning[] = [];

  if (!invoice.lineItems || invoice.lineItems.length === 0) {
    return { passed: true, violations, warnings };
  }

  let totalNet = 0;
  for (const item of invoice.lineItems) {
    if (!item.description || item.description.trim() === '') {
      violations.push(createViolation(GOB_ERROR_CODES.MISSING_LINE_ITEM_DESCRIPTION, `lineItems[${item.positionIndex}].description`));
    }
    const net = toNumber(item.netAmount);
    if (net !== null) totalNet += net;
  }

  const invoiceNet = toNumber(invoice.netAmount);
  if (invoiceNet !== null && Math.abs(totalNet - invoiceNet) > tolerance) {
    violations.push(createViolation(GOB_ERROR_CODES.LINE_ITEM_SUM_MISMATCH, 'lineItems', 'error', { lineItemTotal: totalNet.toFixed(2), invoiceTotal: invoiceNet.toFixed(2) }));
  }

  return { passed: violations.length === 0, violations, warnings };
}

export function getAllValidationRules(): ((context: ValidationContext) => RuleResult)[] {
  return [
    validateRequiredFields,
    validateDateConstraints,
    validateSumCalculation,
    validateTaxRates,
    validateCurrency,
    validateLineItems,
  ];
}
