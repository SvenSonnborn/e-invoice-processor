/**
 * Rate Limiting
 * Rate limiting helpers and utilities
 */

export interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
}

export class RateLimiter {
  private requests: Map<string, number[]> = new Map();

  constructor(private options: RateLimitOptions) {}

  check(identifier: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(identifier) || [];
    const recentRequests = requests.filter(
      (time) => now - time < this.options.windowMs
    );

    if (recentRequests.length >= this.options.maxRequests) {
      return false;
    }

    recentRequests.push(now);
    this.requests.set(identifier, recentRequests);
    return true;
  }
}
