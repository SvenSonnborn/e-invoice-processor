/**
 * In-Memory Rate Limiter
 *
 * Provides per-IP, per-user, and global rate limiting.
 * State is held in memory — resets on server restart.
 */

import { logger } from "@/src/lib/logging";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  /** Max requests per IP within the window */
  maxPerIp: number;
  /** Window duration in ms for per-IP limits */
  ipWindowMs: number;
  /** Max requests per authenticated user per day */
  maxPerUserPerDay: number;
  /** Max global requests per day */
  maxGlobalPerDay: number;
}

interface RateLimitResult {
  allowed: boolean;
  reason?: "ip" | "user" | "global";
  retryAfterMs?: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxPerIp: 2,
  ipWindowMs: 60_000, // 1 minute
  maxPerUserPerDay: 5,
  maxGlobalPerDay: 10,
};

class RateLimiter {
  private config: RateLimitConfig;
  private ipMap = new Map<string, RateLimitEntry>();
  private userMap = new Map<string, RateLimitEntry>();
  private global: RateLimitEntry;
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.global = this.createDailyEntry();

    // Clean up expired entries every 10 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 10 * 60_000);
    // Allow Node to exit without waiting for the interval
    if (typeof this.cleanupInterval === "object" && "unref" in this.cleanupInterval) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Check whether a request is allowed.
   *
   * @param ip      - Client IP address
   * @param userId  - Authenticated user ID (optional)
   */
  check(ip: string, userId?: string): RateLimitResult {
    const now = Date.now();

    // 1. Global daily limit
    this.resetIfExpired(this.global, now);
    if (this.global.count >= this.config.maxGlobalPerDay) {
      logger.warn({ ip, userId }, "Rate limit reached: global daily limit");
      return {
        allowed: false,
        reason: "global",
        retryAfterMs: this.global.resetAt - now,
      };
    }

    // 2. Per-IP limit (per minute)
    const ipEntry = this.getOrCreate(this.ipMap, ip, () => ({
      count: 0,
      resetAt: now + this.config.ipWindowMs,
    }));
    this.resetIfExpired(ipEntry, now);
    if (ipEntry.count >= this.config.maxPerIp) {
      logger.warn({ ip }, "Rate limit reached: IP per-minute limit");
      return {
        allowed: false,
        reason: "ip",
        retryAfterMs: ipEntry.resetAt - now,
      };
    }

    // 3. Per-user daily limit
    if (userId) {
      const userEntry = this.getOrCreate(this.userMap, userId, () =>
        this.createDailyEntry()
      );
      this.resetIfExpired(userEntry, now);
      if (userEntry.count >= this.config.maxPerUserPerDay) {
        logger.warn({ userId }, "Rate limit reached: user daily limit");
        return {
          allowed: false,
          reason: "user",
          retryAfterMs: userEntry.resetAt - now,
        };
      }
      userEntry.count++;
    }

    // All checks passed — increment counters
    ipEntry.count++;
    this.global.count++;

    return { allowed: true };
  }

  // ── helpers ──────────────────────────────────────────────

  private createDailyEntry(): RateLimitEntry {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setHours(24, 0, 0, 0);
    return { count: 0, resetAt: tomorrow.getTime() };
  }

  private resetIfExpired(entry: RateLimitEntry, now: number): void {
    if (now >= entry.resetAt) {
      entry.count = 0;
      // For daily entries, push to next midnight; for short windows, push by windowMs
      if (entry.resetAt - (now - this.config.ipWindowMs) < this.config.ipWindowMs * 2) {
        entry.resetAt = now + this.config.ipWindowMs;
      } else {
        const tomorrow = new Date(now);
        tomorrow.setHours(24, 0, 0, 0);
        entry.resetAt = tomorrow.getTime();
      }
    }
  }

  private getOrCreate(
    map: Map<string, RateLimitEntry>,
    key: string,
    factory: () => RateLimitEntry
  ): RateLimitEntry {
    let entry = map.get(key);
    if (!entry) {
      entry = factory();
      map.set(key, entry);
    }
    return entry;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.ipMap) {
      if (now >= entry.resetAt) this.ipMap.delete(key);
    }
    for (const [key, entry] of this.userMap) {
      if (now >= entry.resetAt) this.userMap.delete(key);
    }
  }
}

/** Singleton rate limiter for the OCR endpoint */
export const ocrRateLimiter = new RateLimiter();

export type { RateLimitConfig, RateLimitResult };
export { RateLimiter };
