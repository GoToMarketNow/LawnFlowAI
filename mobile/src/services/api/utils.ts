import crypto from 'crypto';

// ============================================
// API Utility Functions
// ============================================

/**
 * Generate trace ID for request tracing
 * Format: {prefix}_{timestamp}_{random}
 */
export function generateTraceId(prefix: string = 'mobile'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Generate idempotency key for command deduplication
 * Format: SHA-256(commandType + entityId + timestamp_hour)
 *
 * Uses hourly window to allow retries within same hour
 * while preventing duplicate execution
 */
export function generateIdempotencyKey(
  commandType: string,
  entityId: string
): string {
  const hourWindow = Math.floor(Date.now() / (60 * 60 * 1000)); // Current hour
  const input = `${commandType}:${entityId}:${hourWindow}`;

  // Simple hash for React Native (crypto-js alternative)
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return `idem_${Math.abs(hash).toString(36)}_${hourWindow}`;
}

/**
 * Generate device ID fingerprint
 */
export function generateDeviceId(deviceInfo: {
  osName?: string | null;
  modelId?: string | null;
  brand?: string | null;
}): string {
  const parts = [
    deviceInfo.osName || 'unknown',
    deviceInfo.modelId || 'unknown',
    deviceInfo.brand || 'unknown',
    Date.now(),
  ];

  return parts.join('-');
}

/**
 * Format error message from API response
 */
export function formatApiError(error: any): string {
  if (error.response?.data?.message) {
    return error.response.data.message;
  }

  if (error.response?.data?.error) {
    return error.response.data.error;
  }

  if (error.message) {
    return error.message;
  }

  return 'An unexpected error occurred';
}

/**
 * Check if error is network-related (for offline handling)
 */
export function isNetworkError(error: any): boolean {
  return (
    !error.response ||
    error.code === 'ECONNABORTED' ||
    error.code === 'ERR_NETWORK' ||
    error.message?.includes('Network')
  );
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: any): boolean {
  if (isNetworkError(error)) return true;

  const status = error.response?.status;
  return status === 429 || status === 503 || status === 504;
}
