// Generates the PWA icons as real PNG files.
//
// A manifest icon has to be a PNG for Android to use it on the home screen and
// in the notification tray, and pulling in an image library just to draw a leaf
// would be a heavy dependency for something this simple. Node's zlib is enough
// to write a valid PNG by hand.

import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

/** Encodes RGBA pixel data as a PNG. */
function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // colour type: RGBA
  // 10-12 stay zero: deflate, adaptive filtering, no interlace.

  // Each scanline is prefixed with its filter type; 0 means "none", which keeps
  // the encoder trivial and still compresses well for flat artwork.
  const raw = Buffer.alloc(height * (width * 4 + 1))
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1)
    raw[rowStart] = 0
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const GREEN = [22, 121, 74]
const WHITE = [255, 255, 255]

function mix(base, over, alpha) {
  return base.map((channel, i) => Math.round(channel * (1 - alpha) + over[i] * alpha))
}

/**
 * A leaf: the lens where two overlapping circles meet, which gives the pointed
 * ends for free. The circles are offset along x so the lens comes out long and
 * narrow rather than wide, then the whole thing is tilted 45 degrees and given
 * a midrib and a stem. Drawn with 3x3 supersampling so the curves stay smooth.
 */
function leafCoverage(x, y, size) {
  const unit = size / 100
  // Rotate into the leaf's own frame, and sit it slightly above centre so the
  // stem does not push the composition off balance.
  const cx = x / unit - 50
  const cy = y / unit - 47
  const angle = -Math.PI / 4
  const u = cx * Math.cos(angle) - cy * Math.sin(angle)
  const v = cx * Math.sin(angle) + cy * Math.cos(angle)

  const radius = 42
  const offset = 32 // pushed apart along u, so the lens is tall and slim
  const inLeaf =
    Math.hypot(u - offset, v) <= radius && Math.hypot(u + offset, v) <= radius

  // The stem continues past the blunt end of the leaf.
  const inStem = Math.abs(u) < 1.6 && v > 24 && v < 40

  if (inStem) return 1
  if (!inLeaf) return 0

  // The midrib is a gap back to the background, stopping short of the tip.
  const onMidrib = Math.abs(u) < 1.1 && v > -22 && v < 26
  return onMidrib ? 0 : 1
}

function render(size, { maskable }) {
  const rgba = Buffer.alloc(size * size * 4)
  const centre = size / 2
  // A maskable icon is cropped to a circle by the launcher, so the artwork has
  // to sit inside the safe zone and the background has to bleed to the edges.
  const bgRadius = maskable ? size : size * 0.5
  const scale = maskable ? 0.72 : 1

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let leaf = 0
      let inside = 0
      // 3x3 supersample for antialiasing.
      for (let sy = 0; sy < 3; sy++) {
        for (let sx = 0; sx < 3; sx++) {
          const px = x + (sx + 0.5) / 3
          const py = y + (sy + 0.5) / 3
          if (Math.hypot(px - centre, py - centre) <= bgRadius) inside++
          const lx = (px - centre) / scale + centre
          const ly = (py - centre) / scale + centre
          leaf += leafCoverage(lx, ly, size)
        }
      }

      const at = (y * size + x) * 4
      const bgAlpha = inside / 9
      const [r, g, b] = mix(GREEN, WHITE, leaf / 9)
      rgba[at] = r
      rgba[at + 1] = g
      rgba[at + 2] = b
      rgba[at + 3] = Math.round(bgAlpha * 255)
    }
  }

  return encodePng(size, size, rgba)
}

mkdirSync(OUT_DIR, { recursive: true })

const targets = [
  ['icon-192.png', 192, { maskable: false }],
  ['icon-512.png', 512, { maskable: false }],
  ['icon-maskable-512.png', 512, { maskable: true }],
  ['badge-96.png', 96, { maskable: false }],
]

for (const [name, size, options] of targets) {
  writeFileSync(join(OUT_DIR, name), render(size, options))
  console.log(`wrote ${name} (${size}x${size})`)
}
