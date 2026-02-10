/**
 * Type declarations for Bun's built-in test module
 * @see https://bun.sh/docs/api/test
 */

declare module "bun:test" {
  export interface Matchers<T = unknown> {
    toBe(expected: T): void;
    toEqual(expected: T): void;
    not: Matchers<T>;
    toBeTruthy(): void;
    toBeFalsy(): void;
    toBeNull(): void;
    toBeUndefined(): void;
    toBeDefined(): void;
    toMatch(regex: RegExp | string): void;
    toContain(item: unknown): void;
    toHaveLength(length: number): void;
    toBeGreaterThan(expected: number): void;
    toBeGreaterThanOrEqual(expected: number): void;
    toBeLessThan(expected: number): void;
    toBeLessThanOrEqual(expected: number): void;
    toThrow(error?: Error | string | RegExp): void;
    toBeInstanceOf(expected: new (...args: unknown[]) => unknown): void;
    toBeArray(): void;
    toBeBoolean(): void;
    toBeNumber(): void;
    toBeString(): void;
    toBeObject(): void;
  }

  export interface Expect {
    <T = unknown>(actual: T): Matchers<T>;
  }

  export interface TestFunction {
    (name: string, fn: () => void | Promise<void>): void;
    skip(name: string, fn: () => void | Promise<void>): void;
    only(name: string, fn: () => void | Promise<void>): void;
    todo(name: string): void;
    concurrent(name: string, fn: () => void | Promise<void>): void;
    serial(name: string, fn: () => void | Promise<void>): void;
    failing(name: string, fn: () => void | Promise<void>): void;
  }

  export interface DescribeFunction {
    (name: string, fn: () => void): void;
    skip(name: string, fn: () => void): void;
    only(name: string, fn: () => void): void;
  }

  export const test: TestFunction;
  export const it: TestFunction;
  export const describe: DescribeFunction;
  export const expect: Expect;
  export function beforeEach(fn: () => void | Promise<void>): void;
  export function afterEach(fn: () => void | Promise<void>): void;
  export function beforeAll(fn: () => void | Promise<void>): void;
  export function afterAll(fn: () => void | Promise<void>): void;
  export const mock: {
    module: (specifier: string, factory: () => unknown) => void;
    restore?: () => void;
    clearAllMocks?: () => void;
  };
}
