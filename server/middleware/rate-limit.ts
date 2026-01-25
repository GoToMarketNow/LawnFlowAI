// ============================================
// Rate Limiting Middleware
// ============================================

import rateLimit from 'express-rate-limit';
import { Request } from 'express';

/**
 * Rate limiter for authentication endpoints
 * Prevents brute force attacks on login/register
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window per IP
  message: {
    error: 'Too many authentication attempts from this IP, please try again after 15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skipSuccessfulRequests: false,
  // Skip rate limiting in development for easier testing
  skip: () => process.env.NODE_ENV === 'development' && process.env.SKIP_RATE_LIMIT === 'true',
});

/**
 * Rate limiter for general API endpoints
 * Prevents API abuse
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per user/IP
  message: {
    error: 'Too many requests, please slow down and try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Use user ID if available, otherwise fall back to IP
  keyGenerator: (req: Request) => {
    const session = (req as any).session;
    return session?.userId?.toString() || req.ip || 'unknown';
  },
  skip: () => process.env.NODE_ENV === 'development' && process.env.SKIP_RATE_LIMIT === 'true',
});

/**
 * Rate limiter for mobile API endpoints
 * More restrictive to account for mobile app usage patterns
 */
export const mobileLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50, // 50 requests per minute per user
  message: {
    error: 'Too many requests from mobile app, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Use JWT token or IP
  keyGenerator: (req: Request) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      return authHeader.split(' ')[1]?.substring(0, 20) || req.ip || 'unknown';
    }
    return req.ip || 'unknown';
  },
  skip: () => process.env.NODE_ENV === 'development' && process.env.SKIP_RATE_LIMIT === 'true',
});

/**
 * Strict rate limiter for sensitive operations
 * Used for password changes, account deletion, etc.
 */
export const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour
  message: {
    error: 'Too many attempts for this sensitive operation, please try again after 1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failed requests
  skip: () => process.env.NODE_ENV === 'development' && process.env.SKIP_RATE_LIMIT === 'true',
});

/**
 * Rate limiter for webhook endpoints
 * Note: Webhooks should also use signature verification, not just rate limiting
 */
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1000, // Very high limit - webhooks can be bursty
  message: {
    error: 'Webhook rate limit exceeded'
  },
  standardHeaders: false,
  legacyHeaders: false,
  // Webhooks should be verified by signature, not rate limited aggressively
  skip: () => false, // Always apply, even in development
});
