/**
 * Back office EN LIGNE — ZAKPA COIFFURE (fonction Netlify)
 * ============================================================================
 *
 * Sert l'API de la page https://<site>/gestion/ : le client s'y connecte avec
 * un mot de passe et peut, depuis son téléphone ou n'importe quel ordinateur,
 *
 *   · ajouter / supprimer des photos et vidéos de la galerie
 *   · changer les photos fixes (accueil, le salon, équipe)
 *   · modifier l'équipe et les avis clients
 *
 * Chaque enregistrement crée UN commit sur GitHub ; Netlify reconstruit alors
 * le site (tools/galerie.mjs + tools/publier.mjs) et le publie en 1 à 2 min.
 * Le back office Mac (tools/admin.mjs) reste utilisable : il récupère ces
 * changements avant de travailler (git pull).
 *
 * Variables d'environnement (Netlify → Site configuration → Environment variables) :
 *   GESTION_MOT_DE_PASSE   mot de passe du client (obligatoire, 10 caractères min.)
 *   GITHUB_TOKEN           jeton GitHub « fine-grained » limité au dépôt,
 *                          permission « Contents : Read and write » (obligatoire)
 *   GITHUB_DEPOT           propriétaire/dépôt   (défaut : sinafou2507/zakpa-coiffure)
 *   GITHUB_BRANCHE         branche publiée      (défaut : main)
 */
import { createHmac, createHash, timingSafeEqual } from 'node:crypto'
import {
  CATEGORIES, SITE_SLOTS, nettoyerNom, majImage, imageActuelle,
  lireEquipe, ecrireEquipe, equipePropre,
  lireAvis, lireLienGoogle, ecrireAvis, avisPropres,
} from '../../tools/contenu.mjs'

export const config = { path: '/gestion/api/:action' }

const env = (k, d = '') => (process.env[k] ?? d).trim()
const DEPOT = () => env('GITHUB_DEPOT', 'sinafou2507/zakpa-coiffure')
const BRANCHE = () => env('GITHUB_BRANCHE', 'main')
const DUREE_SESSION = 12 * 3600 * 1000 // 12 h
const TAILLE_MAX = 4.3 * 1024 * 1024 // ≈ limite d'une requête Netlify (6 Mo en base64)

const DOSSIERS = new Set(CATEGORIES.map((c) => c.dossier))
const EXT_PHOTO = /\.(jpe?g|png|webp)$/
const EXT_VIDEO = /\.(mp4|webm|mov|m4v)$/
const NOM_VALIDE = /^[a-z0-9][a-z0-9-]{0,70}\.[a-z0-9]{2,5}$/

/* ─────────────────────────── Réponses ─────────────────────────── */

const json = (corps, statut = 200) => new Response(JSON.stringify(corps), {
  status: statut,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
})
const erreur = (message, statut = 400) => json({ ok: false, erreur: message }, statut)
class ErreurClient extends Error {}

/* ─────────────────────────── Connexion ─────────────────────────── */

const sha256 = (s) => createHash('sha256').update(s).digest()
function secret() {
  // Dérivé du mot de passe + jeton GitHub : changer l'un des deux déconnecte tout le monde.
  return sha256('zakpa-gestion|' + env('GESTION_MOT_DE_PASSE') + '|' + env('GITHUB_TOKEN'))
}
const signer = (texte) => createHmac('sha256', secret()).update(texte).digest('base64url')

function creerJeton() {
  const exp = String(Date.now() + DUREE_SESSION)
  return exp + '.' + signer(exp)
}

function jetonValide(jeton) {
  const [exp, sig] = String(jeton ?? '').split('.')
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < Date.now()) return false
  const attendu = Buffer.from(signer(exp))
  const recu = Buffer.from(sig)
  return attendu.length === recu.length && timingSafeEqual(attendu, recu)
}

function motDePasseCorrect(saisi) {
  const vrai = env('GESTION_MOT_DE_PASSE')
  if (vrai.length < 10) return false // refuse de fonctionner avec un mot de passe faible / absent
  return timingSafeEqual(sha256(String(saisi ?? '')), sha256(vrai))
}

/* ─────────────────────────── GitHub ─────────────────────────── */

async function gh(chemin, { method = 'GET', corps, brut = false } = {}) {
  const r = await fetch(`https://api.github.com/repos/${DEPOT()}${chemin}`, {
    method,
    headers: {
      Authorization: `Bearer ${env('GITHUB_TOKEN')}`,
      Accept: brut ? 'application/vnd.github.raw' : 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'zakpa-gestion',
      ...(corps ? { 'Content-Type': 'application/json' } : {}),
    },
    body: corps ? JSON.stringify(corps) : undefined,
  })
  if (!r.ok) {
    const texte = await r.text().catch(() => '')
    const e = new Error(`GitHub ${r.status} sur ${method} ${chemin} : ${texte.slice(0, 200)}`)
    e.statut = r.status
    throw e
  }
  return brut ? r : r.json()
}

/* Photographie du dépôt : dernier commit, liste des fichiers, index.html. */
async function lireDepot() {
  const ref = await gh(`/git/ref/heads/${BRANCHE()}`)
  const commit = ref.object.sha
  const { tree } = await gh(`/git/commits/${commit}`)
  const arbre = await gh(`/git/trees/${tree.sha}?recursive=1`)
  const fichiers = new Map(
    arbre.tree.filter((e) => e.type === 'blob' && e.path.startsWith('assets/')).map((e) => [e.path, e.sha]),
  )
  const index = await (await gh(`/contents/index.html?ref=${commit}`, { brut: true })).text()
  return { commit, arbre: tree.sha, fichiers, index }
}

/* ─────────────────────────── État ─────────────────────────── */

const base = (nom) => nom.replace(/\.[^.]+$/, '')

function etat({ fichiers, index }) {
  const dans = (prefixe) => [...fichiers.keys()]
    .filter((p) => p.startsWith(prefixe) && !p.slice(prefixe.length).includes('/'))
    .map((p) => p.slice(prefixe.length))
    .filter((n) => !n.startsWith('.') && !n.endsWith('.txt') && !n.startsWith('LISEZ'))
    .sort()

  return {
    ok: true,
    categories: CATEGORIES.map((c) => {
      const photos = dans(`assets/photos/${c.dossier}/`).filter((n) => EXT_PHOTO.test(n))
      const contenuVideos = dans(`assets/videos/${c.dossier}/`)
      const videos = contenuVideos.filter((n) => EXT_VIDEO.test(n)).map((nom) => {
        const apercu = contenuVideos.find((a) => EXT_PHOTO.test(a) && base(a) === base(nom))
        return { nom, apercu: apercu ? `assets/videos/${c.dossier}/${apercu}` : null }
      })
      return {
        dossier: c.dossier,
        label: c.label,
        photos: photos.map((nom) => ({ nom, chemin: `assets/photos/${c.dossier}/${nom}` })),
        videos: videos.map((v) => ({ ...v, chemin: `assets/videos/${c.dossier}/${v.nom}` })),
      }
    }),
    site: SITE_SLOTS.map((s) => {
      const chemin = imageActuelle(index, s.id)
      return { id: s.id, label: s.label, chemin, parDefaut: !chemin || chemin.endsWith('.svg') }
    }),
    equipe: lireEquipe(index),
    avis: lireAvis(index),
    avisGoogle: lireLienGoogle(index),
  }
}

/* ─────────────────────────── Enregistrement ─────────────────────────── */

const estSha = (s) => typeof s === 'string' && /^[0-9a-f]{40}$/.test(s)

function nomLibre(fichiers, dossier, nom) {
  const b = base(nom)
  const e = nom.slice(b.length)
  const pris = (n) => [...fichiers.keys()].some((p) => p.startsWith(dossier + '/') && base(p.slice(dossier.length + 1)) === n)
  if (!pris(b)) return b + e
  let i = 2
  while (pris(`${b}-${i}`)) i += 1
  return `${b}-${i}${e}`
}

/* Traduit une demande du navigateur en modifications de fichiers + d'index.html. */
function preparer(depot, demande) {
  const { fichiers } = depot
  let index = depot.index
  const indexAvant = index
  const arbre = [] // entrées de l'arbre Git à modifier
  const resume = []
  const ajouter = (path, sha) => { arbre.push({ path, mode: '100644', type: 'blob', sha }); fichiers.set(path, sha) }
  const retirer = (path) => { if (fichiers.has(path)) { arbre.push({ path, mode: '100644', type: 'blob', sha: null }); fichiers.delete(path) } }

  // 1. Ajouts dans la galerie
  for (const a of (demande.ajouts ?? []).slice(0, 40)) {
    const genre = a?.genre === 'videos' ? 'videos' : a?.genre === 'photos' ? 'photos' : null
    if (!genre || !DOSSIERS.has(a.dossier) || !estSha(a.sha)) throw new ErreurClient('Ajout invalide')
    let nom = nettoyerNom(a.nom || 'photo.jpg')
    if (genre === 'photos' && !EXT_PHOTO.test(nom)) nom = base(nom) + '.jpg'
    if (genre === 'videos' && !EXT_VIDEO.test(nom)) throw new ErreurClient('Format de vidéo non accepté')
    const dossier = `assets/${genre}/${a.dossier}`
    nom = nomLibre(fichiers, dossier, nom)
    ajouter(`${dossier}/${nom}`, a.sha)
    if (genre === 'videos' && estSha(a.apercuSha)) ajouter(`${dossier}/${base(nom)}.jpg`, a.apercuSha)
    resume.push(`+ ${genre === 'videos' ? 'vidéo' : 'photo'} ${a.dossier}/${nom}`)
  }

  // 2. Suppressions dans la galerie
  for (const s of (demande.suppressions ?? []).slice(0, 100)) {
    const chemin = String(s ?? '')
    const m = /^assets\/(photos|videos)\/([a-z-]+)\/([^/]+)$/.exec(chemin)
    if (!m || !DOSSIERS.has(m[2]) || !NOM_VALIDE.test(m[3]) || !fichiers.has(chemin)) {
      throw new ErreurClient('Fichier introuvable : ' + chemin)
    }
    retirer(chemin)
    if (m[1] === 'videos' && EXT_VIDEO.test(m[3])) {
      for (const p of [...fichiers.keys()]) {
        if (p.startsWith(`assets/videos/${m[2]}/`) && EXT_PHOTO.test(p) && base(p.split('/').pop()) === base(m[3])) retirer(p)
      }
    }
    resume.push(`- ${m[2]}/${m[3]}`)
  }

  // 3. Photos fixes du site
  for (const im of (demande.images ?? []).slice(0, SITE_SLOTS.length)) {
    const slot = SITE_SLOTS.find((s) => s.id === im?.slot)
    if (!slot || !estSha(im.sha)) throw new ErreurClient('Photo du site invalide')
    const w = Math.round(Number(im.w)), h = Math.round(Number(im.h))
    if (!(w > 0 && w < 10000 && h > 0 && h < 10000)) throw new ErreurClient('Dimensions invalides')
    const chemin = `assets/img/${slot.id}.jpg`
    for (const p of [...fichiers.keys()]) {
      if (p !== chemin && /^assets\/img\/[^/]+$/.test(p) && base(p.split('/').pop()) === slot.id && !p.endsWith('.svg')) retirer(p)
    }
    ajouter(chemin, im.sha)
    // « ?v= » force les navigateurs à recharger la nouvelle photo.
    index = majImage(index, slot.id, `${chemin}?v=${im.sha.slice(0, 8)}`, { w, h })
    resume.push(`photo du site : ${slot.label}`)
  }

  // 4. Équipe et avis
  if (Array.isArray(demande.equipe)) {
    index = ecrireEquipe(index, equipePropre(demande.equipe))
    resume.push('équipe')
  }
  if (Array.isArray(demande.avis)) {
    const google = String(demande.avisGoogle ?? '').trim().slice(0, 300)
    if (google && !/^https:\/\//i.test(google)) throw new ErreurClient('Le lien Google doit commencer par https://')
    index = ecrireAvis(index, avisPropres(demande.avis), google)
    resume.push('avis clients')
  }

  if (index !== indexAvant) arbre.push({ path: 'index.html', mode: '100644', type: 'blob', content: index })
  return { arbre, resume }
}

async function enregistrer(demande) {
  for (let essai = 0; essai < 3; essai += 1) {
    const depot = await lireDepot()
    const { arbre, resume } = preparer(depot, demande)
    if (!arbre.length) return { ok: true, rien: true }

    const nouvelArbre = await gh('/git/trees', { method: 'POST', corps: { base_tree: depot.arbre, tree: arbre } })
    const message = 'Back office en ligne : ' + resume.slice(0, 3).join(', ') +
      (resume.length > 3 ? ` (+${resume.length - 3})` : '') + '\n\n' + resume.join('\n')
    const commit = await gh('/git/commits', { method: 'POST', corps: { message, tree: nouvelArbre.sha, parents: [depot.commit] } })
    try {
      await gh(`/git/refs/heads/${BRANCHE()}`, { method: 'PATCH', corps: { sha: commit.sha, force: false } })
      return { ok: true, commit: commit.sha.slice(0, 7), resume }
    } catch (e) {
      // Quelqu'un (le Mac ?) a publié entre-temps : on recommence sur la nouvelle version.
      if (e.statut !== 422) throw e
    }
  }
  throw new Error('Le site a été modifié en même temps ailleurs. Réessayez.')
}

/* ─────────────────────────── Point d'entrée ─────────────────────────── */

export default async (req, context) => {
  const action = context?.params?.action ?? new URL(req.url).pathname.split('/').pop()

  if (!env('GITHUB_TOKEN') || env('GESTION_MOT_DE_PASSE').length < 10) {
    return erreur('Back office pas encore configuré (variables GITHUB_TOKEN / GESTION_MOT_DE_PASSE).', 503)
  }

  // Les ordres ne peuvent venir que de la page /gestion/ du site lui-même.
  if (req.method !== 'GET') {
    const origine = req.headers.get('origin')
    if (!origine || origine !== new URL(req.url).origin) return erreur('Origine refusée', 403)
  }

  try {
    if (action === 'connexion' && req.method === 'POST') {
      const { motDePasse } = await req.json().catch(() => ({}))
      if (!motDePasseCorrect(motDePasse)) {
        await new Promise((ok) => setTimeout(ok, 1500)) // freine les essais en série
        return erreur('Mot de passe incorrect', 401)
      }
      return json({ ok: true, jeton: creerJeton() })
    }

    const jeton = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!jetonValide(jeton)) return erreur('Session expirée : reconnectez-vous', 401)

    if (action === 'etat' && req.method === 'GET') return json(etat(await lireDepot()))

    if (action === 'fichier' && req.method === 'POST') {
      const longueur = Number(req.headers.get('content-length') ?? 0)
      if (longueur > TAILLE_MAX * 1.4) return erreur('Fichier trop lourd (4 Mo maximum)', 413)
      const { contenu } = await req.json()
      if (typeof contenu !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(contenu)) return erreur('Fichier invalide')
      if (contenu.length * 0.75 > TAILLE_MAX) return erreur('Fichier trop lourd (4 Mo maximum)', 413)
      const blob = await gh('/git/blobs', { method: 'POST', corps: { content: contenu, encoding: 'base64' } })
      return json({ ok: true, sha: blob.sha })
    }

    if (action === 'enregistrer' && req.method === 'POST') {
      return json(await enregistrer(await req.json()))
    }

    return erreur('Action inconnue', 404)
  } catch (e) {
    if (e instanceof ErreurClient) return erreur(e.message, 400)
    console.error(e)
    return erreur('Erreur du serveur : ' + e.message.replace(/Bearer\s+\S+/g, ''), 500)
  }
}
