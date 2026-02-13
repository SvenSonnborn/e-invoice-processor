import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { validateSellerVatId } from '@/src/server/services/vat';

const originalFetch = global.fetch;
const originalViesValidationEnabled = process.env.VIES_VALIDATION_ENABLED;
const originalViesTimeoutMs = process.env.VIES_TIMEOUT_MS;

function setFetchXmlResponse(xml: string, status = 200): void {
  global.fetch = (async () =>
    new Response(xml, {
      status,
      headers: { 'Content-Type': 'text/xml; charset=utf-8' },
    })) as unknown as typeof fetch;
}

describe('VIES VAT validation', () => {
  beforeEach(() => {
    process.env.VIES_VALIDATION_ENABLED = 'true';
    process.env.VIES_TIMEOUT_MS = '8000';
  });

  afterEach(() => {
    global.fetch = originalFetch;

    if (originalViesValidationEnabled === undefined) {
      delete process.env.VIES_VALIDATION_ENABLED;
    } else {
      process.env.VIES_VALIDATION_ENABLED = originalViesValidationEnabled;
    }

    if (originalViesTimeoutMs === undefined) {
      delete process.env.VIES_TIMEOUT_MS;
    } else {
      process.env.VIES_TIMEOUT_MS = originalViesTimeoutMs;
    }
  });

  it('maps namespaced valid=false response to invalid status', async () => {
    setFetchXmlResponse(
      `<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Header/><env:Body><ns2:checkVatResponse xmlns:ns2="urn:ec.europa.eu:taxud:vies:services:checkVat:types"><ns2:countryCode>DE</ns2:countryCode><ns2:vatNumber>123456789</ns2:vatNumber><ns2:requestDate>2026-02-13+01:00</ns2:requestDate><ns2:valid>false</ns2:valid><ns2:name>---</ns2:name><ns2:address>---</ns2:address></ns2:checkVatResponse></env:Body></env:Envelope>`
    );

    const result = await validateSellerVatId('DE123456789');

    expect(result.status).toBe('invalid');
    expect(result.reason).toBe('vies_invalid');
    expect(result.viesChecked).toBe(true);
  });

  it('maps namespaced valid=true response to valid status', async () => {
    setFetchXmlResponse(
      `<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Body><ns2:checkVatResponse xmlns:ns2="urn:ec.europa.eu:taxud:vies:services:checkVat:types"><ns2:valid>true</ns2:valid></ns2:checkVatResponse></env:Body></env:Envelope>`
    );

    const result = await validateSellerVatId('DE123456789');

    expect(result.status).toBe('valid');
    expect(result.reason).toBe('ok');
    expect(result.viesChecked).toBe(true);
  });
});
