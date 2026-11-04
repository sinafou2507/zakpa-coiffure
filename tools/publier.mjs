#!/usr/bin/env node
/**
 * Prépare le dossier « public/ » : la version du site à mettre en ligne.
 *
 * On n'y copie QUE ce dont le site a besoin (index.html, assets, robots.txt,
 * sitemap.xml) — jamais les scripts internes, les sauvegardes ni le back office.
 *
 * Usage :
 *   node tools/publier.mjs
 *   node tools/publier.mjs --domaine https://zakpa-coiffure.netlify.app
 *
 * Le domaine peut aussi être mémorisé dans tools/domaine.txt (une ligne).
 * Il sert à réécrire les liens « canonical », Open Graph, sitemap et robots.txt
 * dans la copie publiée, sans jamais modifier les fichiers d'origine.
 */
import {
  rmSync, mkdirSync, copyFileSync, cpSync, readdirSync, statSync,
  readFileSync, writeFileSync, existsSync,
} from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public')
const DOMAINE_SOURCE = 'https://www.zakpa-coiffure.ci'

const iDom = process.argv.indexOf('--domaine')
const fichierDomaine = join(ROOT, 'tools', 'domaine.txt')
const domaine = (
  (iDom !== -1 ? process.argv[iDom + 1] : '') ||
  (existsSync(fichierDomaine) ? readFileSync(fichierDomaine, 'utf8').trim() : '') ||
  DOMAINE_SOURCE
).replace(/\/+$/, '')

if (!/^https?:\/\//.test(domaine)) {
  console.error(`\n❌ Domaine invalide : « ${domaine} » (attendu : https://…)`)
  process.exit(1)
}

/* ─────────────── Copie ─────────────── */
rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

const FICHIERS = ['index.html', 'mentions-legales.html', 'robots.txt', 'sitemap.xml']
for (const f of FICHIERS) {
  if (!existsSync(join(ROOT, f))) {
    console.error(`\n❌ Fichier manquant : ${f}`)
    process.exit(1)
  }
  copyFileSync(join(ROOT, f), join(OUT, f))
}
cpSync(join(ROOT, 'assets'), join(OUT, 'assets'), { recursive: true })

/* Nettoie les fichiers inutiles (macOS, notes de dossiers). */
function nettoyer(dir) {
  for (const entree of readdirSync(dir)) {
    const chemin = join(dir, entree)
    if (statSync(chemin).isDirectory()) nettoyer(chemin)
    else if (entree === '.DS_Store' || entree === 'LISEZ-MOI.txt' || entree.endsWith('.bak') || entree.includes('.avant-')) rmSync(chemin, { force: true })
  }
}
nettoyer(OUT)

/* ─────────────── Domaine ─────────────── */
let occurrences = 0
if (domaine !== DOMAINE_SOURCE) {
  for (const f of FICHIERS) {
    const chemin = join(OUT, f)
    const avant = readFileSync(chemin, 'utf8')
    const combien = avant.split(DOMAINE_SOURCE).length - 1
    if (combien) {
      writeFileSync(chemin, avant.split(DOMAINE_SOURCE).join(domaine), 'utf8')
      occurrences += combien
    }
  }
}

/* ─────────────── Résumé ─────────────── */
function taille(dir) {
  let total = 0
  for (const entree of readdirSync(dir)) {
    const chemin = join(dir, entree)
    total += statSync(chemin).isDirectory() ? taille(chemin) : statSync(chemin).size
  }
  return total
}

const mo = (taille(OUT) / 1048576).toFixed(1)
console.log('')
console.log('  ✅ Dossier « public/ » prêt à publier')
console.log('')
console.log('     Contenu      : index.html, assets/, robots.txt, sitemap.xml')
console.log(`     Poids total  : ${mo} Mo`)
console.log('     Adresse      : ' + domaine)
if (domaine === DOMAINE_SOURCE) {
  console.log('')
  console.log('  ⚠️  Adresse provisoire. Une fois votre site en ligne, notez son adresse')
  console.log('      réelle puis relancez :  node tools/publier.mjs --domaine <adresse>')
} else {
  console.log(`     Liens réécrits : ${occurrences} (canonical, Open Graph, sitemap, robots)`)
}
console.log('')
console.log('  Ouvrez le dossier « public » et glissez-le sur votre hébergeur.')
console.log('')
