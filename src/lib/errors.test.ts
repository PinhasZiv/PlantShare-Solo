import { describe, expect, it } from 'vitest'
import { errorMessage, isNetworkError } from './errors'

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

// A bare fetch() failure (no response reached at all) is the one case
// browsers throw as a TypeError - every Supabase rejection (an expired
// session, RLS, a bad query) is a plain PostgrestError/AuthError object
// instead. That's the one reliable signal to tell "the phone has no network
// yet" apart from "the request went through and was rejected".
describe('isNetworkError', () => {
  it('recognizes a bare fetch failure regardless of the engine-specific wording', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true)
    expect(isNetworkError(new TypeError('Load failed'))).toBe(true)
    expect(isNetworkError(new TypeError('NetworkError when attempting to fetch resource.'))).toBe(
      true,
    )
  })

  it('does not mistake a real Supabase rejection for a network failure', () => {
    expect(isNetworkError({ message: 'JWT expired', code: 'PGRST301' })).toBe(false)
    expect(isNetworkError(new Error('not authenticated'))).toBe(false)
  })
})
