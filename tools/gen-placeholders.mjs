/**
 * Générateur de visuels de remplacement (placeholders) pour le site du salon.
 *
 * Produit des fichiers SVG sobres et élégants (noir profond + or) afin que le
 * site soit présentable AVANT que le salon ne fournisse ses vraies photos.
 *
 * Usage :  node tools/gen-placeholders.mjs
 * Les fichiers sont écrits dans assets/img/
 *
 * ⚠️  Pour la production : remplacez ces fichiers par de vraies photos
 *     (gardez les mêmes noms de fichier, ou mettez à jour assets/js/data.js).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'assets', 'img')
mkdirSync(OUT, { recursive: true })

const SERIF = "Georgia,'Times New Roman',serif"
const SANS = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

/* Échappe les caractères réservés du XML : sans cela, un « & » dans un libellé
   (ex. « Locks & tresses ») rend le SVG invalide et le navigateur ne l'affiche
   pas. */
const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/* ------------------------------------------------------------------ */
/* Icônes dessinées dans un repère 100 x 100, centré sur (50, 50)      */
/* ------------------------------------------------------------------ */
const ICONS = {
  // Coupe dame : boucle / spirale
  curl: `<path d="M50 18c22 0 34 16 34 32 0 18-14 30-28 30-13 0-22-9-22-20 0-10 8-17 17-17 8 0 13 5 13 11"
    fill="none" stroke-width="3.2" stroke-linecap="round"/>`,
  // Coiffure homme : peigne
  comb: `<rect x="16" y="34" width="68" height="13" rx="5" fill="CUR"/>
    <g stroke="CUR" stroke-width="4" stroke-linecap="round">
      <line x1="24" y1="47" x2="24" y2="72"/><line x1="33" y1="47" x2="33" y2="72"/>
      <line x1="42" y1="47" x2="42" y2="72"/><line x1="51" y1="47" x2="51" y2="72"/>
      <line x1="60" y1="47" x2="60" y2="72"/><line x1="69" y1="47" x2="69" y2="72"/>
      <line x1="77" y1="47" x2="77" y2="72"/>
    </g>`,
  // Locks / tresses : mèches ondulées
  locks: `<g fill="none" stroke-width="3.2" stroke-linecap="round">
      <path d="M28 16c13 13-13 25 0 38s-13 25 0 38"/>
      <path d="M50 16c13 13-13 25 0 38s-13 25 0 38"/>
      <path d="M72 16c13 13-13 25 0 38s-13 25 0 38"/>
    </g>`,
  // Soins du visage : visage souriant
  face: `<circle cx="50" cy="50" r="34" fill="none" stroke="CUR" stroke-width="3.2"/>
    <circle cx="38" cy="43" r="3.4" fill="CUR"/><circle cx="62" cy="43" r="3.4" fill="CUR"/>
    <path d="M36 62c7.5 6.5 20.5 6.5 28 0" fill="none" stroke="CUR" stroke-width="3.2" stroke-linecap="round"/>`,
  // Tatouage : goutte d'encre
  tattoo: `<path d="M50 16C50 16 78 48 78 63A28 28 0 0 1 22 63C22 48 50 16 50 16Z" fill="CUR"/>
    <path d="M38 62a12 12 0 0 0 10 12" fill="none" stroke="#0b0b0d" stroke-width="3" stroke-linecap="round" opacity=".35"/>`,
  // Faux ongles : ongle
  nails: `<path d="M50 14c15 0 23 15 23 36 0 24-10 36-23 36S27 74 27 50c0-21 8-36 23-36Z" fill="CUR"/>
    <path d="M40 30c-4 8-5 16-4 26" fill="none" stroke="#0b0b0d" stroke-width="3.4" stroke-linecap="round" opacity=".3"/>`,
  // Équipe : buste
  person: `<circle cx="50" cy="35" r="16" fill="CUR"/>
    <path d="M19 86c0-19 14-29 31-29s31 10 31 29" fill="CUR"/>`,
  // Vidéo : lecture
  play: `<circle cx="50" cy="50" r="30" fill="none" stroke="CUR" stroke-width="2.6"/>
    <path d="M43 36 67 50 43 64Z" fill="CUR"/>`,
  // Ciseaux (générique / hero)
  scissors: `<g fill="none" stroke="CUR" stroke-width="3.2" stroke-linecap="round">
      <path d="M26 18 66 62M74 18 34 62"/>
      <circle cx="28" cy="74" r="9"/><circle cx="72" cy="74" r="9"/>
    </g>`,
}

/* ------------------------------------------------------------------ */
/* Palettes (dégradés) : variations subtiles pour éviter la monotonie  */
/* ------------------------------------------------------------------ */
const TONES = [
  { a: '#17171c', b: '#0a0a0c', c: '#e0c164' }, // or
  { a: '#1b1a17', b: '#0b0b0c', c: '#d8a866' }, // cuivre
  { a: '#15181a', b: '#090a0b', c: '#cbb98a' }, // champagne
  { a: '#1a1618', b: '#0b0a0b', c: '#e6cf8f' }, // or clair
]

/**
 * Construit un SVG de remplacement.
 */
function placeholder({ w, h, label, sub, icon = 'curl', tone = 0, monogram, vignette = true }) {
  const t = TONES[tone % TONES.length]
  const cx = w / 2
  const cy = vignette ? h * 0.44 : h / 2
  const scale = Math.min(w, h) * 0.16
  const glyph = ICONS[icon] ?? ICONS.curl
  const uid = Math.random().toString(36).slice(2, 8)

  const iconMarkup = monogram
    ? `<circle cx="${cx}" cy="${cy}" r="${scale * 1.15}" fill="none" stroke="${t.c}" stroke-width="2" opacity=".8"/>
       <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central"
             font-family="${SERIF}" font-size="${scale * 1.5}" fill="${t.c}">${esc(monogram)}</text>`
    : `<g transform="translate(${cx - scale}, ${cy - scale}) scale(${(scale * 2) / 100})"
          stroke="${t.c}" fill="none">${glyph.replaceAll('CUR', t.c)}</g>`

  const labelBlock = label
    ? `<g>
         <line x1="${cx - 22}" y1="${h - 74}" x2="${cx + 22}" y2="${h - 74}"
               stroke="${t.c}" stroke-width="1.4" opacity=".7"/>
         <text x="${cx}" y="${h - 48}" text-anchor="middle" font-family="${SERIF}"
               font-size="${Math.max(14, Math.min(w, h) * 0.052)}" fill="#f2efe9"
               letter-spacing=".5">${esc(label)}</text>
         ${sub ? `<text x="${cx}" y="${h - 24}" text-anchor="middle" font-family="${SANS}"
               font-size="${Math.max(9, Math.min(w, h) * 0.028)}" fill="#8f8d88"
               letter-spacing="2.4">${esc(sub)}</text>` : ''}
       </g>`
    : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(label ?? 'visuel de remplacement')}">
  <defs>
    <linearGradient id="bg${uid}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${t.a}"/><stop offset="1" stop-color="${t.b}"/>
    </linearGradient>
    <radialGradient id="gl${uid}" cx="50%" cy="${vignette ? 38 : 50}%" r="62%">
      <stop offset="0" stop-color="${t.c}" stop-opacity=".20"/>
      <stop offset="1" stop-color="${t.c}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="pt${uid}" width="26" height="26" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
      <line x1="0" y1="0" x2="0" y2="26" stroke="#ffffff" stroke-opacity=".022" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg${uid})"/>
  <rect width="${w}" height="${h}" fill="url(#pt${uid})"/>
  <rect width="${w}" height="${h}" fill="url(#gl${uid})"/>
  ${iconMarkup}
  ${labelBlock}
</svg>
`
}

/* ------------------------------------------------------------------ */
/* Étoile à 5 branches                                                 */
/* ------------------------------------------------------------------ */
function starPath(cx, cy, r, inner = 0.42) {
  const pts = []
  for (let i = 0; i < 10; i += 1) {
    const rad = i % 2 === 0 ? r : r * inner
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    pts.push(`${(cx + Math.cos(a) * rad).toFixed(2)},${(cy + Math.sin(a) * rad).toFixed(2)}`)
  }
  return 'M' + pts.join('L') + 'Z'
}

/* ------------------------------------------------------------------ */
/* Emblème — reconstitution inspirée du logo du salon                  */
/* Badge rond bordeaux cerclé d'or, couronne, ciseaux + peigne croisés */
/* et ruban doré « ZAKPA COIFFURE ».                                   */
/* ------------------------------------------------------------------ */
function emblemDefs() {
  return `<linearGradient id="goldG" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f7e7ad"/><stop offset=".5" stop-color="#d4af37"/><stop offset="1" stop-color="#a67c1a"/>
    </linearGradient>
    <radialGradient id="redG" cx="42%" cy="32%" r="74%">
      <stop offset="0" stop-color="#9c1f21"/><stop offset="1" stop-color="#4a0a0c"/>
    </radialGradient>`
}

function emblemInner({ banner = true } = {}) {
  const crownY = banner ? 42 : 66
  const crownScale = banner ? 0.98 : 1.15
  const toolsY = banner ? 106 : 126
  const toolsScale = banner ? 1 : 1.22

  const beads = Array.from({ length: 48 }, (_, i) => {
    const a = (i / 48) * Math.PI * 2
    return `<circle cx="${(100 + Math.cos(a) * 92).toFixed(1)}" cy="${(100 + Math.sin(a) * 92).toFixed(1)}" r="1.5" fill="#f7e7ad" opacity=".85"/>`
  }).join('')

  // Ciseaux dessinés deux fois : un halo sombre d'abord, puis l'or par-dessus.
  // Cela les détache nettement du peigne là où les deux outils se croisent.
  const scissorShape = `
      <path d="M-5.5 -48 L3 2"/><path d="M5.5 -48 L-3 2"/>
      <circle cx="-6" cy="16" r="7.2"/><circle cx="6" cy="16" r="7.2"/>`

  const tools = `
    <g transform="translate(100,${toolsY}) scale(${toolsScale})" fill="none" stroke-linecap="round">
      <g transform="rotate(32)">
        <rect x="-8.5" y="-52" width="17" height="10" rx="3.4" fill="#e3c46c" stroke="none"/>
        <path d="M-5.5 -42 V2 M-1.8 -42 V2 M1.8 -42 V2 M5.5 -42 V2"
              stroke="#e3c46c" stroke-width="2.8"/>
      </g>
      <g transform="rotate(-32)">
        <g stroke="#4a0a0c" stroke-width="8.4">${scissorShape}</g>
        <g stroke="#f7e7ad" stroke-width="4.2">${scissorShape}</g>
      </g>
    </g>`

  const ribbon = banner
    ? `<path d="M-60 -13 H60 L51 0 L60 13 H-60 L-51 0 Z" fill="url(#goldG)" stroke="#8a6212" stroke-width="1"/>
       <text x="0" y="0" text-anchor="middle" dominant-baseline="central"
             font-family="${SERIF}" font-size="11.5" font-weight="700" fill="#5c0d0f"
             textLength="98" lengthAdjust="spacingAndGlyphs">ZAKPA COIFFURE</text>`
    : ''

  return `<circle cx="100" cy="100" r="97" fill="url(#goldG)"/>
  <circle cx="100" cy="100" r="90" fill="url(#redG)"/>
  <circle cx="100" cy="100" r="85" fill="none" stroke="url(#goldG)" stroke-width="2.2"/>
  ${beads}
  <g transform="translate(100,${crownY}) scale(${crownScale})">
    <path d="M-28 12 L-28 -8 L-14 -2 L0 -22 L14 -2 L28 -8 L28 12 Z"
          fill="url(#goldG)" stroke="#8a6212" stroke-width="1.2" stroke-linejoin="round"/>
    <circle cx="-28" cy="-9" r="2.7" fill="#f7e7ad"/>
    <circle cx="0" cy="-23" r="2.7" fill="#f7e7ad"/>
    <circle cx="28" cy="-9" r="2.7" fill="#f7e7ad"/>
  </g>
  ${tools}
  ${banner ? `<path d="${starPath(52, 120, 5)}" fill="#f7e7ad" opacity=".9"/>` : ''}
  ${banner ? `<path d="${starPath(148, 120, 5)}" fill="#f7e7ad" opacity=".9"/>` : ''}
  ${banner ? `<g transform="translate(100,152)">${ribbon}</g>` : ''}`
}

/* Emblème complet, prêt à être enregistré en fichier .svg */
function emblem(opts = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200" role="img" aria-label="Logo ZAKPA COIFFURE">
  <defs>${emblemDefs()}</defs>
  ${emblemInner(opts)}
</svg>
`
}

/* ------------------------------------------------------------------ */
/* Liste des fichiers à produire                                       */
/* ------------------------------------------------------------------ */
const files = []

// --- Hero -----------------------------------------------------------
files.push(['hero-portrait.svg', placeholder({
  w: 900, h: 1200, icon: 'scissors', tone: 0, monogram: 'Z', sub: 'PHOTO PRINCIPALE',
})])
files.push(['hero-square.svg', placeholder({
  w: 900, h: 900, icon: 'curl', tone: 3, label: 'Savoir-faire', sub: 'PHOTO SECONDAIRE',
})])

// --- À propos -------------------------------------------------------
files.push(['about.svg', placeholder({
  w: 1000, h: 750, icon: 'person', tone: 1, label: 'Le salon', sub: 'PHOTO DU SALON',
})])

// --- Équipe ---------------------------------------------------------
;['Fondateur', 'Coiffeur homme', 'Locks & tresses', 'Visage & tatouage'].forEach((role, i) => {
  files.push([`team-${i + 1}.svg`, placeholder({
    w: 600, h: 700, icon: 'person', tone: i + 1, label: role, sub: 'PORTRAIT',
  })])
})

// --- Réalisations (photos) -----------------------------------------
const GALLERY = [
  ['gal-coupe-dame-1', 'Coupe dame', 'curl', 0],
  ['gal-coupe-dame-2', 'Coupe + brushing', 'curl', 3],
  ['gal-coupe-dame-3', 'Coloration', 'curl', 2],
  ['gal-homme-1', 'Dégradé', 'comb', 1],
  ['gal-homme-2', 'Coupe + barbe', 'comb', 0],
  ['gal-homme-3', 'Coupe classique', 'comb', 2],
  ['gal-locks-1', 'Locks', 'locks', 3],
  ['gal-locks-2', 'Tresses collées', 'locks', 0],
  ['gal-locks-3', 'Nattes', 'locks', 1],
  ['gal-visage-1', 'Soin du visage', 'face', 2],
  ['gal-visage-2', 'Peau clean', 'face', 3],
  ['gal-tatouage-1', 'Tatouage', 'tattoo', 2],
  ['gal-tatouage-2', 'Tatouage', 'tattoo', 3],
  ['gal-ongles-1', 'Faux ongles', 'nails', 0],
  ['gal-ongles-2', 'Nail art', 'nails', 1],
]
for (const [name, label, icon, tone] of GALLERY) {
  files.push([`${name}.svg`, placeholder({
    w: 800, h: 1000, icon, tone, label, sub: 'VOTRE PHOTO ICI',
  })])
}

// --- Réalisations (posters vidéo) ----------------------------------
;['Reel — tresses', 'Reel — brushing', 'Reel — tatouage'].forEach((label, i) => {
  files.push([`poster-video-${i + 1}.svg`, placeholder({
    w: 800, h: 1000, icon: 'play', tone: i, label, sub: 'POSTER VIDÉO',
  })])
})

// --- Réseaux sociaux / partage -------------------------------------
// L'image de partage est produite séparément, en PNG/JPG, par
// `node tools/gen-og.mjs` (les réseaux sociaux ne lisent pas le SVG).

// --- Favicon --------------------------------------------------------
// Version simplifiée de l'emblème : le vrai logo (logo.png) est trop
// détaillé pour rester lisible à 16 px dans un onglet de navigateur.
files.push(['favicon.svg', emblem({ banner: false })])

/* ------------------------------------------------------------------ */
for (const [name, content] of files) {
  writeFileSync(join(OUT, name), content, 'utf8')
}

console.log(`✅ ${files.length} visuels générés dans assets/img/`)
