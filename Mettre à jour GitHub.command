#!/bin/bash
# ============================================================================
#  ZAKPA COIFFURE — Enregistrer et envoyer sur GitHub
#
#  Double-cliquez sur ce fichier : il enregistre vos modifications et les
#  envoie sur votre dépôt GitHub privé (sinafou2507/zakpa-coiffure).
#
#  À utiliser après avoir modifié le site (photos, avis, textes…).
# ============================================================================

cd "$(dirname "$0")" || exit 1

clear
echo ""
echo "  ╔════════════════════════════════════════════════════════════╗"
echo "  ║          ZAKPA COIFFURE — Envoi vers GitHub                ║"
echo "  ╚════════════════════════════════════════════════════════════╝"
echo ""

if ! command -v git >/dev/null 2>&1; then
  echo "  ❌  Git n'est pas installé sur cet ordinateur."
  echo "      Installez-le depuis https://git-scm.com/download/mac"
  echo ""
  read -r _
  exit 1
fi

if [ ! -d .git ] || ! git remote get-url origin >/dev/null 2>&1; then
  echo "  ❌  Ce dossier n'est pas relié à un dépôt GitHub."
  echo ""
  read -r _
  exit 1
fi

# --- Y a-t-il des changements ? --------------------------------------------
if [ -z "$(git status --porcelain)" ]; then
  echo "  ✓  Aucun changement : tout est déjà enregistré sur GitHub."
  echo ""
  echo "     https://github.com/sinafou2507/zakpa-coiffure"
  echo ""
  read -r _
  exit 0
fi

echo "  Modifications détectées :"
echo ""
git status --short | sed 's/^/    /'
echo ""

MSG="$1"
if [ -z "$MSG" ]; then
  DEFAUT="Mise à jour du $(date '+%d/%m/%Y à %H:%M')"
  printf "  Message (Entrée = « %s ») : " "$DEFAUT"
  read -r MSG
  [ -z "$MSG" ] && MSG="$DEFAUT"
fi

echo ""
echo "  ────────────────────────────────────────────────────────────"
echo "  Enregistrement…"

if ! git add -A; then
  echo "  ❌  Échec de l'ajout des fichiers."
  read -r _
  exit 1
fi
if ! git commit -q -m "$MSG"; then
  echo "  ❌  Échec de l'enregistrement."
  read -r _
  exit 1
fi

echo "  Envoi vers GitHub…"
echo ""

SORTIE=$(git push 2>&1)
CODE=$?
echo "$SORTIE" | sed 's/^/    /'
echo ""

if [ "$CODE" -eq 0 ]; then
  echo "  ✅  Envoyé sur GitHub :"
  echo "      https://github.com/sinafou2507/zakpa-coiffure"
else
  echo "  ❌  L'envoi a échoué."
  echo "      Vérifiez votre connexion Internet, puis réessayez."
  echo "      (Le dépôt GitHub est peut-être aussi en lecture seule.)"
fi

echo ""
echo "  ────────────────────────────────────────────────────────────"
echo "  Appuyez sur ENTRÉE pour fermer."
read -r _
