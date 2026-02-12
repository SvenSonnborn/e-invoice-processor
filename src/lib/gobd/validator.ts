/**
 * GoBD Compliance Validator
 * Main validator for German tax compliance (GoBD)
 */

import { GoBDComplianceStatus, SUM_TOLERANCE } from './constants';
import {
  InvoiceData,
  GoBDValidationResult,
  ValidationContext,
  ValidationOptions,
} from './types';
import { getAllValidationRules } from './rules';

export function validateGoBDCompliance(
  invoice: InvoiceData,
  options: ValidationOptions = {}
): GoBDValidationResult {
  const {
    strictMode = false,
    tolerance = SUM_TOLERANCE,
    validateLineItems = true,
  } = options;

  const context: ValidationContext = { invoice, strictMode, tolerance };
  const allViolations: GoBDValidationResult['violations'] = [];
  const allWarnings: GoBDValidationResult['warnings'] = [];

  const rules = getAllValidationRules();
  for (const rule of rules) {
    if (!validateLineItems && rule.name === 'validateLineItems') continue;
    const result = rule(context);
    allViolations.push(...result.violations);
    allWarnings.push(...result.warnings);
  }

  const hasErrors = allViolations.some((v) => v.severity === 'error');
  const hasWarnings =
    allWarnings.length > 0 ||
    allViolations.some((v) => v.severity === 'warning');

  let badge: GoBDComplianceStatus;
  if (hasErrors) badge = 'non-compliant';
  else if (hasWarnings) badge = 'warning';
  else badge = 'compliant';

  return {
    isCompliant: !hasErrors,
    badge,
    violations: allViolations,
    warnings: allWarnings,
    validatedAt: new Date(),
    invoiceId: invoice.id,
  };
}

export function isGoBDCompliant(
  invoice: InvoiceData,
  options?: ValidationOptions
): boolean {
  return validateGoBDCompliance(invoice, options).isCompliant;
}

export function getComplianceStatusText(badge: GoBDComplianceStatus): string {
  switch (badge) {
    case 'compliant':
      return 'GoBD-konform';
    case 'non-compliant':
      return 'Nicht GoBD-konform';
    case 'warning':
      return 'GoBD-konform mit Hinweisen';
    default:
      return 'Unbekannt';
  }
}

export function getComplianceStatusDescription(
  badge: GoBDComplianceStatus
): string {
  switch (badge) {
    case 'compliant':
      return 'Die Rechnung erfüllt alle GoBD-Anforderungen für die ordnungsgemäße Buchführung.';
    case 'non-compliant':
      return 'Die Rechnung weist Fehler auf, die vor der weiteren Verarbeitung korrigiert werden müssen.';
    case 'warning':
      return 'Die Rechnung ist grundsätzlich GoBD-konform, enthält aber Hinweise zur Prüfung.';
    default:
      return '';
  }
}

export function getBadgeColor(badge: GoBDComplianceStatus): string {
  switch (badge) {
    case 'compliant':
      return 'green';
    case 'non-compliant':
      return 'red';
    case 'warning':
      return 'yellow';
    default:
      return 'gray';
  }
}

export function formatValidationResult(
  result: GoBDValidationResult
): Record<string, unknown> {
  return {
    isCompliant: result.isCompliant,
    badge: result.badge,
    statusText: getComplianceStatusText(result.badge),
    statusDescription: getComplianceStatusDescription(result.badge),
    violationsCount: result.violations.length,
    warningsCount: result.warnings.length,
    violations: result.violations.map((v) => ({
      code: v.code,
      message: v.message,
      field: v.field,
      severity: v.severity,
      details: v.details,
    })),
    warnings: result.warnings.map((w) => ({
      code: w.code,
      message: w.message,
      field: w.field,
      details: w.details,
    })),
    validatedAt: result.validatedAt.toISOString(),
    invoiceId: result.invoiceId,
  };
}

export function validateBeforeExport(
  invoice: InvoiceData,
  options?: ValidationOptions
): GoBDValidationResult {
  const result = validateGoBDCompliance(invoice, {
    ...options,
    strictMode: true,
  });
  if (!result.isCompliant) {
    throw new Error(
      `GoBD-Validierung fehlgeschlagen: ${result.violations.map((v) => v.message).join('; ')}`
    );
  }
  return result;
}

export * from './types';
export * from './constants';
export * from './rules';
