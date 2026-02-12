import { describe, it, expect } from 'bun:test';
import {
  formatDate,
  formatDateTime,
  formatCurrency,
} from '@/src/lib/dates/formatter';

describe('Date formatting utilities', () => {
  const testDate = new Date('2024-01-15T14:30:00Z');

  describe('formatDate', () => {
    it('should format date in German locale', () => {
      const result = formatDate(testDate);
      expect(result).toMatch(/\d{2}\.\d{2}\.\d{4}/);
    });

    it('should format date with custom locale', () => {
      const result = formatDate(testDate, 'en-US');
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });

    it('should handle valid Date objects', () => {
      expect(() => formatDate(testDate)).not.toThrow();
    });
  });

  describe('formatDateTime', () => {
    it('should format date and time in German locale', () => {
      const result = formatDateTime(testDate);
      expect(result).toMatch(/\d{2}\.\d{2}\.\d{4}/);
      expect(result).toMatch(/\d{2}:\d{2}/);
    });

    it('should format date and time with custom locale', () => {
      const result = formatDateTime(testDate, 'en-US');
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });
  });

  describe('formatCurrency', () => {
    it('should format currency in EUR by default', () => {
      const result = formatCurrency(1234.56);
      expect(result).toContain('1.234,56');
      expect(result).toContain('€');
    });

    it('should format currency with custom currency', () => {
      const result = formatCurrency(1234.56, 'USD', 'en-US');
      expect(result).toContain('$');
    });

    it('should handle zero amount', () => {
      const result = formatCurrency(0);
      expect(result).toContain('0');
    });

    it('should handle negative amounts', () => {
      const result = formatCurrency(-100);
      expect(result).toContain('-');
    });
  });
});
