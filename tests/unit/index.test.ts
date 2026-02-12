import { describe, it, expect } from 'bun:test';

/**
 * Basic smoke test to ensure the test suite is working
 */
describe('Test suite', () => {
  it('should run tests successfully', () => {
    expect(true).toBe(true);
  });

  it('should support basic assertions', () => {
    expect(1 + 1).toBe(2);
    expect('hello').toBe('hello');
    expect([1, 2, 3]).toHaveLength(3);
  });
});
