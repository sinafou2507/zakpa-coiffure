/**
 * Gestion de la galerie « Réalisations ».
 *
 * Principe : le salon ne touche jamais au code. Il dépose ses fichiers dans
 * les bons dossiers, puis lance cette commande. Le script réécrit tout seul
 * la section galerie de index.html.
 *
 *   assets/photos/<catégorie>/ma-photo.jpg     → photo
 *   assets/videos/<catégorie>/mon-reel.mp4     → vidéo
 *   assets/videos/<catégorie>/mon-reel.jpg     → image d'aperçu de la vidéo
 *
 * Catégories disponibles :
 *   coupe-dame · coiffure-homme · locks-tresses
 *   soins-visage · tatouage · faux-ongles
 *
 * Le titre affiché est déduit du nom du fichier :
 *   coupe-brushing.jpg  →  « Coupe brushing »
 *   motif-personnalise.jpg  →  « Motif personnalisé »
 *
 * Usage :
 *   node tools/galerie.mjs              réécrit index.html
 *   node tools/galerie.mjs --apercu     affiche le résultat sans rien écrire
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, copyFileSync } from 'node:fs'
import { join, dirname, extname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const INDEX = join(ROOT, 'index.html')
const DRY = process.argv.includes('--apercu')

const DEBUT = '<!-- GALERIE:DEBUT -->'
const FIN = '<!-- GALERIE:FIN -->'

const CATEGORIES = [
  { dossier: 'coupe-dame',     cat: 'dame',     label: 'Coupe dame' },
  { dossier: 'coiffure-homme', cat: 'homme',    label: 'Coiffure homme' },
  { dossier: 'locks-tresses',  cat: 'locks',    label: 'Locks & tresses' },
  { dossier: 'soins-visage',   cat: 'visage',   label: 'Soins du visage' },
  { dossier: 'tatouage',       cat: 'tatouage', label: 'Tatouage' },
  { dossier: 'faux-ongles',    cat: 'ongles',   label: 'Faux ongles' },
]

const IMAGES = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.svg']
const VIDEOS = ['.mp4', '.webm', '.mov', '.m4v']

/* Petits mots à accentuer : le nom de fichier reste en ASCII (plus sûr dans
   une URL), l'affichage reçoit la bonne orthographe. Ajoutez vos mots ici. */
const ACCENTS = {
  degrade: 'dégradé', degradee: 'dégradée', collees: 'collées', collee: 'collée',
  personnalise: 'personnalisé', personnalisee: 'personnalisée', seance: 'séance',
  meche: 'mèche', meches: 'mèches', epaule: 'épaule', epaules: 'épaules',
  frange: 'frange', chignon: 'chignon', soin: 'soin', gel: 'gel',
  vernis: 'vernis', ongles: 'ongles', homme: 'homme', dame: 'dame',
  enfants: 'enfants', africaine: 'africaine', africaines: 'africaines',
  boucle: 'bouclé', boucles: 'bouclés', lisse: 'lissé', lissage: 'lissage',
  eclat: 'éclat', doree: 'dorée', dorees: 'dorées',
}

const ext = (f) => extname(f).toLowerCase()

/* ───────────── Titre lisible à partir du nom de fichier ───────────── */
function titre(fichier) {
  return basename(fichier, extname(fichier))
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((mot) => ACCENTS[mot.toLowerCase()] ?? mot)
    .map((mot, i) => (i === 0 ? mot.charAt(0).toUpperCase() + mot.slice(1) : mot))
    .join(' ')
}

/* ───────────── Dimensions réelles du fichier ───────────── */
function dimensions(chemin) {
  let buf
  try {
    buf = readFileSync(chemin)
  } catch {
    return null
  }

  // PNG : largeur en 16, hauteur en 20
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
  }

  // JPEG : on parcourt les segments jusqu'au marqueur SOF
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let p = 2
    while (p + 9 < buf.length) {
      if (buf[p] !== 0xff) { p += 1; continue }
      const marqueur = buf[p + 1]
      if (marqueur >= 0xc0 && marqueur <= 0xcf && marqueur !== 0xc4 && marqueur !== 0xc8 && marqueur !== 0xcc) {
        return { w: buf.readUInt16BE(p + 7), h: buf.readUInt16BE(p + 5) }
      }
      p += 2 + buf.readUInt16BE(p + 2)
    }
  }

  // WebP (VP8X puis VP8)
  if (buf.length > 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const type = buf.toString('ascii', 12, 16)
    if (type === 'VP8X') {
      const w = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16))
      const h = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16))
      return { w, h }
    }
    if (type === 'VP8 ') {
      const w = buf.readUInt16LE(26) & 0x3fff
      const h = buf.readUInt16LE(28) & 0x3fff
      if (w && h) return { w, h }
    }
  }

  // SVG : attributs width/height, sinon viewBox
  if (ext(chemin) === '.svg') {
    const s = buf.toString('utf8', 0, 600)
    const w = s.match(/\bwidth="(\d+(?:\.\d+)?)/)
    const h = s.match(/\bheight="(\d+(?:\.\d+)?)/)
    if (w && h) return { w: parseFloat(w[1]), h: parseFloat(h[1]) }
    const vb = s.match(/viewBox="[\d.\s-]*?([\d.]+)\s+([\d.]+)"/)
    if (vb) return { w: parseFloat(vb[1]), h: parseFloat(vb[2]) }
  }

  return null
}

/* ───────────── Choix du format de vignette ───────────── */
const FORMATS = [
  { classe: 'ratio-32',  ratio: 3 / 2 },
  { classe: 'ratio-11',  ratio: 1 },
  { classe: 'ratio-45',  ratio: 4 / 5 },
  { classe: 'ratio-34',  ratio: 3 / 4 },
  { classe: 'ratio-916', ratio: 9 / 16 },
]

function format(dim) {
  if (!dim || !dim.w || !dim.h) return 'ratio-45'
  const cible = Math.log(dim.w / dim.h)
  let meilleur = FORMATS[0]
  let ecart = Infinity
  for (const f of FORMATS) {
    const d = Math.abs(Math.log(f.ratio) - cible)
    if (d < ecart) { ecart = d; meilleur = f }
  }
  return meilleur.classe
}

/* ───────────── Construction du HTML ───────────── */
const echapper = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

/* Noms de fichiers « d'appareil » (WhatsApp, IMG_1234, DSC…) : on affiche
   plutôt le nom de la catégorie, plus présentable. */
const NOM_AUTO = /^(whatsapp|img|dsc|pxl|photo|image|screenshot|capture|vid|video)[\s\d-]|^\d/i
function legende(chemin, cat) {
  const t = titre(chemin)
  if (!NOM_AUTO.test(t)) return t
  return CATEGORIES.find((c) => c.cat === cat)?.label ?? 'Réalisation'
}

function blocPhoto(cheminRel, dim, cat) {
  const nom = legende(cheminRel, cat)
  const format_ = format(dim)
  const w = dim?.w ?? 800
  const h = dim?.h ?? 1000
  return `      <button class="gallery__item ${format_}" data-cat="${cat}" data-type="image" aria-label="Agrandir : ${echapper(nom)}">
        <img src="${cheminRel}" width="${Math.round(w)}" height="${Math.round(h)}" loading="lazy" decoding="async" alt="${echapper(nom)} — réalisation du salon">
        <span class="gallery__cap">${echapper(nom)}</span>
        <span class="gallery__zoom" aria-hidden="true"><svg><use href="#i-zoom"/></svg></span>
      </button>`
}

function blocVideo(cheminVideo, cheminPoster, dim, cat) {
  const nom = legende(cheminPoster ?? cheminVideo, cat)
  const format_ = format(dim)
  const poster = cheminPoster ? ` data-poster="${cheminPoster}"` : ''
  const apercu = cheminPoster
    ? `\n        <img src="${cheminPoster}" width="${Math.round(dim?.w ?? 800)}" height="${Math.round(dim?.h ?? 1000)}" loading="lazy" decoding="async" alt="Vidéo : ${echapper(nom)}">`
    : `\n        <video src="${cheminVideo}#t=0.1" muted playsinline preload="metadata"></video>`
  return `      <button class="gallery__item ${format_}" data-cat="${cat}" data-type="video"${poster} data-video="${cheminVideo}" aria-label="Lire la vidéo : ${echapper(nom)}">${apercu}
        <span class="gallery__cap">Vidéo · ${echapper(nom)}</span>
        <span class="gallery__play" aria-hidden="true"><svg><use href="#i-play"/></svg></span>
      </button>`
}

/* ───────────── Dossiers ───────────── */
const MODELE = (dossier, genre) => `DOSSIER « ${dossier} »
${'='.repeat(30)}

Déposez ici vos ${genre}, puis lancez à la racine du projet :

    node tools/galerie.mjs

Le site se met à jour tout seul : inutile de toucher au code.

FORMATS CONSEILLÉS
------------------
· Photos  : JPEG ou WebP, largeur 1000 à 1400 px, moins de 300 Ko
· Vidéos  : MP4 (H.264), format vertical 1080 × 1920, moins de 10 Mo
· Nommez vos fichiers avec des mots simples, séparés par des tirets :
  « tresses-collees.jpg » s'affichera « Tresses collées ».

Pour retirer une ${genre.slice(0, -1)}, supprimez le fichier d'ici et
relancez la commande.
`

function preparerDossiers() {
  for (const c of CATEGORIES) {
    const dp = join(ROOT, 'assets/photos', c.dossier)
    const dv = join(ROOT, 'assets/videos', c.dossier)
    if (!existsSync(dp)) { mkdirSync(dp, { recursive: true }); writeFileSync(join(dp, 'LISEZ-MOI.txt'), MODELE(c.dossier, 'photos'), 'utf8') }
    if (!existsSync(dv)) { mkdirSync(dv, { recursive: true }); writeFileSync(join(dv, 'LISEZ-MOI.txt'), MODELE(c.dossier, 'vidéos'), 'utf8') }
  }
}

const lister = (dossier) =>
  existsSync(dossier)
    ? readdirSync(dossier).filter((f) => !f.startsWith('.') && !f.endsWith('.txt') && !f.startsWith('LISEZ')).sort()
    : []

/* ───────────── Programme principal ───────────── */
if (!DRY) preparerDossiers()

const blocs = []
let nbPhotos = 0
let nbVideos = 0
const avertissements = []

for (const c of CATEGORIES) {
  const dossierPhotos = join(ROOT, 'assets/photos', c.dossier)
  const dossierVideos = join(ROOT, 'assets/videos', c.dossier)

  for (const f of lister(dossierPhotos)) {
    if (!IMAGES.includes(ext(f))) { avertissements.push(`ignoré (format non géré) : assets/photos/${c.dossier}/${f}`); continue }
    const rel = `assets/photos/${c.dossier}/${f}`
    blocs.push(blocPhoto(rel, dimensions(join(dossierPhotos, f)), c.cat))
    nbPhotos += 1
  }

  const fichiers = lister(dossierVideos)
  const videos = fichiers.filter((f) => VIDEOS.includes(ext(f)))
  const apercus = fichiers.filter((f) => IMAGES.includes(ext(f)))

  for (const v of videos) {
    const base = basename(v, extname(v))
    const poster = apercus.find((a) => basename(a, extname(a)) === base)
    blocs.push(blocVideo(
      `assets/videos/${c.dossier}/${v}`,
      poster ? `assets/videos/${c.dossier}/${poster}` : null,
      dimensions(join(dossierVideos, poster ?? v)),
      c.cat
    ))
    nbVideos += 1
  }

  // Une image seule dans le dossier vidéos = aperçu d'une vidéo pas encore
  // fournie : le site affiche la vignette et signale l'emplacement manquant.
  for (const a of apercus) {
    const base = basename(a, extname(a))
    if (videos.some((v) => basename(v, extname(v)) === base)) continue
    blocs.push(blocVideo(
      `assets/videos/${c.dossier}/${base}.mp4`,
      `assets/videos/${c.dossier}/${a}`,
      dimensions(join(dossierVideos, a)),
      c.cat
    ))
    nbVideos += 1
  }
}

console.log(`\nPhotos trouvées : ${nbPhotos}`)
console.log(`Vidéos trouvées : ${nbVideos}`)
if (avertissements.length) {
  console.log('\nAvertissements :')
  avertissements.forEach((a) => console.log('  · ' + a))
}

if (blocs.length === 0) {
  console.log('\nℹ️  Aucun fichier déposé : la galerie de index.html est laissée telle quelle')
  console.log('   (les visuels gris de remplacement restent affichés).')
  console.log('\n   Déposez vos photos dans  assets/photos/<catégorie>/')
  console.log('   puis relancez :  node tools/galerie.mjs\n')
  process.exit(0)
}

const html = readFileSync(INDEX, 'utf8')
const i = html.indexOf(DEBUT)
const j = html.indexOf(FIN)
if (i === -1 || j === -1) {
  console.error(`\n❌ Repères introuvables dans index.html (${DEBUT} … ${FIN}).`)
  process.exit(1)
}

const nouveau = html.slice(0, i + DEBUT.length) + '\n' + blocs.join('\n\n') + '\n      ' + html.slice(j)

if (DRY) {
  console.log('\n--- Aperçu du HTML généré ---\n')
  console.log(blocs.join('\n\n'))
  console.log('\n(rien n’a été écrit : mode --apercu)\n')
} else {
  copyFileSync(INDEX, INDEX + '.bak')
  writeFileSync(INDEX, nouveau, 'utf8')
  console.log(`\n✅ Galerie mise à jour dans index.html (sauvegarde : index.html.bak)`)
  console.log(`   ${nbPhotos} photo(s) et ${nbVideos} vidéo(s) affichées.\n`)
}
