#!/bin/bash
# ============================================================================
#  ZAKPA COIFFURE — Back office (photos & vidéos)
#
#  Double-cliquez sur ce fichier. Une page s'ouvre dans votre navigateur :
#  glissez-y vos photos et vidéos, le site se met à jour tout seul.
#
#  Laissez cette fenêtre ouverte pendant que vous travaillez.
#  Pour arrêter le back office : fermez cette fenêtre (ou Ctrl + C).
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
echo "  ║        ZAKPA COIFFURE — Back office photos & vidéos        ║"
echo "  ╚════════════════════════════════════════════════════════════╝"
echo ""

# --- Récupérer d'abord les changements faits depuis le back office en ligne ---
if command -v git >/dev/null 2>&1 && [ -d .git ]; then
  echo "  ⏳  Récupération des derniers changements en ligne…"
  if ! git pull -q --rebase --autostash origin main 2>/dev/null; then
    git rebase --abort 2>/dev/null
    echo "  ⚠️   Impossible de récupérer les changements en ligne (pas d'Internet ?)."
    echo "      Vous pouvez continuer, mais prévenez votre webmaster si cela se répète."
  fi
fi

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

# Le serveur affiche l'adresse et ouvre le navigateur tout seul.
"$NODE" tools/admin.mjs

echo ""
echo "  ────────────────────────────────────────────────────────────"
echo "  Back office fermé."
echo "  Appuyez sur ENTRÉE pour fermer cette fenêtre."
read -r _
