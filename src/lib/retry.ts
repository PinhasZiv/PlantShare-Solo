/**
 * Retries a flaky async operation with a short, increasing pause between
 * attempts - not to work around a real failure, but because a cold start
 * (opening a backgrounded PWA, or a network interface waking back up after a
 * WiFi/LTE handoff) can lose the very first request to something that clears
 * up within a few seconds on its own.
 */
export async function withRetry<T>(fn: () => Promise<T>, delaysMs: number[]): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn()
    } catch (cause) {
      if (attempt >= delaysMs.length) throw cause
      await new Promise((resolve) => setTimeout(resolve, delaysMs[attempt]))
    }
  }
}

/**
 * How long to keep silently retrying a cold-start fetch (the initial data
 * load, and restoring a push subscription) before finally giving up. A
 * single 1.2s retry cleared a fast reconnect but still lost to a slower one
 * (a spotty connection actually recovering, not just a quick WiFi/LTE
 * handoff), so this spreads three retries - 1s, 2s, 4s - over up to 10s.
 */
export const COLD_START_RETRY_DELAYS_MS = [1000, 2000, 4000]
