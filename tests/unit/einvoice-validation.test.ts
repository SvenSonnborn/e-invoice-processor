import { describe, expect, it } from 'bun:test';
import {
  formatValidationErrorMessage,
  validateXRechnungExport,
} from '@/src/server/services/einvoice-validation';

describe('einvoice validation', () => {
  it('passes when built-in validation passes and no official validator is configured', async () => {
    const result = await validateXRechnungExport({
      xml: '<invoice />',
      builtinValidation: {
        valid: true,
        errors: [],
      },
    });

    expect(result.valid).toBe(true);
    expect(result.usedOfficialValidator).toBe(false);
    expect(result.issues.some((issue) => issue.severity === 'warning')).toBe(
      true
    );
  });

  it('fails when built-in validation reports errors', async () => {
    const result = await validateXRechnungExport({
      xml: '<invoice />',
      builtinValidation: {
        valid: false,
        errors: ['Missing required field'],
      },
    });

    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.severity === 'error')).toBe(
      true
    );
    expect(formatValidationErrorMessage('XRECHNUNG', result)).toContain(
      'validation failed'
    );
  });
});
