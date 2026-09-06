import { describe, expect, it } from 'vitest'
import { errorMessage } from './errors'

describe('errorMessage', () => {
  it('reads the message off a real Error', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom')
  })

  it('reads the message off a Supabase-style error object', () => {
    // PostgrestError and AuthError are plain objects, not Error instances -
    // this is the shape `throw error` produces throughout src/lib/api.ts.
    const postgrestError = { message: 'JWT expired', code: 'PGRST301', details: '', hint: '' }
    expect(errorMessage(postgrestError)).toBe('JWT expired')
  })

  it('falls back to String() for anything without a message', () => {
    expect(errorMessage('plain string')).toBe('plain string')
    expect(errorMessage(42)).toBe('42')
  })

  it('never returns "[object Object]" for anything that has a message', () => {
    expect(errorMessage({ message: 'network error', name: 'AuthRetryableFetchError' })).toBe(
      'network error',
    )
  })
})
