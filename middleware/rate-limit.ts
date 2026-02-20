/**
 * Per-app rate limiting with sliding window.
 * In-memory for now — swap to Redis for multi-instance.
 */
import express from 'express';
type Request = express.Request;
type Response = express.Response;
type NextFunction = express.NextFunction;
import { apiError, ErrorCode } from './validate.ts';

interface RateBucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, RateBucket>();

// Clean old buckets every 5 min
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [key, bucket] of buckets) {
    if (bucket.lastRefill < cutoff) buckets.delete(key);
  }
}, 5 * 60 * 1000);

interface RateLimitConfig {
  maxRequests: number;  // per window
  windowMs: number;     // window size in ms
  keyFn?: (req: Request) => string; // custom key extractor
}

export function rateLimit(config: RateLimitConfig) {
  const { maxRequests, windowMs, keyFn } = config;

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyFn ? keyFn(req) : `${req.headers['x-app-id'] || req.ip}:${req.path}`;
    const now = Date.now();
    
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { tokens: maxRequests, lastRefill: now };
      buckets.set(key, bucket);
    }

    // Refill tokens based on elapsed time
    const elapsed = now - bucket.lastRefill;
    const refill = Math.floor(elapsed / windowMs) * maxRequests;
    if (refill > 0) {
      bucket.tokens = Math.min(maxRequests, bucket.tokens + refill);
      bucket.lastRefill = now;
    }

    if (bucket.tokens <= 0) {
      const retryAfter = Math.ceil((windowMs - (now - bucket.lastRefill)) / 1000);
      res.set('Retry-After', String(retryAfter));
      return apiError(res, 429, ErrorCode.RATE_LIMITED, `Rate limit exceeded. Try again in ${retryAfter}s`);
    }

    bucket.tokens--;
    res.set('X-RateLimit-Remaining', String(bucket.tokens));
    res.set('X-RateLimit-Limit', String(maxRequests));
    next();
  };
}

// Presets
export const authRateLimit = rateLimit({ maxRequests: 10, windowMs: 60 * 1000 }); // 10/min
export const dataReadRateLimit = rateLimit({ maxRequests: 100, windowMs: 60 * 1000 }); // 100/min  
export const dataWriteRateLimit = rateLimit({ maxRequests: 30, windowMs: 60 * 1000 }); // 30/min
export const storageRateLimit = rateLimit({ maxRequests: 10, windowMs: 60 * 1000 }); // 10/min
export const notifyRateLimit = rateLimit({ maxRequests: 5, windowMs: 60 * 1000 }); // 5/min
