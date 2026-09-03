// Generates the VAPID key pair that identifies this app to push services.
//
// Run once: `npm run vapid`. The public key goes into the browser bundle, the
// private key stays a server secret. Regenerating them invalidates every
// existing subscription, so keep the output somewhere safe.

import { webcrypto } from 'node:crypto'

const toBase64Url = (buffer) => Buffer.from(buffer).toString('base64url')

const pair = await webcrypto.subtle.generateKey(
  { name: 'ECDSA', namedCurve: 'P-256' },
  true,
  ['sign', 'verify'],
)

const publicKey = toBase64Url(await webcrypto.subtle.exportKey('raw', pair.publicKey))
const { d: privateKey } = await webcrypto.subtle.exportKey('jwk', pair.privateKey)

console.log(`
VAPID keys generated.

  Public key  (safe to publish - goes in the app bundle)
  ${publicKey}

  Private key (secret - only the Supabase Edge Functions see this)
  ${privateKey}

Next:
  1. GitHub repo -> Settings -> Secrets and variables -> Actions -> Variables:
       VITE_VAPID_PUBLIC_KEY = the public key above
  2. Supabase dashboard -> Edge Functions -> Secrets:
       VAPID_PUBLIC_KEY  = the public key above
       VAPID_PRIVATE_KEY = the private key above
       VAPID_SUBJECT     = mailto:your-email@example.com
`)
