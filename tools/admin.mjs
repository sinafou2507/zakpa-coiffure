#!/usr/bin/env node
/**
 * Back office local — ZAKPA COIFFURE
 * ============================================================================
 *
 * Petit serveur web qui tourne UNIQUEMENT sur cet ordinateur (aucune donnée ne
 * part sur Internet) et qui permet de gérer les photos et vidéos du site
 * depuis une page dans le navigateur, sans ligne de commande :
 *
 *   · glisser-déposer des photos / vidéos dans la bonne catégorie
 *   · optimiser les images (redimensionnement automatique via « sips »)
 *   · convertir les photos iPhone (.heic) en JPEG
 *   · générer l'image d'aperçu des vidéos
 *   · lister, renommer et supprimer les fichiers déjà en place
 *   · mettre le site à jour en un clic (lance tools/galerie.mjs)
 *
 * Usage :
 *   node tools/admin.mjs                 ouvre le back office dans le navigateur
 *   node tools/admin.mjs --no-open       ne pas ouvrir le navigateur
 *   node tools/admin.mjs --port 5000     choisir le port
 *
 * Le lancement se fait normalement par double-clic sur
 * « Back office.command » à la racine du projet.
 */
import { createServer } from 'node:http'
import {
  readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync,
  statSync, unlinkSync, createWriteStream, copyFileSync, renameSync, rmSync,
} from 'node:fs'
import { join, dirname, extname, basename, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile, spawn } from 'node:child_process'
import { pipeline } from 'node:stream/promises'
import {
  CATEGORIES, SITE_SLOTS, nettoyerNom as nettoyerNomBase, majImage, lireEquipe as lireEquipeHtml,
  ecrireEquipe as ecrireEquipeHtml, lireAvis as lireAvisHtml, lireLienGoogle as lireLienGoogleHtml,
  ecrireAvis as ecrireAvisHtml, avisPropres, equipePropre,
} from './contenu.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const GALERIE = join(ROOT, 'tools', 'galerie.mjs')
const PLACEHOLDERS = join(ROOT, 'tools', 'gen-placeholders.mjs')
const PUBLIER = join(ROOT, 'tools', 'publier.mjs')
const DOSSIER_PUBLIC = join(ROOT, 'public')
const DOMAINE_FICHIER = join(ROOT, 'tools', 'domaine.txt')
const INDEX = join(ROOT, 'index.html')
const PAGE = join(ROOT, 'tools', 'admin.html')
const IMG = join(ROOT, 'assets', 'img')
const SUR_MAC = process.platform === 'darwin'

const DOSSIERS = new Set(CATEGORIES.map((c) => c.dossier))

const IMAGES = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.svg']
const VIDEOS = ['.mp4', '.webm', '.mov', '.m4v']
const HEIC = ['.heic', '.heif']
const TAILLE_MAX = 250 * 1024 * 1024 // 250 Mo, garde-fou

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.mov': 'video/quicktime', '.m4v': 'video/x-m4v',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
  '.woff2': 'font/woff2',
}

const ext = (f) => extname(f).toLowerCase()
const estImage = (f) => IMAGES.includes(ext(f))
const estVideo = (f) => VIDEOS.includes(ext(f))

/* ─────────────────────────── Utilitaires ─────────────────────────── */

function dossierDe(dossier, genre) {
  if (!DOSSIERS.has(dossier)) throw new Error('Catégorie inconnue')
  if (genre !== 'photos' && genre !== 'videos') throw new Error('Type inconnu')
  return join(ROOT, 'assets', genre, dossier)
}

function lister(dossier) {
  if (!existsSync(dossier)) return []
  return readdirSync(dossier)
    .filter((f) => !f.startsWith('.') && !f.endsWith('.txt') && !f.startsWith('LISEZ'))
    .sort()
}

const nettoyerNom = nettoyerNomBase

function nomUnique(dossier, nom) {
  if (!existsSync(join(dossier, nom))) return nom
  const e = ext(nom)
  const base = basename(nom, extname(nom))
  let n = 2
  while (existsSync(join(dossier, `${base}-${n}${e}`))) n += 1
  return `${base}-${n}${e}`
}

const estDans = (chemin, parent) => chemin === parent || chemin.startsWith(parent + sep)

function execFileP(commande, args, options = {}) {
  return new Promise((ok) => {
    execFile(commande, args, { maxBuffer: 20 * 1024 * 1024, ...options }, (err, stdout, stderr) => {
      ok({ err, stdout: stdout ?? '', stderr: stderr ?? '' })
    })
  })
}

/* ───────────── Photos fixes du site (accueil, le salon, équipe) ───────────── */

/* Fichier actuellement utilisé pour un emplacement (photo réelle ou SVG). */
function fichierSlot(id) {
  if (!existsSync(IMG)) return null
  const fichiers = readdirSync(IMG).filter((f) => basename(f, extname(f)) === id && IMAGES.includes(ext(f)))
  if (!fichiers.length) return null
  return fichiers.find((f) => ext(f) !== '.svg') ?? fichiers[0]
}

async function dimensionsSips(chemin) {
  const { err, stdout } = await execFileP('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', chemin])
  if (err) return null
  const w = /pixelWidth:\s*(\d+)/.exec(stdout)
  const h = /pixelHeight:\s*(\d+)/.exec(stdout)
  return w && h ? { w: Number(w[1]), h: Number(h[1]) } : null
}

/* Lecture / écriture d'index.html via les fonctions partagées (tools/contenu.mjs). */
const lireIndex = () => readFileSync(INDEX, 'utf8')
function ecrireIndex(html) {
  copyFileSync(INDEX, INDEX + '.bak')
  writeFileSync(INDEX, html, 'utf8')
}
const majIndexImage = (id, cheminRel, dims) => ecrireIndex(majImage(lireIndex(), id, cheminRel, dims))
const lireEquipe = () => lireEquipeHtml(lireIndex())
const lireAvis = () => lireAvisHtml(lireIndex())
const lireLienGoogle = () => lireLienGoogleHtml(lireIndex())
function ecrireEquipe(membres) {
  ecrireIndex(ecrireEquipeHtml(lireIndex(), membres))
  return membres.length
}
function ecrireAvis(avis, google) {
  ecrireIndex(ecrireAvisHtml(lireIndex(), avis, google))
  return avis.length
}

/* Optimise une image avec « sips » (fourni par macOS, aucune installation).
   - .heic / .heif → converti en JPEG (sinon le site ne l'affiche pas)
   - images trop grandes → redimensionnées (côté le plus long : 1400 px)
   Renvoie le nom de fichier final (l'extension peut changer). */
async function optimiserImage(dossier, nom, optimiser) {
  if (!SUR_MAC || !optimiser) {
    if (HEIC.includes(ext(nom))) {
      const nomJpg = basename(nom, extname(nom)) + '.jpg'
      const { err } = await execFileP('sips', ['-s', 'format', 'jpeg', '-Z', '1400', join(dossier, nom), '--out', join(dossier, nomJpg)])
      if (!err) { try { unlinkSync(join(dossier, nom)) } catch {} ; return { nom: nomJpg } }
      return { nom, avertissement: 'Photo iPhone (.heic) non convertie : le navigateur peut ne pas l’afficher.' }
    }
    return { nom }
  }

  const chemin = join(dossier, nom)
  const heic = HEIC.includes(ext(nom))

  if (heic) {
    const nomJpg = basename(nom, extname(nom)) + '.jpg'
    const { err, stderr } = await execFileP('sips', ['-s', 'format', 'jpeg', '-Z', '1400', chemin, '--out', join(dossier, nomJpg)])
    if (!err) { try { unlinkSync(chemin) } catch {} ; return { nom: nomJpg } }
    return { nom, avertissement: 'Conversion .heic impossible : ' + (stderr || 'erreur sips').trim() }
  }

  // Redimensionnement simple (dans le fichier lui-même).
  const { err } = await execFileP('sips', ['-Z', '1400', chemin])
  if (err) return { nom, avertissement: 'Redimensionnement ignoré (format non pris en charge par sips).' }
  return { nom }
}

/* ─────────────────────────── État de la galerie ─────────────────────────── */

function etat() {
  return {
    categories: CATEGORIES.map((c) => {
      const dp = join(ROOT, 'assets/photos', c.dossier)
      const dv = join(ROOT, 'assets/videos', c.dossier)
      const fichiersVideos = lister(dv)
      const apercus = fichiersVideos.filter((f) => estImage(f))

      const photos = lister(dp).map((nom) => ({
        nom,
        taille: taille(join(dp, nom)),
        url: `/assets/photos/${c.dossier}/${encodeURIComponent(nom)}`,
        gere: estImage(nom),
      }))
      const videos = fichiersVideos.filter((f) => estVideo(f)).map((nom) => {
        const base = basename(nom, extname(nom))
        const poster = apercus.find((a) => basename(a, extname(a)) === base)
        return {
          nom,
          taille: taille(join(dv, nom)),
          url: `/assets/videos/${c.dossier}/${encodeURIComponent(nom)}`,
          apercu: poster ? `/assets/videos/${c.dossier}/${encodeURIComponent(poster)}` : null,
        }
      })
      // Images seules dans le dossier vidéos = aperçus sans vidéo associée
      const orphelins = apercus
        .filter((a) => !videos.some((v) => basename(v.nom, extname(v.nom)) === basename(a, extname(a))))
        .map((nom) => ({
          nom,
          taille: taille(join(dv, nom)),
          url: `/assets/videos/${c.dossier}/${encodeURIComponent(nom)}`,
          apercu: null,
          apercuSeul: true,
        }))

      return { ...c, photos, videos: [...videos, ...orphelins] }
    }),
    site: SITE_SLOTS.map((s) => {
      const f = fichierSlot(s.id)
      return {
        id: s.id,
        label: s.label,
        nom: f,
        url: f ? `/assets/img/${encodeURIComponent(f)}` : null,
        parDefaut: !f || ext(f) === '.svg',
      }
    }),
    equipe: lireEquipe(),
    avis: lireAvis(),
    avisGoogle: lireLienGoogle(),
    sitePublic: (() => { try { return readFileSync(DOMAINE_FICHIER, 'utf8').trim() || null } catch { return null } })(),
  }
}

function taille(chemin) {
  try { return statSync(chemin).size } catch { return 0 }
}

/* ─────────────────────────── Corps de requête ─────────────────────────── */

function lireJSON(req, max = 1024 * 1024) {
  return new Promise((ok, ko) => {
    let data = ''
    req.on('data', (c) => { data += c; if (data.length > max) { ko(new Error('Trop volumineux')); req.destroy() } })
    req.on('end', () => { try { ok(data ? JSON.parse(data) : {}) } catch { ko(new Error('JSON invalide')) } })
    req.on('error', ko)
  })
}

function repondre(res, code, corps, type = 'application/json; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' })
  res.end(typeof corps === 'string' || Buffer.isBuffer(corps) ? corps : JSON.stringify(corps))
}

/* ─────────────────────────── Traitement des requêtes ─────────────────────────── */

async function apiEnregistrer(req, res, url) {
  const dossier = url.searchParams.get('dossier') ?? ''
  const genre = url.searchParams.get('genre') ?? ''
  const nomBrut = url.searchParams.get('nom') ?? ''
  const role = url.searchParams.get('role') === 'apercu' ? 'apercu' : 'principal'
  const optimiser = url.searchParams.get('optimiser') !== '0'

  let dir
  try { dir = dossierDe(dossier, genre) } catch (e) { return repondre(res, 400, { ok: false, erreur: e.message }) }
  if (!nomBrut) return repondre(res, 400, { ok: false, erreur: 'Nom de fichier manquant' })
  mkdirSync(dir, { recursive: true })

  let nom = nettoyerNom(nomBrut)
  // L'aperçu doit porter EXACTEMENT le nom de base de la vidéo : on écrase.
  if (role === 'apercu') {
    const cible = join(dir, nom)
    try { if (existsSync(cible)) unlinkSync(cible) } catch {}
  } else {
    nom = nomUnique(dir, nom)
  }

  const destination = join(dir, nom)
  const temporaire = destination + '.part'
  let recu = 0

  try {
    await pipeline(req.on('data', (c) => { recu += c.length; if (recu > TAILLE_MAX) req.destroy(new Error('Fichier trop volumineux')) }), createWriteStream(temporaire))
  } catch (e) {
    try { rmSync(temporaire, { force: true }) } catch {}
    return repondre(res, 413, { ok: false, erreur: 'Envoi interrompu ou fichier trop volumineux' })
  }

  renameSync(temporaire, destination)

  let avertissement = null
  if (genre === 'photos') {
    const r = await optimiserImage(dir, nom, optimiser)
    nom = r.nom
    avertissement = r.avertissement ?? null
  } else if (estVideo(nom) && !['.mp4', '.webm'].includes(ext(nom))) {
    avertissement = 'Format ' + ext(nom) + ' : certains navigateurs ne lisent que le MP4 (H.264) ou le WebM.'
  }

  return repondre(res, 200, { ok: true, nom, taille: taille(join(dir, nom)), avertissement })
}

async function apiSupprimer(req, res) {
  let corps
  try { corps = await lireJSON(req) } catch (e) { return repondre(res, 400, { ok: false, erreur: e.message }) }
  const { dossier, genre, nom } = corps
  let dir
  try { dir = dossierDe(dossier, genre) } catch (e) { return repondre(res, 400, { ok: false, erreur: e.message }) }
  if (!nom || basename(nom) !== nom) return repondre(res, 400, { ok: false, erreur: 'Nom invalide' })

  const cible = join(dir, nom)
  if (!estDans(cible, dir) || !existsSync(cible)) return repondre(res, 404, { ok: false, erreur: 'Fichier introuvable' })

  try { unlinkSync(cible) } catch (e) { return repondre(res, 500, { ok: false, erreur: e.message }) }

  // Si on supprime une vidéo, on retire aussi son aperçu automatique.
  if (genre === 'videos' && estVideo(nom)) {
    const base = basename(nom, extname(nom))
    for (const a of lister(dir)) {
      if (estImage(a) && basename(a, extname(a)) === base) {
        try { unlinkSync(join(dir, a)) } catch {}
      }
    }
  }
  return repondre(res, 200, { ok: true })
}

async function apiRenommer(req, res) {
  let corps
  try { corps = await lireJSON(req) } catch (e) { return repondre(res, 400, { ok: false, erreur: e.message }) }
  const { dossier, genre, nom, nouveau } = corps
  let dir
  try { dir = dossierDe(dossier, genre) } catch (e) { return repondre(res, 400, { ok: false, erreur: e.message }) }
  if (!nom || basename(nom) !== nom) return repondre(res, 400, { ok: false, erreur: 'Nom invalide' })

  const ancien = join(dir, nom)
  if (!existsSync(ancien)) return repondre(res, 404, { ok: false, erreur: 'Fichier introuvable' })

  // Si l'utilisateur ne redonne pas d'extension, on conserve celle d'origine.
  let nouveauBrut = String(nouveau || nom).trim()
  if (!extname(nouveauBrut)) nouveauBrut = basename(nouveauBrut) + extname(nom)

  const nouveauNom = nomUnique(dir, nettoyerNom(nouveauBrut))
  if (nouveauNom === nom) return repondre(res, 200, { ok: true, nom })

  renameSync(ancien, join(dir, nouveauNom))

  // Renommer une vidéo renomme aussi son aperçu associé.
  if (genre === 'videos' && estVideo(nom)) {
    const ancienneBase = basename(nom, extname(nom))
    for (const a of lister(dir)) {
      if (estImage(a) && basename(a, extname(a)) === ancienneBase) {
        renameSync(join(dir, a), join(dir, basename(nouveauNom, extname(nouveauNom)) + ext(a)))
      }
    }
  }
  return repondre(res, 200, { ok: true, nom: nouveauNom })
}

/* Remplace la photo d'un emplacement fixe (accueil, le salon, équipe). */
async function apiSiteImage(req, res, url) {
  const def = SITE_SLOTS.find((s) => s.id === url.searchParams.get('slot'))
  if (!def) return repondre(res, 400, { ok: false, erreur: 'Emplacement inconnu' })

  const nomBrut = url.searchParams.get('nom') ?? ''
  const optimiser = url.searchParams.get('optimiser') !== '0'
  const e = ext(nettoyerNom(nomBrut || 'x.jpg'))
  if (!IMAGES.includes(e) && !HEIC.includes(e)) return repondre(res, 400, { ok: false, erreur: 'Format d’image non géré' })

  mkdirSync(IMG, { recursive: true })
  let nom = def.id + e
  const destination = join(IMG, nom)
  const temporaire = destination + '.part'
  let recu = 0
  try {
    await pipeline(req.on('data', (c) => { recu += c.length; if (recu > TAILLE_MAX) req.destroy(new Error('Fichier trop volumineux')) }), createWriteStream(temporaire))
  } catch {
    try { rmSync(temporaire, { force: true }) } catch {}
    return repondre(res, 413, { ok: false, erreur: 'Envoi interrompu ou fichier trop volumineux' })
  }
  renameSync(temporaire, destination)

  let avertissement = null
  if (e !== '.svg') {
    const r = await optimiserImage(IMG, nom, optimiser)
    nom = r.nom
    avertissement = r.avertissement ?? null
  }

  // Un seul fichier par emplacement.
  for (const f of readdirSync(IMG)) {
    if (f !== nom && basename(f, extname(f)) === def.id && IMAGES.includes(ext(f))) {
      try { unlinkSync(join(IMG, f)) } catch {}
    }
  }

  const dims = (await dimensionsSips(join(IMG, nom))) ?? { w: def.w, h: def.h }
  try {
    majIndexImage(def.id, `assets/img/${nom}`, dims)
  } catch (err) {
    return repondre(res, 500, { ok: false, erreur: err.message })
  }

  return repondre(res, 200, { ok: true, nom, largeur: dims.w, hauteur: dims.h, avertissement })
}

/* Revient au visuel de remplacement d'un emplacement. */
async function apiSiteRetirer(req, res) {
  let corps
  try { corps = await lireJSON(req) } catch (e) { return repondre(res, 400, { ok: false, erreur: e.message }) }
  const def = SITE_SLOTS.find((s) => s.id === corps.slot)
  if (!def) return repondre(res, 400, { ok: false, erreur: 'Emplacement inconnu' })

  const { err } = await execFileP(process.execPath, [PLACEHOLDERS], { cwd: ROOT })
  if (err) return repondre(res, 500, { ok: false, erreur: 'Impossible de régénérer les visuels de remplacement' })

  const svg = def.id + '.svg'
  try {
    majIndexImage(def.id, `assets/img/${svg}`, { w: def.w, h: def.h })
  } catch (e) {
    return repondre(res, 500, { ok: false, erreur: e.message })
  }
  for (const f of readdirSync(IMG)) {
    if (f !== svg && basename(f, extname(f)) === def.id && IMAGES.includes(ext(f))) {
      try { unlinkSync(join(IMG, f)) } catch {}
    }
  }
  return repondre(res, 200, { ok: true })
}

/* Met à jour les avis clients (et le lien Google facultatif). */
async function apiAvis(req, res) {
  let corps
  try { corps = await lireJSON(req) } catch (e) { return repondre(res, 400, { ok: false, erreur: e.message }) }
  if (!Array.isArray(corps.avis)) return repondre(res, 400, { ok: false, erreur: 'Données manquantes' })

  const propres = avisPropres(corps.avis)

  const google = String(corps.google ?? '').trim().slice(0, 300)
  if (google && !/^https?:\/\//i.test(google)) {
    return repondre(res, 400, { ok: false, erreur: 'Le lien Google doit commencer par https://' })
  }

  try {
    const n = ecrireAvis(propres, google)
    return repondre(res, 200, { ok: true, avis: n })
  } catch (e) {
    return repondre(res, 500, { ok: false, erreur: e.message })
  }
}

/* Met à jour les noms et rôles des membres de l'équipe. */
async function apiEquipe(req, res) {
  let corps
  try { corps = await lireJSON(req) } catch (e) { return repondre(res, 400, { ok: false, erreur: e.message }) }
  if (!Array.isArray(corps.membres)) return repondre(res, 400, { ok: false, erreur: 'Données manquantes' })
  const propres = equipePropre(corps.membres)
  try {
    const n = ecrireEquipe(propres)
    return repondre(res, 200, { ok: true, membres: n })
  } catch (e) {
    return repondre(res, 500, { ok: false, erreur: e.message })
  }
}

async function apiMaj(res) {
  const { err, stdout, stderr } = await execFileP(process.execPath, [GALERIE], { cwd: ROOT })
  return repondre(res, 200, {
    ok: !err,
    sortie: (stdout + (stderr ? '\n' + stderr : '')).trim(),
  })
}

/* Prépare le dossier « public/ » et ouvre le Finder dessus. */
async function apiPublier(res) {
  const { err, stdout, stderr } = await execFileP(process.execPath, [GALERIE], { cwd: ROOT })
  if (err) return repondre(res, 500, { ok: false, erreur: 'Échec de la galerie : ' + (stderr || stdout).trim() })

  const r = await execFileP(process.execPath, [PUBLIER], { cwd: ROOT })
  if (r.err) return repondre(res, 500, { ok: false, erreur: 'Échec de la préparation : ' + (r.stderr || r.stdout).trim() })

  let domaine = ''
  try { domaine = readFileSync(DOMAINE_FICHIER, 'utf8').trim() } catch {}

  if (SUR_MAC && existsSync(DOSSIER_PUBLIC)) {
    spawn('open', [DOSSIER_PUBLIC], { detached: true, stdio: 'ignore' }).unref()
  }

  return repondre(res, 200, { ok: true, sortie: (stdout + '\n' + r.stdout).trim(), domaine })
}

async function apiOuvrir(req, res) {
  const corps = await lireJSON(req).catch(() => ({}))
  let dir
  try { dir = dossierDe(corps.dossier, corps.genre) } catch (e) { return repondre(res, 400, { ok: false, erreur: e.message }) }
  if (!SUR_MAC) return repondre(res, 200, { ok: false, erreur: 'Ouverture du Finder disponible sur macOS uniquement.' })
  mkdirSync(dir, { recursive: true })
  spawn('open', [dir], { detached: true, stdio: 'ignore' }).unref()
  return repondre(res, 200, { ok: true })
}

function servirFichier(res, chemin) {
  if (!existsSync(chemin) || !statSync(chemin).isFile()) return repondre(res, 404, 'Fichier introuvable', 'text/plain; charset=utf-8')
  const corps = readFileSync(chemin)
  res.writeHead(200, { 'Content-Type': MIME[ext(chemin)] ?? 'application/octet-stream', 'Content-Length': corps.length })
  res.end(corps)
}

/* ─────────────────────────── Serveur ─────────────────────────── */

const serveur = createServer(async (req, res) => {
  try {
    // Sécurité : le back office ne répond qu'à lui-même.
    // · Host : bloque les sites qui se feraient passer pour « localhost »
    //   (attaque dite de « DNS rebinding »).
    // · Origin : une page web ouverte dans un autre onglet ne peut pas
    //   envoyer d'ordres (supprimer, renommer, réécrire les avis…).
    const hote = String(req.headers.host ?? '').replace(/:\d+$/, '')
    if (!['localhost', '127.0.0.1', '[::1]'].includes(hote)) {
      return repondre(res, 403, 'Interdit', 'text/plain; charset=utf-8')
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const origine = req.headers.origin
      const permises = [`http://localhost:${port}`, `http://127.0.0.1:${port}`]
      if (!origine || !permises.includes(origine)) {
        return repondre(res, 403, { ok: false, erreur: 'Requête refusée (origine inconnue)' })
      }
    }

    const url = new URL(req.url, 'http://localhost')
    const chemin = decodeURIComponent(url.pathname)

    if (chemin === '/' || chemin === '/admin') return servirFichier(res, PAGE)

    if (chemin === '/api/etat') return repondre(res, 200, etat())
    if (chemin === '/api/enregistrer' && req.method === 'POST') return apiEnregistrer(req, res, url)
    if (chemin === '/api/supprimer' && req.method === 'POST') return apiSupprimer(req, res)
    if (chemin === '/api/renommer' && req.method === 'POST') return apiRenommer(req, res)
    if (chemin === '/api/site-image' && req.method === 'POST') return apiSiteImage(req, res, url)
    if (chemin === '/api/site-retirer' && req.method === 'POST') return apiSiteRetirer(req, res)
    if (chemin === '/api/equipe' && req.method === 'POST') return apiEquipe(req, res)
    if (chemin === '/api/avis' && req.method === 'POST') return apiAvis(req, res)
    if (chemin === '/api/maj' && req.method === 'POST') return apiMaj(res)
    if (chemin === '/api/ouvrir' && req.method === 'POST') return apiOuvrir(req, res)
    if (chemin === '/api/publier' && req.method === 'POST') return apiPublier(res)

    // Fichiers du projet (aperçus, site…), sans sortir du dossier racine.
    const fichier = resolve(ROOT, '.' + chemin)
    if (!estDans(fichier, ROOT)) return repondre(res, 403, 'Interdit', 'text/plain; charset=utf-8')
    // Jamais les fichiers cachés (.git, .env…).
    if (chemin.split('/').some((p) => p.startsWith('.'))) return repondre(res, 403, 'Interdit', 'text/plain; charset=utf-8')
    return servirFichier(res, fichier)
  } catch (e) {
    return repondre(res, 500, { ok: false, erreur: e.message })
  }
})

/* Choix du port : 4317 par défaut, puis les suivants si occupés. */
const portArg = process.argv.indexOf('--port')
let port = portArg !== -1 ? Number(process.argv[portArg + 1]) : 4317
if (!Number.isFinite(port)) port = 4173

let essais = 0
serveur.on('error', (e) => {
  if (e.code === 'EADDRINUSE' && portArg === -1 && essais < 20) {
    essais += 1
    port += 1
    setTimeout(() => serveur.listen(port, '127.0.0.1'), 60)
  } else {
    console.error('\n❌ Impossible de démarrer le back office :', e.message, '\n')
    process.exit(1)
  }
})

serveur.listen(port, '127.0.0.1', () => {
  const adresse = `http://localhost:${port}`
  console.log('')
  console.log('  ╔════════════════════════════════════════════════════════════╗')
  console.log('  ║        ZAKPA COIFFURE — Back office des photos/vidéos      ║')
  console.log('  ╚════════════════════════════════════════════════════════════╝')
  console.log('')
  console.log('  Adresse :  ' + adresse)
  console.log('')
  console.log('  Laissez cette fenêtre OUVERTE pendant que vous travaillez.')
  console.log('  Pour arrêter : fermez cette fenêtre (ou touche Ctrl + C).')
  console.log('')

  if (!process.argv.includes('--no-open') && SUR_MAC) {
    spawn('open', [adresse], { detached: true, stdio: 'ignore' }).unref()
  }
})

const arreter = () => { console.log('\n  Back office arrêté. À bientôt !\n'); process.exit(0) }
process.on('SIGINT', arreter)
process.on('SIGTERM', arreter)
