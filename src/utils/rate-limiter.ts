import { Elysia } from "elysia";

export interface RateLimitOptions {
  /**
   * Time window in milliseconds (default: 60,000ms = 1 minute).
   */
  windowMs?: number;

  /**
   * Maximum allowed requests within the window (default: 5).
   */
  max?: number;

  /**
   * Custom human-readable error message returned when limit is exceeded.
   */
  message?: string;

  /**
   * Optional custom key generator (defaults to client IP address).
   */
  keyGenerator?: (request: Request, server: any) => string;
}

interface RateLimitRecord {
  timestamps: number[];
}

/**
 * Creates an Elysia scoped plugin for rate-limiting requests using an in-memory sliding window.
 */
export function createRateLimiter(options: RateLimitOptions = {}) {
  const windowMs = options.windowMs ?? 60_000;
  const max = options.max ?? 5;
  const message =
    options.message ?? "Too many attempts. Please try again after 1 minute.";

  const hits = new Map<string, RateLimitRecord>();

  // Periodically clean up stale entries every 2 minutes
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of hits.entries()) {
      record.timestamps = record.timestamps.filter((t) => now - t < windowMs);
      if (record.timestamps.length === 0) {
        hits.delete(key);
      }
    }
  }, 120_000);

  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }

  const beforeHandle = ({ request, set, server }: any) => {
    let clientKey: string;

    if (options.keyGenerator) {
      clientKey = options.keyGenerator(request, server);
    } else {
      const forwarded = request.headers.get("x-forwarded-for");
      clientKey =
        (forwarded ? forwarded.split(",")[0].trim() : undefined) ||
        request.headers.get("cf-connecting-ip") ||
        (server ? (server as any).requestIP(request)?.address : undefined) ||
        "127.0.0.1";
    }

    const now = Date.now();
    const record = hits.get(clientKey) ?? { timestamps: [] };

    // Keep only timestamps that fall within the current sliding window
    record.timestamps = record.timestamps.filter((t) => now - t < windowMs);

    const remaining = Math.max(0, max - record.timestamps.length);
    const oldestTimestamp = record.timestamps[0] ?? now;
    const resetSeconds = Math.max(
      1,
      Math.ceil((oldestTimestamp + windowMs - now) / 1000)
    );

    // Populate standard RateLimit response headers
    set.headers["RateLimit-Limit"] = String(max);
    set.headers["RateLimit-Remaining"] = String(Math.max(0, remaining - 1));
    set.headers["RateLimit-Reset"] = String(resetSeconds);

    if (record.timestamps.length >= max) {
      set.status = 429;
      set.headers["Retry-After"] = String(resetSeconds);
      return {
        success: false,
        error: message,
      };
    }

    record.timestamps.push(now);
    hits.set(clientKey, record);
  };

  const plugin = new Elysia({ name: "rate-limiter" }).onBeforeHandle(
    { as: "scoped" },
    beforeHandle
  );

  return Object.assign(plugin, {
    beforeHandle,
    check: beforeHandle,
  });
}
