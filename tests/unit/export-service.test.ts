import { describe, expect, it } from 'bun:test';
import { generateExportFilename } from '@/src/server/services/export-service';

describe('generateExportFilename', () => {
  it('generates xrechnung xml filename from invoice number', () => {
    const filename = generateExportFilename(
      'XRECHNUNG',
      undefined,
      'RE-2026-1001'
    );
    expect(filename).toBe('RE-2026-1001-xrechnung.xml');
  });

  it('generates zugferd pdf filename from invoice number', () => {
    const filename = generateExportFilename(
      'ZUGFERD',
      undefined,
      'RE-2026-1001'
    );
    expect(filename).toBe('RE-2026-1001-zugferd.pdf');
  });
});
