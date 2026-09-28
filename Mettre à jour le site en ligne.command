#!/bin/bash
# ============================================================================
#  ZAKPA COIFFURE — Mettre le site à jour en ligne
#
#  Double-cliquez sur ce fichier après avoir modifié le site (photos, avis,
#  textes…). Il s'occupe de tout, dans le bon ordre :
#
#     1. reconstruit la galerie depuis vos fichiers
#     2. régénère le dossier « public/ » prêt à publier
#     3. enregistre et envoie sur GitHub
#
#  Netlify republie alors le site automatiquement (compte une à deux minutes).
#
#  Raccourci : « Mettre à jour le site en ligne.command » fait la même chose
#  sans passer par le terminal.
# ============================================================================

cd "$(dirname "$0")" || exit 1

# --- Retrouver une version récente de Node ----------------------------------
trouver_node() {
  local candidats=() f c v
  c=$(command -v node 2>/dev/null) && candidats+=("$c")
  candidats+=("$HOME/.nvm/versions/node/v22.21.1/bin/node")
  candidats+=("$HOME/.nvm/versions/node/v20.20.2/bin/node")
  for f in "$HOME"/.nvm/versions/node/*/bin/node; do
    [ -x "$f" ] && candidats+=("$f")
  done
  candidats+=("/opt/homebrew/bin/node" "/usr/local/bin/node")

  for c in "${candidats[@]}"; do
    [ -x "$c" ] || continue
    v=$("$c" -e 'process.stdout.write(String(process.versions.node.split(".")[0]))' 2>/dev/null)
    if [ -n "$v" ] && [ "$v" -ge 18 ] 2>/dev/null; then
      echo "$c"
      return 0
    fi
  done
  return 1
}

clear
echo ""
echo "  ╔════════════════════════════════════════════════════════════╗"
echo "  ║       ZAKPA COIFFURE — Mise à jour du site en ligne        ║"
echo "  ╚════════════════════════════════════════════════════════════╝"
echo ""

NODE=$(trouver_node)
if [ -z "$NODE" ]; then
  echo "  ❌  Node.js n'a pas été trouvé sur cet ordinateur."
  echo "      Installez-le depuis https://nodejs.org puis réessayez."
  echo ""
  read -r _
  exit 1
fi

echo "  ────────────────────────────────────────────────────────────"
echo "  ÉTAPE 1/3 — Galerie"
echo ""
"$NODE" tools/galerie.mjs || { echo ""; echo "  ❌  Échec de la galerie."; read -r _; exit 1; }

echo ""
echo "  ────────────────────────────────────────────────────────────"
echo "  ÉTAPE 2/3 — Dossier à publier"
echo ""
"$NODE" tools/publier.mjs || { echo ""; echo "  ❌  Échec de la préparation."; read -r _; exit 1; }

echo ""
echo "  ────────────────────────────────────────────────────────────"
echo "  ÉTAPE 3/3 — Envoi sur GitHub"
echo ""

if ! command -v git >/dev/null 2>&1 || [ ! -d .git ]; then
  echo "  ❌  Git indisponible : envoi impossible."
  echo ""
  read -r _
  exit 1
fi

if [ -z "$(git status --porcelain)" ]; then
  echo "  ✓  Aucun changement : le site en ligne est déjà à jour."
  echo ""
  read -r _
  exit 0
fi

git status --short | sed 's/^/    /'
echo ""

DEFAUT="Mise à jour du $(date '+%d/%m/%Y à %H:%M')"
printf "  Message (Entrée = « %s ») : " "$DEFAUT"
read -r MSG
[ -z "$MSG" ] && MSG="$DEFAUT"

echo ""
git add -A && git commit -q -m "$MSG" || { echo "  ❌  Échec de l'enregistrement."; read -r _; exit 1; }

SORTIE=$(git push 2>&1)
CODE=$?
echo "$SORTIE" | sed 's/^/    /'
echo ""

if [ "$CODE" -eq 0 ]; then
  echo "  ✅  Envoyé ! Netlify republie le site automatiquement."
  echo ""
  echo "      Comptez une à deux minutes, puis ouvrez :"
  grep -q . tools/domaine.txt 2>/dev/null && sed 's/^/      /' tools/domaine.txt
else
  echo "  ❌  L'envoi a échoué (connexion Internet ?)."
fi

echo ""
echo "  ────────────────────────────────────────────────────────────"
echo "  Appuyez sur ENTRÉE pour fermer."
read -r _
