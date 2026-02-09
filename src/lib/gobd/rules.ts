import { VALID_TAX_RATES, DEFAULT_CURRENCY, GOB_ERROR_CODES, GOB_ERROR_MESSAGES, GOB_WARNING_CODES, GOB_WARNING_MESSAGES } from './constants';
import { ValidationContext, RuleResult } from './types';

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') { const parsed = parseFloat(value); return isNaN(parsed) ? null : parsed; }
  return null;
}
function isFutureDate(date: unknown): boolean {
  if (!date) return false;
  const checkDate = date instanceof Date ? date : new Date(date as string);
  const today = new Date(); today.setHours(23, 59, 59, 999);
  return checkDate > today;
}
function isValidDate(date: unknown): boolean {
  if (!date) return false;
  const checkDate = date instanceof Date ? date : new Date(date as string);
  return !isNaN(checkDate.getTime());
}
function createViolation(code: string, field: string, severity: 'error' | 'warning' = 'error', details?: Record<string, unknown>) {
  return { code, message: GOB_ERROR_MESSAGES[code] || 'Unbekannter Fehler', field, severity, details };
}
function createWarning(code: string, field?: string, details?: Record<string, unknown>) {
  return { code, message: GOB_WARNING_MESSAGES[code] || 'Warnung', field, details };
}

export function validateRequiredFields(ctx: ValidationContext): RuleResult {
  const { invoice } = ctx; const violations = []; const warnings = [];
  if (!invoice.number?.trim()) violations.push(createViolation(GOB_ERROR_CODES.MISSING_INVOICE_NUMBER, 'number'));
  if (!invoice.issueDate) violations.push(createViolation(GOB_ERROR_CODES.MISSING_ISSUE_DATE, 'issueDate'));
  if (invoice.netAmount == null) violations.push(createViolation(GOB_ERROR_CODES.MISSING_NET_AMOUNT, 'netAmount'));
  if (invoice.taxAmount == null) violations.push(createViolation(GOB_ERROR_CODES.MISSING_TAX_AMOUNT, 'taxAmount'));
  if (invoice.grossAmount == null) violations.push(createViolation(GOB_ERROR_CODES.MISSING_GROSS_AMOUNT, 'grossAmount'));
  if (!invoice.currency?.trim()) violations.push(createViolation(GOB_ERROR_CODES.MISSING_CURRENCY, 'currency'));
  if (!invoice.supplierName?.trim()) violations.push(createViolation(GOB_ERROR_CODES.MISSING_SUPPLIER, 'supplierName'));
  if (!invoice.customerName?.trim()) violations.push(createViolation(GOB_ERROR_CODES.MISSING_CUSTOMER, 'customerName'));
  if (!invoice.dueDate) warnings.push(createWarning(GOB_WARNING_CODES.MISSING_DUE_DATE, 'dueDate'));
  return { passed: violations.length === 0, violations, warnings };
}
export function validateDateConstraints(ctx: ValidationContext): RuleResult {
  const { invoice } = ctx; const violations = []; const warnings = [];
  if (invoice.issueDate) {
    if (!isValidDate(invoice.issueDate)) violations.push(createViolation(GOB_ERROR_CODES.INVALID_DATE_FORMAT, 'issueDate'));
    else if (isFutureDate(invoice.issueDate)) violations.push(createViolation(GOB_ERROR_CODES.FUTURE_DATE, 'issueDate'));
  }
  return { passed: violations.length === 0, violations, warnings };
}
export function validateSumCalculation(ctx: ValidationContext): RuleResult {
  const { invoice, tolerance = 0.01 } = ctx; const violations = []; const warnings = [];
  const net = toNumber(invoice.netAmount); const tax = toNumber(invoice.taxAmount); const gross = toNumber(invoice.grossAmount);
  if (net !== null && tax !== null && gross !== null) {
    const diff = Math.abs(net + tax - gross);
    if (diff > tolerance) violations.push(createViolation(GOB_ERROR_CODES.SUM_MISMATCH, 'grossAmount', 'error', { expected: (net + tax).toFixed(2), actual: gross.toFixed(2), difference: diff.toFixed(2) }));
  }
  return { passed: violations.length === 0, violations, warnings };
}
export function validateTaxRates(ctx: ValidationContext): RuleResult {
  const { invoice, tolerance = 0.01 } = ctx; const violations = []; const warnings = [];
  if (invoice.lineItems?.length) {
    for (const item of invoice.lineItems) {
      const taxRate = toNumber(item.taxRate);
      if (taxRate === null) violations.push(createViolation(GOB_ERROR_CODES.MISSING_LINE_ITEM_TAX_RATE, 'lineItems.taxRate'));
      else if (!VALID_TAX_RATES.includes(taxRate as typeof VALID_TAX_RATES[number])) violations.push(createViolation(GOB_ERROR_CODES.INVALID_TAX_RATE, 'lineItems.taxRate', 'error', { actual: taxRate, allowed: VALID_TAX_RATES }));
      const itemNet = toNumber(item.netAmount); const itemTax = toNumber(item.taxAmount);
      if (itemNet !== null && taxRate !== null && itemTax !== null) {
        const calcTax = (itemNet * taxRate) / 100;
        if (Math.abs(calcTax - itemTax) > tolerance) violations.push(createViolation(GOB_ERROR_CODES.TAX_CALCULATION_ERROR, 'lineItems.taxAmount', 'error', { expected: calcTax.toFixed(2), actual: itemTax.toFixed(2) }));
      }
    }
  } else warnings.push(createWarning(GOB_WARNING_CODES.NO_LINE_ITEMS));
  return { passed: violations.length === 0, violations, warnings };
}
export function validateCurrency(ctx: ValidationContext): RuleResult {
  const { invoice } = ctx; const violations = []; const warnings = [];
  if (invoice.currency) {
    const currency = invoice.currency.toUpperCase();
    if (currency.length !== 3) violations.push(createViolation(GOB_ERROR_CODES.INVALID_CURRENCY, 'currency'));
    else if (currency !== DEFAULT_CURRENCY) warnings.push(createWarning(GOB_WARNING_CODES.UNCOMMON_CURRENCY, 'currency', { currency, expected: DEFAULT_CURRENCY }));
  }
  return { passed: violations.length === 0, violations, warnings };
}
export function validateLineItems(ctx: ValidationContext): RuleResult {
  const { invoice, tolerance = 0.01 } = ctx; const violations = [];
  if (!invoice.lineItems?.length) return { passed: true, violations, warnings: [] };
  let totalNet = 0;
  for (const item of invoice.lineItems) {
    if (!item.description?.trim()) violations.push(createViolation(GOB_ERROR_CODES.MISSING_LINE_ITEM_DESCRIPTION, 'lineItems.description'));
    const net = toNumber(item.netAmount); if (net !== null) totalNet += net;
  }
  const invoiceNet = toNumber(invoice.netAmount);
  if (invoiceNet !== null && Math.abs(totalNet - invoiceNet) > tolerance) violations.push(createViolation(GOB_ERROR_CODES.LINE_ITEM_SUM_MISMATCH, 'lineItems', 'error', { lineItemTotal: totalNet.toFixed(2), invoiceTotal: invoiceNet.toFixed(2) }));
  return { passed: violations.length === 0, violations, warnings: [] };
}
export function getAllValidationRules() {
  return [validateRequiredFields, validateDateConstraints, validateSumCalculation, validateTaxRates, validateCurrency, validateLineItems];
}
