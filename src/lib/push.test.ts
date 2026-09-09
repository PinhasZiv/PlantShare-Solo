import { FunctionsHttpError } from '@supabase/supabase-js'
// supabase-js re-exports the error classes but not FunctionsClient itself -
// its `.functions` getter returns a fresh instance on every access, so the
// only method spyOn can usefully target is the one on this shared prototype.
import { FunctionsClient } from '@supabase/functions-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setLanguage } from './i18n'
import { sendTestNotification } from './push'

// send-test returns a non-2xx status for every failure case (not
// authenticated, no subscriptions, the server-side setup missing), and
// supabase-js turns every one of those into the same generic-looking
// FunctionsHttpError, discarding the response body into `error.context`
// instead of `data`. These tests exist because a first version of
// sendTestNotification() never read that body, so all of those distinct
// failures - including a stale sign-in, which is what actually happened once
// - collapsed into one misleading "could not reach the server" message.

/** A FunctionsHttpError whose body is `{ error: reason }`, as send-test sends. */
function httpErrorWithReason(reason: string): FunctionsHttpError {
  return new FunctionsHttpError({ json: async () => ({ error: reason }) })
}

describe('sendTestNotification', () => {
  beforeEach(() => {
    setLanguage('he', { remember: false })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reports success with the delivered/device counts', async () => {
    vi.spyOn(FunctionsClient.prototype, 'invoke').mockResolvedValue({
      data: { ok: true, delivered: 1, devices: 1 },
      error: null,
    } as never)

    const result = await sendTestNotification()
    expect(result).toEqual({ ok: true, message: 'נשלחה ל-1 מתוך 1 מכשיר.' })
  })

  it('reports a push-service rejection when the function succeeds but delivery did not', async () => {
    vi.spyOn(FunctionsClient.prototype, 'invoke').mockResolvedValue({
      data: { ok: false, delivered: 0, devices: 1 },
      error: null,
    } as never)

    const result = await sendTestNotification()
    expect(result.ok).toBe(false)
    expect(result.message).toContain('דחה')
  })

  it('tells the person to sign in again for a stale/expired session, not "could not reach the server"', async () => {
    vi.spyOn(FunctionsClient.prototype, 'invoke').mockResolvedValue({
      data: null,
      error: httpErrorWithReason('not authenticated'),
    } as never)

    const result = await sendTestNotification()
    expect(result.ok).toBe(false)
    expect(result.message).toContain('החיבור שלך פג')
  })

  it('reports no_subscriptions distinctly from a stale session', async () => {
    vi.spyOn(FunctionsClient.prototype, 'invoke').mockResolvedValue({
      data: null,
      error: httpErrorWithReason('no_subscriptions'),
    } as never)

    const result = await sendTestNotification()
    expect(result.ok).toBe(false)
    expect(result.message).toContain('עדיין לא רשום')
  })

  it('reports a missing server-side setup distinctly', async () => {
    vi.spyOn(FunctionsClient.prototype, 'invoke').mockResolvedValue({
      data: null,
      error: httpErrorWithReason('not_configured'),
    } as never)

    const result = await sendTestNotification()
    expect(result.ok).toBe(false)
    expect(result.message).toContain('ההגדרות בשרת חסרות')
  })

  it('falls back to a generic server-error message for an unrecognized HTTP failure', async () => {
    vi.spyOn(FunctionsClient.prototype, 'invoke').mockResolvedValue({
      data: null,
      error: httpErrorWithReason('something_else'),
    } as never)

    const result = await sendTestNotification()
    expect(result.ok).toBe(false)
    expect(result.message).toBe('השרת החזיר שגיאה. אפשר לנסות שוב בעוד רגע.')
  })

  it('only says "could not reach the server" for an actual network/relay failure', async () => {
    vi.spyOn(FunctionsClient.prototype, 'invoke').mockResolvedValue({
      data: null,
      error: new Error('network down'),
    } as never)

    const result = await sendTestNotification()
    expect(result.ok).toBe(false)
    expect(result.message).toBe('לא הצלחתי להגיע לשרת. האם הפונקציה send-test הועלתה?')
  })
})
