/**
 * Lecture / écriture du contenu modifiable d'index.html — ZAKPA COIFFURE
 * ============================================================================
 *
 * Fonctions « pures » (texte HTML en entrée → texte HTML en sortie), partagées
 * par les deux back offices :
 *
 *   · tools/admin.mjs                    back office local (Mac)
 *   · netlify/functions/gestion.mjs      back office en ligne (client)
 *
 * ⚠️ Elles s'appuient sur la structure d'index.html (classes « member »,
 *    « grid grid--reviews », « reviews__more »…). Ne pas renommer ces classes.
 */

/* ⚠️ Tenir cette liste synchronisée avec tools/galerie.mjs (CATEGORIES). */
export const CATEGORIES = [
  { dossier: 'coupe-dame',     cat: 'dame',     label: 'Coupe dame' },
  { dossier: 'coiffure-homme', cat: 'homme',    label: 'Coiffure homme' },
  { dossier: 'locks-tresses',  cat: 'locks',    label: 'Locks & tresses' },
  { dossier: 'soins-visage',   cat: 'visage',   label: 'Soins du visage' },
  { dossier: 'tatouage',       cat: 'tatouage', label: 'Tatouage' },
  { dossier: 'faux-ongles',    cat: 'ongles',   label: 'Faux ongles' },
]

/* Photos « fixes » du site : un emplacement = un fichier assets/img/<id>.<ext>.
   w / h = dimensions du visuel de remplacement, pour pouvoir y revenir. */
export const SITE_SLOTS = [
  { id: 'hero-portrait', label: 'Accueil — photo principale', w: 900, h: 1200 },
  { id: 'hero-square',   label: 'Accueil — photo ronde', w: 900, h: 900 },
  { id: 'about',         label: "Le salon — photo d'illustration", w: 1000, h: 750 },
  { id: 'team-1',        label: 'Équipe — portrait 1', w: 600, h: 700 },
  { id: 'team-2',        label: 'Équipe — portrait 2', w: 600, h: 700 },
  { id: 'team-3',        label: 'Équipe — portrait 3', w: 600, h: 700 },
  { id: 'team-4',        label: 'Équipe — portrait 4', w: 600, h: 700 },
]

export const decodeEnt = (s) => String(s)
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'").replace(/&amp;/g, '&')
export const encodeEnt = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/* Transforme un nom de fichier en nom « propre » : minuscules, sans accents,
   mots séparés par des tirets — comme attendu par tools/galerie.mjs. */
export function nettoyerNom(nom) {
  const s = String(nom)
  const i = s.lastIndexOf('.')
  const e = i > 0 ? s.slice(i).toLowerCase() : ''
  const base = (i > 0 ? s.slice(0, i) : s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return (base || 'fichier') + e
}

/* ───────────── Photos fixes (accueil, le salon, équipe) ───────────── */

/* Réécrit le <img> d'un emplacement : source + dimensions. */
export function majImage(html, id, cheminRel, dims) {
  let touche = 0
  const nouveau = html.replace(/<img\b[^>]*>/g, (tag) => {
    if (!tag.includes(`assets/img/${id}.`)) return tag
    let t = tag.replace(/(\bsrc=")assets\/img\/[^"]+(")/, `$1${cheminRel}$2`)
    if (dims?.w) t = t.replace(/(\bwidth=")\d+(")/, `$1${Math.round(dims.w)}$2`)
    if (dims?.h) t = t.replace(/(\bheight=")\d+(")/, `$1${Math.round(dims.h)}$2`)
    touche += 1
    return t
  })
  if (!touche) throw new Error(`Image « ${id} » introuvable dans index.html`)
  return nouveau
}

/* Fichier actuellement affiché pour un emplacement (ex. « assets/img/about.jpeg »). */
export function imageActuelle(html, id) {
  const m = new RegExp(`\\bsrc="(assets/img/${id}\\.[a-z0-9]+(?:\\?[^"]*)?)"`).exec(html)
  return m ? m[1] : null
}

/* ───────────── Équipe ───────────── */

export function lireEquipe(html) {
  const membres = []
  const re = /<article class="member[^"]*">([\s\S]*?)<\/article>/g
  let m
  while ((m = re.exec(html))) {
    const nom = /<h4>([\s\S]*?)<\/h4>/.exec(m[1])
    const role = /<p class="member__role">([\s\S]*?)<\/p>/.exec(m[1])
    membres.push({
      nom: nom ? decodeEnt(nom[1].trim()) : '',
      role: role ? decodeEnt(role[1].trim()) : '',
    })
  }
  return membres
}

export function ecrireEquipe(html, membres) {
  let i = 0
  const re = /<article class="member[^"]*">[\s\S]*?<\/article>/g
  const nouveau = html.replace(re, (bloc) => {
    const mm = membres[i]
    i += 1
    if (!mm) return bloc
    const nomBrut = String(mm.nom ?? '').trim()
    const roleBrut = String(mm.role ?? '').trim()
    const alt = nomBrut && nomBrut !== 'À compléter'
      ? `Portrait de ${nomBrut}, ${roleBrut}`
      : "Portrait d'un membre de l'équipe"
    return bloc
      .replace(/(<img\b[^>]*\balt=")[^"]*(")/, `$1${encodeEnt(alt).replace(/"/g, '&quot;')}$2`)
      .replace(/(<h4>)[\s\S]*?(<\/h4>)/, `$1${encodeEnt(nomBrut)}$2`)
      .replace(/(<p class="member__role">)[\s\S]*?(<\/p>)/, `$1${encodeEnt(roleBrut)}$2`)
  })
  if (!i) throw new Error('Section équipe introuvable dans index.html')
  return nouveau
}

/* ───────────── Avis clients ───────────── */

const ETOILE = '<svg aria-hidden="true"><use href="#i-star"/></svg>'

export function lireAvis(html) {
  const bloc = /<div class="grid grid--reviews">([\s\S]*?)<\/div>/.exec(html)
  if (!bloc) return []
  const figures = bloc[1].match(/<figure class="review[^"]*">[\s\S]*?<\/figure>/g) ?? []
  return figures.map((f) => {
    const note = (f.match(/<use href="#i-star"\/>/g) ?? []).length
    const texte = (/<blockquote>([\s\S]*?)<\/blockquote>/.exec(f)?.[1] ?? '').trim()
    const nom = (/<figcaption><strong>([\s\S]*?)<\/strong>/.exec(f)?.[1] ?? '').trim()
    const prestation = (/<figcaption><strong>[\s\S]*?<\/strong>\s*<span>([\s\S]*?)<\/span>/.exec(f)?.[1] ?? '').trim()
    return {
      note: Math.min(5, Math.max(1, note || 5)),
      texte: decodeEnt(texte.replace(/^«\s*/, '').replace(/\s*»$/, '').trim()),
      nom: decodeEnt(nom),
      prestation: decodeEnt(prestation),
    }
  })
}

export function lireLienGoogle(html) {
  const m = /<a[^>]*data-avis-google[^>]*href="([^"]*)"/.exec(html)
  return m ? decodeEnt(m[1]) : ''
}

/* Nettoie et borne les avis reçus d'un formulaire. */
export function avisPropres(liste) {
  return (Array.isArray(liste) ? liste : []).slice(0, 12).map((a) => ({
    note: Math.min(5, Math.max(1, Math.round(Number(a?.note) || 5))),
    texte: String(a?.texte ?? '').trim().slice(0, 400),
    nom: String(a?.nom ?? '').trim().slice(0, 40),
    prestation: String(a?.prestation ?? '').trim().slice(0, 60),
  })).filter((a) => a.texte.length > 0)
}

export function equipePropre(liste) {
  return (Array.isArray(liste) ? liste : []).slice(0, 20).map((m) => ({
    nom: String(m?.nom ?? '').trim().slice(0, 60),
    role: String(m?.role ?? '').trim().slice(0, 80),
  }))
}

/* Réécrit la liste des avis et, si fourni, le lien vers les avis Google. */
export function ecrireAvis(html, avis, google) {
  const blocs = avis.map((a) => {
    const note = Math.min(5, Math.max(1, Math.round(Number(a.note) || 5)))
    const texte = encodeEnt(String(a.texte ?? '').trim())
    const nom = encodeEnt(String(a.nom ?? '').trim())
    const prestation = encodeEnt(String(a.prestation ?? '').trim())
    return `      <figure class="review reveal">
        <span class="review__stars" aria-label="Note : ${note} étoile${note > 1 ? 's' : ''} sur 5">
          ${ETOILE.repeat(note)}
        </span>
        <blockquote>« ${texte} »</blockquote>
        <figcaption><strong>${nom}</strong><span>${prestation}</span></figcaption>
      </figure>`
  })
  const contenu = blocs.length ? '\n\n' + blocs.join('\n\n') + '\n\n    ' : '\n    '

  const re = /(<div class="grid grid--reviews">)([\s\S]*?)(<\/div>)/
  if (!re.test(html)) throw new Error('Section avis introuvable dans index.html')
  html = html.replace(re, (_, a, __, c) => a + contenu + c)

  // Bouton facultatif « Voir nos avis Google ».
  html = html.replace(/[ \t]*<a[^>]*data-avis-google[^>]*>[\s\S]*?<\/a>\n?/g, '')
  if (google) {
    if (!/^https?:\/\//i.test(google)) throw new Error('Le lien Google doit commencer par https://')
    const lien = `      <a class="btn btn--ghost" data-avis-google
         href="${encodeEnt(google).replace(/"/g, '&quot;')}"
         target="_blank" rel="noopener">
        Voir nos avis Google
        <svg class="btn__icon" aria-hidden="true"><use href="#i-arrow"/></svg>
      </a>
`
    if (!/<p class="reviews__more reveal">\n/.test(html)) throw new Error('Bloc « reviews__more » introuvable')
    html = html.replace(/(<p class="reviews__more reveal">\n)/, (m) => m + lien)
  }
  return html
}
