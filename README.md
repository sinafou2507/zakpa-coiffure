# ZAKPA COIFFURE — site vitrine

Site vitrine statique (HTML / CSS / JavaScript, sans dépendance) pour
**ZAKPA COIFFURE**, salon de coiffure à Yopougon Ananeraie (Abidjan) :
coupe dame, coiffure homme, locks & tresses, soins du visage, tatouage et
pose de faux ongles.

L'objectif est simple : **transformer une visite en appel ou en message
WhatsApp en moins de dix secondes.**

---

## 1. Aperçu des fichiers

```
salon-coiffure/
├── index.html                     ← tout le contenu du site
├── Back office.command            ← ⭐ double-clic : gérer photos & vidéos (recommandé)
├── Mettre à jour la galerie.command ← double-clic : ancienne méthode
├── Publier le site.command        ← ⭐ double-clic : prépare le dossier à publier
├── public/                        ← ⭐ généré : le site prêt à mettre en ligne
├── robots.txt                     ← autorise l'indexation par Google
├── sitemap.xml                    ← plan du site pour Google
├── assets/
│   ├── css/styles.css             ← mise en forme (thème noir & or)
│   ├── js/main.js                 ← interactions (menu, galerie, horaires…)
│   ├── img/
│   │   ├── logo-sm.webp           ← logo détouré, en-tête + pied de page (9 Ko)
│   │   ├── logo.webp              ← logo détouré, section de contact (41 Ko)
│   │   ├── logo.png               ← logo détouré de référence (sert aux générations)
│   │   ├── logo-original.png      ← votre logo d'origine, conservé intact
│   │   ├── og-image.jpg           ← image de partage WhatsApp / Facebook
│   │   ├── apple-touch-icon.png   ← icône d'écran d'accueil iOS
│   │   ├── favicon.svg            ← icône d'onglet (version simplifiée)
│   │   └── *.svg                  ← visuels de remplacement (à remplacer)
│   ├── photos/                    ← ⭐ VOS PHOTOS, un dossier par catégorie
│   │   ├── coupe-dame/            ·   coiffure-homme/
│   │   ├── locks-tresses/         ·   soins-visage/
│   │   └── tatouage/              ·   faux-ongles/
│   └── videos/                    ← ⭐ VOS VIDÉOS, même organisation
└── tools/
    ├── admin.mjs                  ← ⭐ le back office (serveur local)
    ├── admin.html                 ← ⭐ l'interface du back office
    ├── publier.mjs                ← ⭐ prépare le dossier « public/ » à publier
    ├── domaine.txt                ← adresse du site en ligne (ligne unique)
    ├── galerie.mjs                ← met à jour la galerie automatiquement
    ├── gen-placeholders.mjs       ← régénère les visuels de remplacement
    ├── logo-transparent.mjs       ← détoure le fond du logo
    └── gen-og.mjs                 ← génère l'image de partage
```

---

## 2. Lancer le site en local

Ouvrir directement `index.html` dans un navigateur fonctionne, mais un petit
serveur local est préférable (les liens et la carte se comportent alors comme
en ligne) :

```bash
cd salon-coiffure
python3 -m http.server 8000
```

Puis ouvrir <http://localhost:8000>.

---

## 3. Personnaliser le site

### 3.1 Coordonnées

**Informations déjà en place :**

| Élément | Valeur |
|---|---|
| Nom du salon | `ZAKPA COIFFURE` |
| Téléphone / WhatsApp | `+225 07 58 12 35 93` |
| Adresse | `Yopougon Ananeraie, Abidjan, Côte d'Ivoire` |
| Instagram | `@danielcoiffure61` |
| Devise | Franc CFA (`FCFA` / `XOF`) |
| Signature | *Style, Propreté & Précision* |

**À compléter — ces valeurs sont encore des exemples :**

| Élément | Valeur actuelle | À faire |
|---|---|---|
| Horaires d'ouverture | mar–ven 09:00–19:00, sam 09:00–20:00 | à confirmer |
| Prix des prestations | `dès 5 000 FCFA`, `dès 2 000 FCFA`… | à confirmer |
| Prénoms de l'équipe | `Daniel` + `À compléter` | à remplacer |
| Avis clients | 3 témoignages d'exemple | à remplacer par de vrais avis |
| Nom de domaine | `zakpa-coiffure.ci` | à acheter puis remplacer partout |
| TikTok / Facebook | `@danielcoiffure61` (TikTok) / *retiré* (Facebook) | à compléter si le salon a un Facebook |

> **Astuce :** dans `index.html`, faites un rechercher/remplacer global.
> Le numéro apparaît sous deux formes : `+225 07 58 12 35 93` (affichage) et
> `+2250758123593` (liens `tel:` et `wa.me`). Remplacez les deux.
>
> ⚠️ **N'inventez jamais de faux avis clients ni de fausses notes.** C'est
> trompeur pour les visiteurs et sanctionnable (Google, droit de la
> consommation). Utilisez uniquement de vrais témoignages, avec l'accord de
> leurs auteurs.

Le JavaScript lit le numéro depuis le premier lien `tel:` du fichier et
construit automatiquement tous les liens WhatsApp : **le numéro n'est écrit
qu'à un seul endroit logique**, pas besoin de le dupliquer dans le code.

### 3.2 Messages WhatsApp pré-remplis

Chaque bouton « Réserver » ouvre WhatsApp avec un message déjà rédigé, adapté
au service concerné. Pour modifier un message, cherchez dans `index.html` :

```html
data-wa-message="Bonjour 👋 Je souhaite un rendez-vous pour une coupe dame."
```

Un message précis augmente fortement le taux de prise de contact : le client
n'a rien à écrire, il appuie simplement sur « envoyer ».

### 3.3 Horaires

Les horaires sont définis **une seule fois**, dans le tableau `#hours` de
`index.html` :

```html
<li data-days="2,3,4,5" data-open="09:00" data-close="19:00">
  <span>Mardi – Vendredi</span><span>09:00 – 19:00</span>
</li>
```

- `data-days` : jours concernés (`0` = dimanche, `1` = lundi, …)
- `data-open` / `data-close` : heures au format `HH:MM`
- Un jour sans `data-open` est considéré comme fermé.

Le badge **« Ouvert / Fermé »** se calcule automatiquement à partir de ces
attributs, et la ligne du jour est mise en valeur. Pensez à mettre à jour
également les horaires du pied de page et le bloc `openingHoursSpecification`
des données structurées (fin de `index.html`).

### 3.4 Ajouter des photos et des vidéos ⭐

C'est la manipulation la plus fréquente — et elle **ne demande aucune
connaissance technique**. Deux méthodes au choix.

#### Méthode 1 — le back office (recommandée) ⭐

Double-cliquez sur **`Back office.command`** à la racine du projet. Une page
s'ouvre dans votre navigateur.

> Si macOS refuse de l'ouvrir la première fois : **clic droit → Ouvrir →
> Ouvrir**. C'est le contrôle de sécurité de macOS, à faire une seule fois.

Dans cette page :

1. Choisissez une **catégorie** (Coupe dame, Coiffure homme…) puis
   **Photos** ou **Vidéos**.
2. **Glissez vos fichiers** dans la zone prévue (ou cliquez pour parcourir).
   C'est tout : ils sont rangés au bon endroit et le site est reconstruit
   automatiquement.
3. En bas, vous retrouvez les fichiers en place : **Renommer** (le titre
   affiché sur le site en découle) ou **Supprimer**.

Le back office s'occupe de tout pour vous :

- **Nettoyage des noms** : `Ma Photo Été 2026.JPG` → `ma-photo-ete-2026.jpg`
- **Optimisation** : images redimensionnées à 1400 px au plus (via `sips`,
  fourni par macOS) — le site reste rapide
- **Photos iPhone `.heic`** : converties automatiquement en JPEG (sinon le
  navigateur ne les affiche pas)
- **Aperçu des vidéos** : généré automatiquement à partir de la vidéo
- **Photos du site** : remplacer la photo d'accueil, celle du salon et les
  4 portraits de l'équipe (bouton **« Réinitialiser »** pour revenir au visuel
  de remplacement)
- **Équipe** : modifier les prénoms et les spécialités affichés sous les portraits
- **Avis clients** : ajouter, modifier ou supprimer les témoignages (note en
  étoiles) et ajouter un bouton vers vos avis Google — **uniquement de vrais
  avis, avec l'accord de leurs auteurs**
- **Mise à jour du site** : bouton **« Mettre à jour le site »** (déjà lancée
  après chaque dépôt)

> 🔒 Le back office tourne **uniquement sur votre ordinateur** (adresse
> `localhost`). Rien n'est envoyé sur Internet. Fermez la fenêtre noire pour
> l'arrêter.
>
> En ligne de commande : `node tools/admin.mjs` (ajoutez `--no-open` pour ne
> pas ouvrir le navigateur).

#### Méthode 2 — déposer les fichiers à la main

**Étape 1 — déposer les fichiers**

| Catégorie | Dossier photos | Dossier vidéos |
|---|---|---|
| Coupe dame | `assets/photos/coupe-dame/` | `assets/videos/coupe-dame/` |
| Coiffure homme | `assets/photos/coiffure-homme/` | `assets/videos/coiffure-homme/` |
| Locks & tresses | `assets/photos/locks-tresses/` | `assets/videos/locks-tresses/` |
| Soins du visage | `assets/photos/soins-visage/` | `assets/videos/soins-visage/` |
| Tatouage | `assets/photos/tatouage/` | `assets/videos/tatouage/` |
| Faux ongles | `assets/photos/faux-ongles/` | `assets/videos/faux-ongles/` |

**Étape 2 — mettre le site à jour**

Double-cliquez sur **`Mettre à jour la galerie.command`**, ou en ligne de
commande :

```bash
node tools/galerie.mjs
```

C'est tout. La galerie du site est réécrite avec les nouveaux fichiers.
Pour voir le résultat **sans rien modifier** :

```bash
node tools/galerie.mjs --apercu
```

> 💾 Le script crée automatiquement une sauvegarde `index.html.bak` avant
> chaque modification.

#### Le titre s'affiche tout seul

Il est déduit du nom du fichier :

| Nom du fichier | Titre affiché |
|---|---|
| `tresses-collees.jpg` | Tresses collées |
| `motif-personnalise.jpg` | Motif personnalisé |
| `degrade-net.jpg` | Dégradé net |
| `coupe-brushing.jpg` | Coupe brushing |

Utilisez des mots simples séparés par des tirets, **en minuscules et sans
accents**. Les accents sont rétablis automatiquement pour les mots courants ;
pour en ajouter, complétez la liste `ACCENTS` en haut de `tools/galerie.mjs`.

#### Le cadrage s'adapte à la photo

Le script lit les **dimensions réelles** de chaque fichier et choisit le
format de vignette correspondant : une photo verticale reste verticale, une
photo panoramique s'affiche en panoramique. Aucune découpe arbitraire.

#### Formats conseillés

| | Format | Dimensions | Poids |
|---|---|---|---|
| **Photos** | JPEG ou WebP | 1000 à 1400 px de large | < 300 Ko |
| **Vidéos** | MP4 (H.264) | vertical 1080 × 1920 | < 10 Mo, 10 à 30 s |

> ⚠️ **Le poids est le premier facteur de vitesse.** Une photo de 5 Mo prise au
> téléphone ralentit le site de plusieurs secondes. Réduisez avant de déposer.
> Sur iPhone : Mail → « Taille réelle » ; sur Android : partage → « Redimensionner ».

#### Vidéos : image d'aperçu

Déposez à côté de la vidéo une image portant **le même nom** : elle servira
de vignette.

```
assets/videos/locks-tresses/tresses-collees.mp4   ← la vidéo
assets/videos/locks-tresses/tresses-collees.jpg   ← la vignette
```

Sans vignette, le site affiche une tuile sombre avec un bouton de lecture.
Si vous ne déposez **que la vignette**, le site l'affiche et signale le
fichier vidéo manquant — pratique pour préparer la galerie à l'avance.

#### Retirer une réalisation

Supprimez le fichier du dossier, puis relancez `node tools/galerie.mjs`.

### 3.5 Méthode manuelle (facultative)

La galerie reste du HTML ordinaire, entre les repères
`<!-- GALERIE:DEBUT -->` et `<!-- GALERIE:FIN -->` de `index.html` :

```html
<button class="gallery__item ratio-45" data-cat="locks" data-type="image"
        aria-label="Agrandir : Tresses collées">
  <img src="assets/photos/locks-tresses/tresses-collees.jpg" width="800" height="1000"
       loading="lazy" decoding="async" alt="Tresses collées — réalisation du salon">
  <span class="gallery__cap">Tresses collées</span>
  <span class="gallery__zoom" aria-hidden="true"><svg><use href="#i-zoom"/></svg></span>
</button>
```

- `data-cat` : `dame`, `homme`, `locks`, `visage`, `tatouage` ou `ongles`
- Formats de vignette : `ratio-32`, `ratio-11`, `ratio-45`, `ratio-34`, `ratio-916`

> ⚠️ La prochaine exécution de `tools/galerie.mjs` remplacera tout ce qui se
> trouve entre les deux repères.

### 3.6 Visuels de remplacement

Les fichiers `assets/img/*.svg` (accueil, équipe, à propos) et les vignettes
grises de la galerie sont des **images de remplacement**, pour que le site
soit présentable avant réception des vraies photos.

```bash
node tools/gen-placeholders.mjs
```

Les vignettes grises de la galerie disparaissent dès que vous déposez vos
premières vraies photos (section 3.4).

### 3.7 Le logo

Votre vrai logo est intégré. Il a été **détouré** : le fond blanc d'origine a
été rendu transparent pour qu'il s'affiche proprement sur le thème sombre.

| Fichier | Rôle | Poids |
|---|---|---|
| `logo-sm.webp` | **Utilisé** dans l'en-tête et le pied de page (160 px) | 9 Ko |
| `logo.webp` | **Utilisé** dans la section de contact (463 px) | 41 Ko |
| `logo.png` | Version détourée de référence — sert à générer les WebP et l'image de partage | 311 Ko |
| `logo-original.png` | Votre fichier d'origine, conservé intact | 293 Ko |
| `og-image.jpg` | Image de partage WhatsApp / Facebook (1200 × 630) | 99 Ko |
| `apple-touch-icon.png` | Icône d'écran d'accueil iOS (180 × 180) | 66 Ko |
| `favicon.svg` | Icône d'onglet — version **simplifiée** (voir plus bas) | 5 Ko |

> **Pourquoi du WebP ?** Le même logo en PNG pèse 311 Ko, contre 41 Ko en WebP
> — soit **7 fois moins**. Sur une connexion mobile, c'est la différence entre
> un logo qui s'affiche instantanément et un logo qui arrive après deux
> secondes. Le WebP est reconnu par tous les navigateurs depuis 2020.

**Remplacer le logo par une nouvelle version :**

```bash
cp mon-nouveau-logo.png assets/img/logo-original.png   # 1. le fichier source
node tools/logo-transparent.mjs                        # 2. détourage + WebP
node tools/gen-og.mjs                                  # 3. image de partage
```

Le détourage fait un remplissage **depuis les bords** : les zones blanches
*intérieures* au logo (rayures du poteau de barbier, reflets, liserés du
ruban) sont préservées. Si le résultat est imparfait, le seuil est réglable :

```bash
WHITE_MIN=220 node tools/logo-transparent.mjs   # plus strict (retire moins)
WHITE_MIN=190 node tools/logo-transparent.mjs   # plus agressif (retire plus)
```

La conversion WebP utilise l'outil `cwebp` (paquet `webp`). S'il est absent,
le script le signale et se contente du PNG :

```bash
brew install webp        # macOS
```

**Ce qui reste préférable :** un logo **vectoriel** (`.svg`, `.ai` ou `.eps`).
Demandez-le à votre graphiste : il sera net à toutes les tailles et le
détourage ne sera plus nécessaire.

> ℹ️ **Pourquoi le favicon n'est pas votre logo ?** Un emblème aussi détaillé
> devient une tache illisible dans un onglet de 16 px. `favicon.svg` est donc
> une version simplifiée (couronne + ciseaux croisés sur fond bordeaux),
> générée par `tools/gen-placeholders.mjs`. C'est la pratique standard.
> Votre logo complet sert en revanche pour l'icône iOS, qui est bien plus grande.

> ℹ️ **L'image de partage est un JPG, pas un SVG.** WhatsApp, Facebook et
> LinkedIn ne savent pas lire le SVG : il faut un PNG ou un JPG. C'est le rôle
> de `tools/gen-og.mjs`, qui compose l'image et la compresse (≈ 100 Ko).

---

## 4. Mise en ligne

Le site est entièrement statique : l'hébergement est **gratuit** et très
rapide.

### 4.1 Préparer le dossier à publier ⭐

Double-cliquez sur **`Publier le site.command`** à la racine du projet.

Il crée un dossier **`public/`** contenant **uniquement** ce dont le site a
besoin (`index.html`, `assets/`, `robots.txt`, `sitemap.xml`) : ni les outils
internes, ni le back office, ni les sauvegardes. Le Finder s'ouvre dessus.

C'est ce dossier `public/` — et **jamais** le dossier `salon-coiffure` entier —
qu'il faut déposer chez l'hébergeur.

> 🔁 **Après chaque modification** (nouvelles photos, avis, textes…), relancez
> ce fichier avant de re-publier : il régénère `public/`.

L'adresse du site est mémorisée dans `tools/domaine.txt`. Elle sert à réécrire
automatiquement les liens SEO (`canonical`, Open Graph, `sitemap.xml`,
`robots.txt`) dans la copie publiée, sans jamais toucher aux fichiers
d'origine. Pour la changer :

```bash
node tools/publier.mjs --domaine https://votre-adresse
```

### 4.2 Hébergeurs gratuits

#### Netlify (le plus simple)
1. Créer un compte sur <https://app.netlify.com>
2. Ouvrir <https://app.netlify.com/drop>
3. Glisser-déposer le dossier **`public`**
4. Le site est en ligne en quelques secondes, en HTTPS

Pour choisir l'adresse : *Site configuration → Change site name*
(ex. `zakpa-coiffure` → `https://zakpa-coiffure.netlify.app`).

#### Cloudflare Pages
Glisser-déposer `public` sur <https://pages.cloudflare.com> (adresse
`*.pages.dev`).

#### Vercel
```bash
npm i -g vercel
cd salon-coiffure
vercel --prod public
```

#### GitHub Pages
1. Pousser le contenu de `public/` dans un dépôt GitHub
2. `Settings → Pages → Source : branche main, dossier / (root)`

**Ensuite, indispensable pour le SEO local :**
- Acheter un nom de domaine (ex. `zakpacoiffure.ci`) et le relier à l'hébergeur
- Remplacer `https://www.zakpa-coiffure.ci/` par le domaine réel dans
  `index.html` (balises `canonical`, `og:url`, `og:image`), `robots.txt`
  et `sitemap.xml`
- Créer / compléter la fiche **Google Business Profile** du salon et y
  indiquer le site : c'est la première source de clients pour un commerce local
- Soumettre le sitemap dans **Google Search Console**

---

## 5. Ce qui a été mis en place

| Domaine | Détail |
|---|---|
| **Conversion** | Bouton WhatsApp et bouton d'appel présents dans l'en-tête, l'accueil, chaque service, la section contact, le pied de page, la barre mobile fixe et un bouton flottant |
| **Messages pré-remplis** | Chaque service ouvre WhatsApp avec un message contextualisé |
| **Galerie** | Filtres par catégorie, formats variés, visionneuse plein écran avec navigation clavier (← → Échap) et support vidéo |
| **Back office** | Interface locale (`Back office.command`) pour glisser-déposer, renommer et supprimer les photos/vidéos, les optimiser et reconstruire la galerie en un clic |
| **Publication** | `Publier le site.command` prépare un dossier `public/` propre (sans les outils internes) et réécrit l'adresse du site dans le SEO — prêt à glisser sur un hébergeur gratuit |
| **Horaires** | Badge « Ouvert / Fermé » calculé en temps réel, jour courant mis en évidence |
| **SEO local** | Données structurées `HairSalon` (adresse, téléphone, horaires, services, réseaux), balises Open Graph, `sitemap.xml`, `robots.txt` |
| **Vie privée** | La carte Google Maps n'est chargée qu'au clic : aucun cookie tiers avant consentement |
| **Accessibilité** | Navigation clavier complète, `aria-*` sur les éléments interactifs, lien d'évitement, contrastes élevés, `alt` sur toutes les images |
| **Performance** | Aucune bibliothèque externe, images en `lazy loading`, dimensions déclarées (évite les sauts de mise en page) |
| **Responsive** | Mobile d'abord, barre d'action fixe en bas sur téléphone |
| **Mouvement réduit** | Les animations se désactivent si l'utilisateur le demande dans son système |

---

## 6. Ce qui n'est pas inclus (pistes d'évolution)

- **Véritable calendrier de rendez-vous** avec créneaux disponibles
  (Calendly, Cal.com ou une application dédiée)
- **Formulaire de contact** avec envoi d'e-mail (Netlify Forms, Formspree)
- **Espace client** ou historique des prestations
- **Boutique / vente de produits**
- **Version multilingue** (anglais, roumain…)

Le site a été structuré pour permettre ces ajouts sans tout refaire.

---

## 7. Maintenance en un coup d'œil

| Je veux… | Je fais… |
|---|---|
| **Gérer photos & vidéos** | double-cliquer sur **`Back office.command`** (glisser-déposer, renommer, supprimer) |
| **Publier / rafraîchir le site en ligne** | **`Publier le site.command`** puis glisser le dossier `public/` sur l'hébergeur |
| **Changer une photo d'accueil / du salon / d'équipe** | back office → section **« Photos du site »** → **Remplacer** |
| **Changer un prénom / une spécialité** | back office → section **« Équipe »** → modifier puis **Enregistrer les noms** |
| **Gérer les avis clients** | back office → section **« Avis clients »** (vrais avis uniquement) |
| **Ajouter des photos** | le back office, ou les déposer dans `assets/photos/<catégorie>/` puis `node tools/galerie.mjs` |
| **Ajouter des vidéos** | les déposer dans `assets/videos/<catégorie>/` puis `node tools/galerie.mjs` |
| **Retirer une réalisation** | supprimer le fichier du dossier puis `node tools/galerie.mjs` |
| Changer le numéro de téléphone | `index.html` (rechercher `+2250758123593`) |
| Changer le logo | `assets/img/logo-original.png` puis `node tools/logo-transparent.mjs` |
| Modifier un texte | `index.html` |
| Changer les horaires | `index.html` (tableau `#hours` + pied de page) |
| Changer les couleurs | `assets/css/styles.css` (variables `:root` en haut du fichier) |
| Changer les messages WhatsApp | `index.html` (attributs `data-wa-message`) |

Toute la palette du site est centralisée dans les variables `:root` au début
de `assets/css/styles.css` : modifier `--gold` suffit à changer la couleur
d'accent partout.
