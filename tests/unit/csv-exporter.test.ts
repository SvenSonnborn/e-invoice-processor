import { describe, expect, it } from 'bun:test';
import { invoicesToCsv } from '@/src/server/exporters/csv';
import type { Invoice } from '@/src/types';

describe('CSV exporter security', () => {
  it('neutralizes spreadsheet formula injection prefixes', () => {
    const invoices: Invoice[] = [
      {
        id: 'inv-1',
        format: 'UNKNOWN',
        number: '=HYPERLINK("http://evil.example","click")',
        supplier: { name: '+SUM(1,1)' },
        customer: { name: '@calc' },
        issueDate: '-01-01-2026',
        dueDate: '  =1+1',
        totals: {
          currency: 'EUR',
          netAmount: '100.00',
          taxAmount: '19.00',
          grossAmount: '119.00',
        },
      },
    ];

    const csv = invoicesToCsv(invoices);
    expect(csv).toContain(`"'=HYPERLINK(""http://evil.example"",""click"")"`);
    expect(csv).toContain(`"'+SUM(1,1)"`);
    expect(csv).toContain("'@calc");
    expect(csv).toContain("'-01-01-2026");
    expect(csv).toContain("'  =1+1");
  });
});
