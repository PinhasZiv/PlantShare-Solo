import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * True when the build was given its Supabase details. When it is false the app
 * renders a setup screen instead of crashing on a null client, which is what
 * you get on a first deploy before the secrets are filled in.
 */
export const isConfigured = Boolean(url && anonKey)

export const supabase = createClient(url ?? 'http://localhost:54321', anonKey ?? 'anon', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // The OAuth redirect comes back with the session in the URL fragment; this
    // picks it up and then cleans the address bar.
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
})

export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? ''

/** Absolute URL of the app itself, respecting the GitHub Pages sub-path. */
export function appUrl(): string {
  return new URL(import.meta.env.BASE_URL, window.location.origin).href
}
