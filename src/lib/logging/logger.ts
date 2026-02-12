/**
 * Logger Configuration
 * Pino-based logging setup
 */

import pino from 'pino';
import { env } from '@/src/lib/config/env';

export const logger = pino({
  level: env.LOG_LEVEL,
  ...(process.env.NODE_ENV === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
      },
    },
  }),
});
