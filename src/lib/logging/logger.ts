/**
 * Logger Configuration
 * Pino-based logging setup
 */

import pino from 'pino';
import { env } from '@/src/lib/config/env';

export const SENSITIVE_LOG_REDACT_PATHS: string[] = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers.x-api-key',
  'authorization',
  'cookie',
  '*.authorization',
  '*.cookie',
  '*.token',
  '*.access_token',
  '*.refresh_token',
  '*.password',
  '*.apiKey',
  '*.api_key',
  '*.secret',
  '*.secretKey',
  '*.secret_key',
];

export const SENSITIVE_LOG_REDACT_CONFIG: {
  paths: string[];
  remove: boolean;
} = {
  paths: SENSITIVE_LOG_REDACT_PATHS,
  remove: true,
};

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: SENSITIVE_LOG_REDACT_CONFIG,
  ...(process.env.NODE_ENV === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
      },
    },
  }),
});
