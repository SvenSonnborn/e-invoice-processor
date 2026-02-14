import { normalizeVatId } from '@/src/lib/validators/invoice-review-helpers';

const VIES_ENDPOINT =
  'https://ec.europa.eu/taxation_customs/vies/services/checkVatService';
const DEFAULT_VIES_TIMEOUT_MS = 3500;
const DEFAULT_VIES_ENABLED = true;

const EU_COUNTRY_CODES = new Set([
  'AT',
  'BE',
  'BG',
  'CY',
  'CZ',
  'DE',
  'DK',
  'EE',
  'EL',
  'ES',
  'FI',
  'FR',
  'HR',
  'HU',
  'IE',
  'IT',
  'LT',
  'LU',
  'LV',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SE',
  'SI',
  'SK',
  'XI',
]);

const VAT_NUMBER_PATTERN_BY_COUNTRY: Record<string, RegExp> = {
  AT: /^U\d{8}$/,
  BE: /^0?\d{9}$/,
  BG: /^\d{9,10}$/,
  CY: /^\d{8}[A-Z]$/,
  CZ: /^\d{8,10}$/,
  DE: /^\d{9}$/,
  DK: /^\d{8}$/,
  EE: /^\d{9}$/,
  EL: /^\d{9}$/,
  ES: /^[A-Z0-9]\d{7}[A-Z0-9]$/,
  FI: /^\d{8}$/,
  FR: /^[A-HJ-NP-Z0-9]{2}\d{9}$/,
  HR: /^\d{11}$/,
  HU: /^\d{8}$/,
  IE: /^\d[A-Z0-9+*]\d{5}[A-Z]$/,
  IT: /^\d{11}$/,
  LT: /^(\d{9}|\d{12})$/,
  LU: /^\d{8}$/,
  LV: /^\d{11}$/,
  MT: /^\d{8}$/,
  NL: /^\d{9}B\d{2}$/,
  PL: /^\d{10}$/,
  PT: /^\d{9}$/,
  RO: /^\d{2,10}$/,
  SE: /^\d{12}$/,
  SI: /^\d{8}$/,
  SK: /^\d{10}$/,
  XI: /^\d{9}$/,
};

export type VatValidationStatus =
  | 'valid'
  | 'invalid'
  | 'unavailable'
  | 'unverified';

export type VatValidationReason =
  | 'ok'
  | 'missing'
  | 'format'
  | 'unsupported_country'
  | 'disabled'
  | 'vies_invalid'
  | 'vies_invalid_input'
  | 'vies_unavailable';

export interface VatValidationResult {
  status: VatValidationStatus;
  reason: VatValidationReason;
  message: string;
  checkedAt: string;
  normalizedVatId: string;
  countryCode: string | null;
  vatNumber: string | null;
  viesChecked: boolean;
}

interface ParsedVatId {
  countryCode: string;
  vatNumber: string;
}

function mapToViesCountryCode(countryCode: string): string {
  if (countryCode === 'GR') return 'EL';
  return countryCode;
}

function parseNormalizedVatId(normalizedVatId: string): ParsedVatId | null {
  const match = /^([A-Z]{2})([A-Z0-9]{2,12})$/.exec(normalizedVatId);
  if (!match) return null;

  return {
    countryCode: mapToViesCountryCode(match[1]),
    vatNumber: match[2],
  };
}

function isLocalFormatValid(countryCode: string, vatNumber: string): boolean {
  const pattern = VAT_NUMBER_PATTERN_BY_COUNTRY[countryCode];
  if (pattern) return pattern.test(vatNumber);

  return /^[A-Z0-9]{2,12}$/.test(vatNumber);
}

function parseBooleanEnv(
  value: string | undefined,
  fallback: boolean
): boolean {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function parseTimeoutMs(value: string | undefined): number {
  if (!value) return DEFAULT_VIES_TIMEOUT_MS;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_VIES_TIMEOUT_MS;
  return parsed;
}

function buildResult(
  normalizedVatId: string,
  parsedVatId: ParsedVatId | null,
  status: VatValidationStatus,
  reason: VatValidationReason,
  message: string,
  viesChecked: boolean
): VatValidationResult {
  return {
    status,
    reason,
    message,
    checkedAt: new Date().toISOString(),
    normalizedVatId,
    countryCode: parsedVatId?.countryCode ?? null,
    vatNumber: parsedVatId?.vatNumber ?? null,
    viesChecked,
  };
}

function toViesSoapBody(countryCode: string, vatNumber: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:typ="urn:ec.europa.eu:taxud:vies:services:checkVat:types">
  <soapenv:Header/>
  <soapenv:Body>
    <typ:checkVat>
      <typ:countryCode>${countryCode}</typ:countryCode>
      <typ:vatNumber>${vatNumber}</typ:vatNumber>
    </typ:checkVat>
  </soapenv:Body>
</soapenv:Envelope>`;
}

function extractTagValue(xml: string, tagName: string): string | null {
  const escapedTagName = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(
    `<(?:[A-Za-z_][\\w.-]*:)?${escapedTagName}\\b[^>]*>([\\s\\S]*?)</(?:[A-Za-z_][\\w.-]*:)?${escapedTagName}>`,
    'i'
  ).exec(xml);
  if (!match) return null;

  const value = match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
  return value.length > 0 ? value : null;
}

function classifyViesFault(
  normalizedVatId: string,
  parsedVatId: ParsedVatId,
  faultCode: string
): VatValidationResult {
  const upper = faultCode.toUpperCase();
  if (upper.includes('INVALID_INPUT')) {
    return buildResult(
      normalizedVatId,
      parsedVatId,
      'invalid',
      'vies_invalid_input',
      'USt-IdNr. hat laut VIES ein ungueltiges Format.',
      true
    );
  }

  return buildResult(
    normalizedVatId,
    parsedVatId,
    'unavailable',
    'vies_unavailable',
    'VIES-Pruefung ist aktuell nicht verfuegbar. Die lokale Pruefung wurde verwendet.',
    true
  );
}

async function checkVatWithVies(
  normalizedVatId: string,
  parsedVatId: ParsedVatId
): Promise<VatValidationResult> {
  const timeoutMs = parseTimeoutMs(process.env.VIES_TIMEOUT_MS);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(VIES_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: '""',
      },
      body: toViesSoapBody(parsedVatId.countryCode, parsedVatId.vatNumber),
      signal: controller.signal,
      cache: 'no-store',
    });

    const xml = await response.text();

    if (!response.ok) {
      return buildResult(
        normalizedVatId,
        parsedVatId,
        'unavailable',
        'vies_unavailable',
        'VIES-Pruefung ist aktuell nicht verfuegbar. Die lokale Pruefung wurde verwendet.',
        true
      );
    }

    const faultString = extractTagValue(xml, 'faultstring');
    if (faultString) {
      return classifyViesFault(normalizedVatId, parsedVatId, faultString);
    }

    const validValue = extractTagValue(xml, 'valid')?.toLowerCase();
    if (validValue === 'true') {
      return buildResult(
        normalizedVatId,
        parsedVatId,
        'valid',
        'ok',
        'USt-IdNr. wurde ueber VIES bestaetigt.',
        true
      );
    }

    if (validValue === 'false') {
      return buildResult(
        normalizedVatId,
        parsedVatId,
        'invalid',
        'vies_invalid',
        'USt-IdNr. konnte im VIES-System nicht bestaetigt werden.',
        true
      );
    }

    return buildResult(
      normalizedVatId,
      parsedVatId,
      'unavailable',
      'vies_unavailable',
      'VIES-Pruefung ist aktuell nicht verfuegbar. Die lokale Pruefung wurde verwendet.',
      true
    );
  } catch {
    return buildResult(
      normalizedVatId,
      parsedVatId,
      'unavailable',
      'vies_unavailable',
      'VIES-Pruefung ist aktuell nicht verfuegbar. Die lokale Pruefung wurde verwendet.',
      true
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function validateSellerVatId(
  vatId: string
): Promise<VatValidationResult> {
  const normalizedVatId = normalizeVatId(vatId);
  const parsedVatId = parseNormalizedVatId(normalizedVatId);

  if (!normalizedVatId) {
    return buildResult(
      normalizedVatId,
      parsedVatId,
      'unverified',
      'missing',
      'Keine USt-IdNr. angegeben.',
      false
    );
  }

  if (
    !parsedVatId ||
    !isLocalFormatValid(parsedVatId.countryCode, parsedVatId.vatNumber)
  ) {
    return buildResult(
      normalizedVatId,
      parsedVatId,
      'invalid',
      'format',
      'USt-IdNr. muss im gueltigen Laenderformat angegeben werden (z. B. DE123456789).',
      false
    );
  }

  if (!EU_COUNTRY_CODES.has(parsedVatId.countryCode)) {
    return buildResult(
      normalizedVatId,
      parsedVatId,
      'unverified',
      'unsupported_country',
      'VIES-Pruefung ist nur fuer EU-USt-IdNr. verfuegbar.',
      false
    );
  }

  const viesEnabled = parseBooleanEnv(
    process.env.VIES_VALIDATION_ENABLED,
    DEFAULT_VIES_ENABLED
  );
  if (!viesEnabled) {
    return buildResult(
      normalizedVatId,
      parsedVatId,
      'unverified',
      'disabled',
      'VIES-Pruefung ist deaktiviert. Es wurde nur lokal geprueft.',
      false
    );
  }

  return checkVatWithVies(normalizedVatId, parsedVatId);
}
