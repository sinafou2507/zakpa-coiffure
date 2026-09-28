/**
 * Détourage du logo : supprime le fond blanc et produit un PNG transparent.
 *
 * Méthode : remplissage par diffusion (flood fill) depuis les bords de
 * l'image uniquement. Les zones blanches *enfermées* dans le logo (rayures
 * du poteau de barbier, reflets, liserés) sont donc préservées.
 * Un dégradé d'opacité est appliqué sur le contour pour éviter l'effet
 * « escalier ».
 *
 * Usage :  node tools/logo-transparent.mjs [source] [destination]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { inflateSync, deflateSync } from 'node:zlib'
import { execFileSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = process.argv[2] ?? join(ROOT, 'assets/img/logo-original.png')
const DST = process.argv[3] ?? join(ROOT, 'assets/img/logo.png')

/* Seuil : un pixel est « fond » si ses trois canaux dépassent ce seuil
   et qu'il est peu saturé (pour ne pas manger l'or clair). */
const WHITE_MIN = Number(process.env.WHITE_MIN ?? 205)
const MAX_SATURATION = 20

/* ───────────────────────── Décodage PNG ───────────────────────── */
function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('Ce n’est pas un PNG')

  let pos = 8
  let hdr = null
  let palette = null
  let trns = null
  const idat = []

  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.toString('ascii', pos + 4, pos + 8)
    const data = buf.subarray(pos + 8, pos + 8 + len)

    if (type === 'IHDR') {
      hdr = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        interlace: data[12],
      }
    } else if (type === 'PLTE') palette = data
    else if (type === 'tRNS') trns = data
    else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break

    pos += 12 + len
  }

  if (!hdr) throw new Error('IHDR manquant')
  if (hdr.bitDepth !== 8) throw new Error('Seule la profondeur 8 bits est gérée (ici ' + hdr.bitDepth + ')')
  if (hdr.interlace !== 0) throw new Error('PNG entrelacé non géré')

  const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }
  const channels = CHANNELS[hdr.colorType]
  if (!channels) throw new Error('Type de couleur non géré : ' + hdr.colorType)

  const { width, height } = hdr
  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const pixels = Buffer.alloc(stride * height)
  const bpp = channels

  let prev = Buffer.alloc(stride)
  let p = 0
  for (let y = 0; y < height; y += 1) {
    const filter = raw[p]
    p += 1
    const line = raw.subarray(p, p + stride)
    p += stride
    const cur = Buffer.alloc(stride)

    for (let i = 0; i < stride; i += 1) {
      const a = i >= bpp ? cur[i - bpp] : 0
      const b = prev[i]
      const c = i >= bpp ? prev[i - bpp] : 0
      let v = line[i]

      if (filter === 1) v = (v + a) & 255
      else if (filter === 2) v = (v + b) & 255
      else if (filter === 3) v = (v + ((a + b) >> 1)) & 255
      else if (filter === 4) {
        const pp = a + b - c
        const pa = Math.abs(pp - a)
        const pb = Math.abs(pp - b)
        const pc = Math.abs(pp - c)
        const pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
        v = (v + pred) & 255
      }
      cur[i] = v
    }
    cur.copy(pixels, y * stride)
    prev = cur
  }

  /* Conversion en RGBA */
  const rgba = Buffer.alloc(width * height * 4)
  for (let i = 0, n = width * height; i < n; i += 1) {
    let r, g, b, a = 255
    const s = i * channels
    if (hdr.colorType === 0) { r = g = b = pixels[s] }
    else if (hdr.colorType === 2) { r = pixels[s]; g = pixels[s + 1]; b = pixels[s + 2] }
    else if (hdr.colorType === 4) { r = g = b = pixels[s]; a = pixels[s + 1] }
    else if (hdr.colorType === 6) { r = pixels[s]; g = pixels[s + 1]; b = pixels[s + 2]; a = pixels[s + 3] }
    else { // palette
      const idx = pixels[s]
      r = palette[idx * 3]; g = palette[idx * 3 + 1]; b = palette[idx * 3 + 2]
      if (trns && idx < trns.length) a = trns[idx]
    }
    const o = i * 4
    rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = b; rgba[o + 3] = a
  }

  return { width, height, rgba, hdr }
}

/* ───────────────────────── Encodage PNG ───────────────────────── */
const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 255] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const t = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crc])
}

function encodePNG(width, height, rgba) {
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0 // filtre None
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8   // 8 bits
  ihdr[9] = 6   // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/* ───────────────────────── Traitement ───────────────────────── */
const { width, height, rgba, hdr } = decodePNG(readFileSync(SRC))
console.log(`Source : ${width} × ${height}, type ${hdr.colorType}, ${hdr.bitDepth} bits`)

const corner = [0, (width - 1) * 4, (height - 1) * width * 4, ((height - 1) * width + width - 1) * 4]
  .map((o) => `rgb(${rgba[o]},${rgba[o + 1]},${rgba[o + 2]})`)
console.log('Coins : ' + corner.join('  '))

const isBackground = (i) => {
  const o = i * 4
  const r = rgba[o], g = rgba[o + 1], b = rgba[o + 2]
  return Math.min(r, g, b) >= WHITE_MIN && Math.max(r, g, b) - Math.min(r, g, b) <= MAX_SATURATION
}

/* Flood fill depuis tous les bords */
const background = new Uint8Array(width * height)
const stack = []
const push = (x, y) => {
  if (x < 0 || y < 0 || x >= width || y >= height) return
  const i = y * width + x
  if (background[i] || !isBackground(i)) return
  background[i] = 1
  stack.push(i)
}
for (let x = 0; x < width; x += 1) { push(x, 0); push(x, height - 1) }
for (let y = 0; y < height; y += 1) { push(0, y); push(width - 1, y) }

while (stack.length) {
  const i = stack.pop()
  const x = i % width
  const y = (i / width) | 0
  push(x - 1, y); push(x + 1, y); push(x, y - 1); push(x, y + 1)
}

let removed = 0
for (let i = 0; i < width * height; i += 1) {
  if (background[i]) { rgba[i * 4 + 3] = 0; removed += 1 }
}

/* Adoucissement du contour : les pixels opaques voisins du fond
   deviennent partiellement transparents selon leur blancheur. */
const FEATHER = 45
let feathered = 0
for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const i = y * width + x
    if (background[i]) continue
    const near =
      (x > 0 && background[i - 1]) ||
      (x < width - 1 && background[i + 1]) ||
      (y > 0 && background[i - width]) ||
      (y < height - 1 && background[i + width])
    if (!near) continue
    const o = i * 4
    const m = Math.min(rgba[o], rgba[o + 1], rgba[o + 2])
    const alpha = Math.max(0, Math.min(255, Math.round(((255 - m) * 255) / FEATHER)))
    if (alpha < rgba[o + 3]) { rgba[o + 3] = alpha; feathered += 1 }
  }
}

writeFileSync(DST, encodePNG(width, height, rgba))

const pct = ((removed / (width * height)) * 100).toFixed(1)
console.log(`Fond supprimé : ${removed} pixels (${pct} %), contour adouci : ${feathered} pixels`)
console.log(`→ ${DST}`)

/* ─────────────────────────────────────────────────────────────────────
   Versions WebP : bien plus légères que le PNG (≈ 7× ici), ce qui compte
   pour le logo de l'en-tête, affiché dès l'arrivée sur le site.
   Nécessite l'outil `cwebp` (libwebp). S'il est absent, on prévient
   sans faire échouer le script.
   ───────────────────────────────────────────────────────────────────── */
const WEBP = [
  { file: 'logo.webp', width: 463, height: 418, usage: 'section de contact' },
  { file: 'logo-sm.webp', width: 160, height: 144, usage: 'en-tête et pied de page' },
]

let hasCwebp = true
try {
  execFileSync('cwebp', ['-version'], { stdio: 'ignore' })
} catch {
  hasCwebp = false
}

if (!hasCwebp) {
  console.log('⚠️  `cwebp` introuvable : versions WebP non générées.')
  console.log('   Installez libwebp (brew install webp) puis relancez ce script.')
} else {
  for (const { file, width: w, height: h, usage } of WEBP) {
    const out = join(dirname(DST), file)
    execFileSync('cwebp', ['-quiet', '-q', '88', '-alpha_q', '95', '-resize', String(w), String(h), DST, '-o', out])
    const ko = (readFileSync(out).length / 1024).toFixed(0)
    console.log(`→ ${out} (${w}×${h}, ${ko} Ko) — ${usage}`)
  }
}
