import { ApiError } from '@/src/lib/errors/api-error';

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

interface ResolveStripeRedirectUrlInput {
  requestUrl: string;
  value: string | undefined;
  defaultPath: string;
  fieldName: 'successUrl' | 'cancelUrl' | 'returnUrl';
}

function getApplicationOrigin(requestUrl: string): string {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (configuredSiteUrl) {
    try {
      return new URL(configuredSiteUrl).origin;
    } catch {
      // Ignore invalid NEXT_PUBLIC_SITE_URL and fall back to request origin.
    }
  }
  return new URL(requestUrl).origin;
}

export function resolveStripeRedirectUrl(
  input: ResolveStripeRedirectUrlInput
): string {
  const appOrigin = getApplicationOrigin(input.requestUrl);
  const fallbackUrl = new URL(input.defaultPath, appOrigin).toString();

  if (!input.value) {
    return fallbackUrl;
  }

  const trimmedValue = input.value.trim();
  if (!trimmedValue) {
    return fallbackUrl;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmedValue, appOrigin);
  } catch {
    throw ApiError.validationError(`${input.fieldName} must be a valid URL`);
  }

  if (!ALLOWED_PROTOCOLS.has(parsedUrl.protocol)) {
    throw ApiError.validationError(
      `${input.fieldName} must use http or https`
    );
  }

  if (parsedUrl.origin !== appOrigin) {
    throw ApiError.validationError(
      `${input.fieldName} must use the application origin`
    );
  }

  return parsedUrl.toString();
}
