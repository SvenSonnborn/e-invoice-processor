import { InvoiceData, GoBDValidationResult, ValidationContext, ValidationOptions } from './types';
import { getAllValidationRules } from './rules';

export function validateGoBDCompliance(invoice: InvoiceData, options: ValidationOptions = {}): GoBDValidationResult {
  const { tolerance = 0.01, validateLineItems = true } = options;
  const context: ValidationContext = { invoice, tolerance };
  const allViolations = []; const allWarnings = [];
  for (const rule of getAllValidationRules()) {
    if (!validateLineItems && rule.name === 'validateLineItems') continue;
    const result = rule(context); allViolations.push(...result.violations); allWarnings.push(...result.warnings);
  }
  const hasErrors = allViolations.some((v) => v.severity === 'error');
  const hasWarnings = allWarnings.length > 0;
  const badge = hasErrors ? 'non-compliant' : hasWarnings ? 'warning' : 'compliant';
  return { isCompliant: !hasErrors, badge, violations: allViolations, warnings: allWarnings, validatedAt: new Date(), invoiceId: invoice.id };
}
export function isGoBDCompliant(invoice: InvoiceData, options?: ValidationOptions): boolean {
  return validateGoBDCompliance(invoice, options).isCompliant;
}
export function getComplianceStatusText(badge: string): string {
  const texts: Record<string, string> = { compliant: 'GoBD-konform', 'non-compliant': 'Nicht GoBD-konform', warning: 'GoBD-konform mit Hinweisen' };
  return texts[badge] || 'Unbekannt';
}
export function getBadgeColor(badge: string): string {
  const colors: Record<string, string> = { compliant: 'green', 'non-compliant': 'red', warning: 'yellow' };
  return colors[badge] || 'gray';
}
export function formatValidationResult(result: GoBDValidationResult) {
  return { isCompliant: result.isCompliant, badge: result.badge, statusText: getComplianceStatusText(result.badge), violationsCount: result.violations.length, warningsCount: result.warnings.length, violations: result.violations, warnings: result.warnings, validatedAt: result.validatedAt.toISOString() };
}
export function validateBeforeExport(invoice: InvoiceData, options?: ValidationOptions): GoBDValidationResult {
  const result = validateGoBDCompliance(invoice, { ...options, strictMode: true });
  if (!result.isCompliant) throw new Error('GoBD-Validierung fehlgeschlagen: ' + result.violations.map((v) => v.message).join('; '));
  return result;
}
