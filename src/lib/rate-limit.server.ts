/**
 * Simple in-memory sliding-window rate limiter.
 * Keyed by userId + endpoint. Resets on server restart (acceptable for
 * a hackathon; upgrade to Redis for production multi-instance deploys).
 *
 * Usage: const ok = rateLimit("chat", userId, 10, 60);
 */

const store = new Map<string, number[]>();

/**
 * Returns true if the request is allowed (under the limit).
 * @param endpoint  Short name identifying the endpoint (e.g. "chat")
 * @param userId    Identifies who is making the request
 * @param maxReqs   Maximum requests allowed within the window
 * @param windowSec Sliding window in seconds (default 60)
 */
export function rateLimit(
  endpoint: string,
  userId: string,
  maxReqs: number,
  windowSec = 60,
): boolean {
  const key = `${endpoint}:${userId}`;
  const now = Date.now();
  const windowMs = windowSec * 1000;
  const timestamps = (store.get(key) ?? []).filter((t) => now - t < windowMs);
  if (timestamps.length >= maxReqs) return false;
  timestamps.push(now);
  store.set(key, timestamps);
  return true;
}
