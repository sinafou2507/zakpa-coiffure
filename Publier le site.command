#!/bin/bash
# ============================================================================
#  ZAKPA COIFFURE — Publier le site en ligne
#
#  Double-cliquez sur ce fichier : il prépare un dossier « public » propre
#  (sans les outils internes) et l'ouvre dans le Finder.
#
#  Il ne reste plus qu'à glisser ce dossier « public » sur l'hébergeur
#  (voir README.md → « Mise en ligne »).
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
echo "  ║          ZAKPA COIFFURE — Publication du site              ║"
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

"$NODE" tools/publier.mjs || { echo ""; read -r _; exit 1; }

open public

echo "  ────────────────────────────────────────────────────────────"
echo "  Le dossier « public » est ouvert."
echo ""
echo "  Prochaine étape :"
echo "    1. Allez sur votre hébergeur (ex. https://app.netlify.com/drop)"
echo "    2. Glissez-y le dossier « public »"
echo "    3. Votre site est en ligne en quelques secondes"
echo ""
echo "  Appuyez sur ENTRÉE pour fermer."
read -r _
