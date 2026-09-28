#!/bin/bash
# ============================================================================
#  ZAKPA COIFFURE — Ajouter des photos et des vidéos au site
#
#  Double-cliquez sur ce fichier. C'est tout.
#  Il ouvre le dossier des photos, puis met le site à jour automatiquement.
# ============================================================================

cd "$(dirname "$0")" || exit 1

# --- Retrouver une version récente de Node ----------------------------------
# (l'ordinateur utilise nvm ; on cherche donc la meilleure version disponible)
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
echo "  ║         ZAKPA COIFFURE — Mise à jour de la galerie         ║"
echo "  ╚════════════════════════════════════════════════════════════╝"
echo ""

NODE=$(trouver_node)
if [ -z "$NODE" ]; then
  echo "  ❌  Node.js n'a pas été trouvé sur cet ordinateur."
  echo ""
  echo "      Installez-le depuis https://nodejs.org"
  echo "      puis double-cliquez à nouveau sur ce fichier."
  echo ""
  echo "  ────────────────────────────────────────────────────────────"
  echo "  Appuyez sur ENTRÉE pour fermer."
  read -r _
  exit 1
fi

echo "  ÉTAPE 1 — Ouverture du dossier de vos photos."
echo ""
echo "     Déposez vos photos dans le bon sous-dossier :"
echo ""
echo "        coupe-dame          coiffure-homme"
echo "        locks-tresses       soins-visage"
echo "        tatouage            faux-ongles"
echo ""
echo "     Pour les VIDÉOS : même principe, dans le dossier « videos »."
echo "     (ajoutez une image du même nom pour l'aperçu : voir le README)"
echo ""
echo "  ────────────────────────────────────────────────────────────"
echo "  Quand vos fichiers sont en place, appuyez sur ENTRÉE."
echo ""
read -r _

clear
echo ""
echo "  ÉTAPE 2 — Mise à jour du site…"
echo ""
echo "  ────────────────────────────────────────────────────────────"
echo ""

"$NODE" tools/galerie.mjs

echo ""
echo "  ────────────────────────────────────────────────────────────"
echo "  Appuyez sur ENTRÉE pour fermer cette fenêtre."
echo ""
read -r _
