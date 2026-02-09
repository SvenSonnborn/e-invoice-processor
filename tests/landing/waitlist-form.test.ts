import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { joinSchema } from './waitlist-schema';

describe('Waitlist Form Validation', () => {
  it('should validate a complete valid form', () => {
    const validData = {
      name: 'John Doe',
      email: 'john@example.com',
      company: 'Acme Inc',
      tier: 'pro' as const,
    };

    const result = joinSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should validate without optional company', () => {
    const validData = {
      name: 'Jane Doe',
      email: 'jane@example.com',
      tier: 'basic' as const,
    };

    const result = joinSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject invalid email', () => {
    const invalidData = {
      name: 'John Doe',
      email: 'invalid-email',
      tier: 'pro' as const,
    };

    const result = joinSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject short name', () => {
    const invalidData = {
      name: 'J',
      email: 'john@example.com',
      tier: 'pro' as const,
    };

    const result = joinSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject invalid tier', () => {
    const invalidData = {
      name: 'John Doe',
      email: 'john@example.com',
      tier: 'enterprise',
    };

    const result = joinSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject missing required fields', () => {
    const invalidData = {
      name: 'John Doe',
    };

    const result = joinSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});
