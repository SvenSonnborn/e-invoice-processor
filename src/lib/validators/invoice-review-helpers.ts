export const MONEY_TOLERANCE = 0.02;

const IBAN_MIN_LENGTH = 15;
const IBAN_MAX_LENGTH = 34;

export interface InvoiceReviewBusinessInput {
  header: {
    issueDate: string;
    dueDate?: string;
  };
  lines: Array<{
    netAmount: number;
  }>;
  totals: {
    netAmount: number;
    vatAmount: number;
    grossAmount: number;
  };
  taxBreakdown: Array<{
    rate: 0 | 7 | 19;
    taxableAmount: number;
    taxAmount: number;
  }>;
}

export interface InvoiceReviewBusinessIssue {
  path: Array<string | number>;
  message: string;
}

export function normalizeIban(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase();
}

export function normalizeVatId(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

export function approximatelyEqual(
  left: number,
  right: number,
  tolerance = MONEY_TOLERANCE
): boolean {
  return Math.abs(left - right) <= tolerance;
}

export function parseIsoDateToUtc(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

export function isValidIbanBasic(value: string): boolean {
  const iban = normalizeIban(value);
  if (iban.length < IBAN_MIN_LENGTH || iban.length > IBAN_MAX_LENGTH) {
    return false;
  }

  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban)) {
    return false;
  }

  const rearranged = `${iban.slice(4)}${iban.slice(0, 4)}`;
  const numeric = rearranged
    .split('')
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code >= 65 && code <= 90) {
        return String(code - 55);
      }
      return char;
    })
    .join('');

  let remainder = 0;
  for (const digit of numeric) {
    remainder = (remainder * 10 + Number(digit)) % 97;
  }

  return remainder === 1;
}

export function validateInvoiceBusinessRules(
  data: InvoiceReviewBusinessInput
): InvoiceReviewBusinessIssue[] {
  const issues: InvoiceReviewBusinessIssue[] = [];

  const sumLinesNet = data.lines.reduce((sum, line) => sum + line.netAmount, 0);
  if (!approximatelyEqual(sumLinesNet, data.totals.netAmount)) {
    issues.push({
      path: ['totals', 'netAmount'],
      message:
        'Summe der Positions-Nettobeträge passt nicht zum Gesamt-Nettobetrag.',
    });
  }

  const sumTaxable = data.taxBreakdown.reduce(
    (sum, item) => sum + item.taxableAmount,
    0
  );
  if (!approximatelyEqual(sumTaxable, data.totals.netAmount)) {
    issues.push({
      path: ['taxBreakdown'],
      message:
        'Summe der steuerpflichtigen Beträge passt nicht zum Nettobetrag.',
    });
  }

  const sumTax = data.taxBreakdown.reduce(
    (sum, item) => sum + item.taxAmount,
    0
  );
  if (!approximatelyEqual(sumTax, data.totals.vatAmount)) {
    issues.push({
      path: ['totals', 'vatAmount'],
      message: 'Summe der Steuerbeträge passt nicht zur Gesamtsteuer.',
    });
  }

  if (
    !approximatelyEqual(
      data.totals.netAmount + data.totals.vatAmount,
      data.totals.grossAmount
    )
  ) {
    issues.push({
      path: ['totals', 'grossAmount'],
      message: 'Nettobetrag + Steuerbetrag muss dem Bruttobetrag entsprechen.',
    });
  }

  data.taxBreakdown.forEach((item, index) => {
    const expectedTax = (item.taxableAmount * item.rate) / 100;
    if (!approximatelyEqual(item.taxAmount, expectedTax)) {
      issues.push({
        path: ['taxBreakdown', index, 'taxAmount'],
        message: `Steuerbetrag für ${item.rate}% ist inkonsistent.`,
      });
    }
  });

  if (data.header.dueDate) {
    const issueDate = parseIsoDateToUtc(data.header.issueDate);
    const dueDate = parseIsoDateToUtc(data.header.dueDate);

    if (issueDate && dueDate && dueDate.getTime() < issueDate.getTime()) {
      issues.push({
        path: ['header', 'dueDate'],
        message: 'Fälligkeitsdatum darf nicht vor dem Rechnungsdatum liegen.',
      });
    }
  }

  return issues;
}
