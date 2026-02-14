import type { Invoice } from '@/src/types';

const FORMULA_PREFIX_PATTERN = /^[\t\r ]*[=+\-@]/;

function neutralizeFormulaCell(value: string): string {
  if (FORMULA_PREFIX_PATTERN.test(value)) {
    return `'${value}`;
  }
  return value;
}

function escapeCsvCell(value: string) {
  const safeValue = neutralizeFormulaCell(value);
  if (
    safeValue.includes('"') ||
    safeValue.includes(',') ||
    safeValue.includes('\n')
  ) {
    return `"${safeValue.replaceAll('"', '""')}"`;
  }
  return safeValue;
}

export function invoicesToCsv(invoices: Invoice[]) {
  const header = [
    'id',
    'format',
    'number',
    'supplierName',
    'customerName',
    'issueDate',
    'dueDate',
    'currency',
    'netAmount',
    'taxAmount',
    'grossAmount',
  ];

  const rows = invoices.map((inv) => [
    inv.id,
    inv.format,
    inv.number ?? '',
    inv.supplier?.name ?? '',
    inv.customer?.name ?? '',
    inv.issueDate ?? '',
    inv.dueDate ?? '',
    inv.totals?.currency ?? 'EUR',
    inv.totals?.netAmount ?? '',
    inv.totals?.taxAmount ?? '',
    inv.totals?.grossAmount ?? '',
  ]);

  return [
    header.map(escapeCsvCell).join(','),
    ...rows.map((r) => r.map(escapeCsvCell).join(',')),
  ].join('\n');
}
