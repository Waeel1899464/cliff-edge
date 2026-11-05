#!/bin/sh
# Checks that the published and kept files have not changed by a single byte.
#   - docs/index.html, docs/crazygames-preview*/ : the copies of what is live on the website
#   - dist/crazygames-v3-submitted-2026-11-05.html : the exact file sent to CrazyGames
#   - archive/ : old packages and videos
# Also checks that the live branch (main) still serves the same website files.
# Usage: sh tools/check-protected.sh
cd "$(dirname "$0")/.."
sha256sum -c --quiet tools/protected.sha256 || { echo "CHANGED: see the lines above"; exit 1; }
for f in docs/index.html docs/crazygames-preview/index.html docs/crazygames-preview-v2/index.html; do
  want=$(grep " $f\$" tools/protected.sha256 | cut -c1-64)
  got=$(git show "main:$f" 2>/dev/null | sha256sum | cut -c1-64)
  [ "$want" = "$got" ] || { echo "main: $f differs from the protected copy"; exit 1; }
done
echo "protected files unchanged"
