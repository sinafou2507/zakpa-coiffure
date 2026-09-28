/**
 * Génère l'image de partage (Open Graph) en PNG : 1200 × 630.
 *
 * C'est l'image affichée quand on partage le lien du site sur WhatsApp,
 * Facebook, Instagram, LinkedIn… Ces plateformes ne lisent PAS le SVG :
 * il faut un PNG ou un JPG.
 *
 * Méthode : on compose un SVG carré (1200 × 1200) contenant le logo, on le
 * fait rastériser par Quick Look, puis on recadre au bon format avec sips.
 * Le passage par un carré évite le rognage intempestif de Quick Look.
 *
 * Usage :  node tools/gen-og.mjs
 */
import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LOGO = join(ROOT, 'assets/img/logo.png')
const OUT = join(ROOT, 'assets/img/og-image.jpg')
const TMP = process.env.TMPDIR || '/tmp'

const SERIF = "Georgia,'Times New Roman',serif"
const SANS = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

const W = 1200
const H = 630
const CANVAS = 1200          // canevas carré de rendu
const OFFSET = (CANVAS - H) / 2   // décalage vertical : centre la bande 1200×630

const logo = readFileSync(LOGO).toString('base64')

/* Logo : 272 px de large, ratio conservé (463 × 418) */
const logoW = 272
const logoH = Math.round((logoW * 418) / 463)
const logoY = Math.round(180 + OFFSET + (272 - logoH) / 2)

const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     viewBox="0 0 ${CANVAS} ${CANVAS}" width="${CANVAS}" height="${CANVAS}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#17171c"/><stop offset="1" stop-color="#0a0a0c"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f7e7ad"/><stop offset=".5" stop-color="#d4af37"/><stop offset="1" stop-color="#a67c1a"/>
    </linearGradient>
    <radialGradient id="glow" cx="24%" cy="48%" r="56%">
      <stop offset="0" stop-color="#d4af37" stop-opacity=".22"/>
      <stop offset="1" stop-color="#d4af37" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${CANVAS}" height="${CANVAS}" fill="url(#bg)"/>
  <rect width="${CANVAS}" height="${CANVAS}" fill="url(#glow)"/>

  <image x="96" y="${logoY}" width="${logoW}" height="${logoH}"
         xlink:href="data:image/png;base64,${logo}"/>

  <text x="430" y="${286 + OFFSET}" font-family="${SERIF}" font-size="74"
        fill="#f4f1ea" letter-spacing="1">ZAKPA COIFFURE</text>
  <text x="432" y="${344 + OFFSET}" font-family="${SANS}" font-size="24"
        fill="#c9a227" letter-spacing="4">COIFFURE · SOINS VISAGE · TATOUAGE</text>
  <text x="432" y="${404 + OFFSET}" font-family="${SANS}" font-size="25"
        fill="#9d9a93">Yopougon Ananeraie · Abidjan, Côte d'Ivoire</text>

  <rect x="432" y="${448 + OFFSET}" width="316" height="64" rx="32" fill="url(#gold)"/>
  <text x="590" y="${488 + OFFSET}" text-anchor="middle" font-family="${SANS}"
        font-size="23" font-weight="600" fill="#17130a">Rendez-vous sur WhatsApp</text>
</svg>
`

const tmpSvg = join(TMP, 'zakpa-og.svg')
writeFileSync(tmpSvg, svg, 'utf8')

/* Rastérisation par Quick Look (macOS) */
execFileSync('qlmanage', ['-t', '-s', String(CANVAS), '-o', TMP, tmpSvg], { stdio: 'ignore' })
const tmpPng = tmpSvg + '.png'
if (!existsSync(tmpPng)) throw new Error('Échec du rendu : ' + tmpPng)

/* Recadrage centré au format 1200 × 630, puis compression JPEG
   (le JPEG pèse ~8 fois moins que le PNG pour ce type d'image). */
const tmpCrop = join(TMP, 'zakpa-og-crop.png')
execFileSync('sips', ['-c', String(H), String(W), tmpPng, '--out', tmpCrop], { stdio: 'ignore' })
execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '84', tmpCrop, '--out', OUT], { stdio: 'ignore' })

for (const f of [tmpSvg, tmpPng, tmpCrop]) rmSync(f, { force: true })

console.log(`✅ Image de partage générée : ${OUT} (${W} × ${H})`)
