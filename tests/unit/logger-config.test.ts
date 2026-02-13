import { describe, expect, it } from 'bun:test';
import {
  SENSITIVE_LOG_REDACT_CONFIG,
  SENSITIVE_LOG_REDACT_PATHS,
  logger,
} from '@/src/lib/logging/logger';

describe('logger configuration', () => {
  it('creates a logger instance', () => {
    expect(logger).toBeDefined();
  });

  it('redacts common sensitive fields', () => {
    expect(SENSITIVE_LOG_REDACT_CONFIG.remove).toBe(true);
    expect(SENSITIVE_LOG_REDACT_CONFIG.paths).toBe(SENSITIVE_LOG_REDACT_PATHS);

    const requiredPaths = [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.token',
      '*.password',
      '*.secret',
    ];

    for (const path of requiredPaths) {
      expect(SENSITIVE_LOG_REDACT_PATHS.includes(path)).toBe(true);
    }
  });
});
