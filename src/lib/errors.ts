/**
 * Supabase throws plain error objects - PostgrestError, AuthError - rather
 * than Error instances, so `cause instanceof Error` is false for them and
 * `String(cause)` renders as the useless "[object Object]". This pulls the
 * readable `.message` off anything error-shaped instead.
 */
export function errorMessage(cause: unknown): string {
  if (cause instanceof Error) return cause.message
  if (
    typeof cause === 'object' &&
    cause !== null &&
    'message' in cause &&
    typeof (cause as { message: unknown }).message === 'string'
  ) {
    return (cause as { message: string }).message
  }
  return String(cause)
}

/**
 * True for a browser-level failure to reach the network at all - a fetch()
 * that never got a response - as opposed to a request that got one and was
 * rejected (a bad query, an expired session, RLS). Supabase always throws
 * PostgrestError/AuthError for the latter, which are plain objects, never
 * TypeError; a bare fetch failure is the one case that is. Each engine words
 * it differently ("Failed to fetch" in Chrome, "NetworkError when
 * attempting to fetch resource" in Firefox, "Load failed" in Safari), so
 * this checks the shape rather than the message text.
 *
 * Worth naming distinctly because its raw text ("TypeError: Failed to
 * fetch") reads to a non-technical person as the app itself being broken,
 * when it is almost always just a phone whose network has not woken up yet.
 */
export function isNetworkError(cause: unknown): boolean {
  return cause instanceof TypeError
}
