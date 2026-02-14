import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  VIES_VALIDATION_ENABLED: z.enum(['true', 'false']).optional(),
  VIES_TIMEOUT_MS: z
    .string()
    .regex(
      /^\d+$/,
      'VIES_TIMEOUT_MS must be a positive integer in milliseconds'
    )
    .optional(),
  EINVOICE_VALIDATOR_TIMEOUT_MS: z
    .string()
    .regex(
      /^\d+$/,
      'EINVOICE_VALIDATOR_TIMEOUT_MS must be a positive integer in milliseconds'
    )
    .optional(),
  XRECHNUNG_VALIDATOR_COMMAND: z.string().optional(),
  ZUGFERD_VALIDATOR_COMMAND: z.string().optional(),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
});

// In Next.js, env vars are available on the server at runtime.
// We keep this minimal and server-focused.
export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

function buildRawEnv() {
  const isTest = process.env.NODE_ENV === 'test';

  return {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      (isTest ? 'http://localhost' : undefined),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      (isTest ? 'test' : undefined),
    SUPABASE_SERVICE_ROLE_KEY:
      process.env.SUPABASE_SERVICE_ROLE_KEY || (isTest ? 'test' : undefined),
    VIES_VALIDATION_ENABLED: process.env.VIES_VALIDATION_ENABLED,
    VIES_TIMEOUT_MS: process.env.VIES_TIMEOUT_MS,
    EINVOICE_VALIDATOR_TIMEOUT_MS: process.env.EINVOICE_VALIDATOR_TIMEOUT_MS,
    XRECHNUNG_VALIDATOR_COMMAND: process.env.XRECHNUNG_VALIDATOR_COMMAND,
    ZUGFERD_VALIDATOR_COMMAND: process.env.ZUGFERD_VALIDATOR_COMMAND,
    LOG_LEVEL: process.env.LOG_LEVEL,
  };
}

function getEnv(): Env {
  if (cachedEnv) {
    return cachedEnv;
  }

  cachedEnv = envSchema.parse(buildRawEnv());
  return cachedEnv;
}

export const env: Env = new Proxy({} as Env, {
  get(_target, prop: keyof Env | symbol) {
    if (typeof prop !== 'string') {
      return undefined;
    }

    return getEnv()[prop as keyof Env];
  },
});
