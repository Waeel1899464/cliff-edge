#!/bin/sh
# Builds every page of Cliff Edge V3 from the one game file (index.html).
# index.html is written as page content for claude.ai, which adds the page frame itself;
# the other pages get their frame (doctype, phone viewport, share tags) added here.
#
#   ./build.sh crazygames-v3   -> platform/crazygames-v3/index.html   (the file uploaded to CrazyGames)
#   ./build.sh web-v3          -> platform/web-v3/index.html          (website version, with tracking; staging copy)
#   ./build.sh web             -> docs/index.html                     (PUBLISH STEP ONLY: same file as web-v3)
#   ./build.sh test-run        -> test-build/index.html               (Cliff Run v0 experiment: both modes, test analytics)
#   ./build.sh artifact-v3 F   -> F  (private claude.ai test page of the CrazyGames build)
#   ./build.sh artifact-web F  -> F  (private claude.ai test page of the website build)
# Old V1/V2 build targets live on the branches backup/cg-stable-a7 (V1) and feature/fair-precision (V2).
set -e
cd "$(dirname "$0")"
TARGET="${1:-}"
USAGE="use: crazygames-v3 | web-v3 | web | test-run | artifact-v3 <file> | artifact-web <file>"
[ -z "$TARGET" ] && { echo "$USAGE"; exit 1; }

# The game file with its images put in (design/art/art-data.js replaces the ART-DATA line).
# Without that file the game keeps its original drawings.
game() {
  if [ -f design/art/art-data.js ]; then
    awk 'FNR==NR { art = art $0 "\n"; next } /\/\/ ART-DATA:/ { printf "%s", art; next } { print }' design/art/art-data.js index.html
  else cat index.html; fi
}

# Storage: CrazyGames build saves under cg3_, website build under w3_. V1 saves on players' phones are
# never read, moved or deleted: website players start V3 fresh (owner's decision, 2026-11-05).
CG_LINE="<script>window.CLIFF_BUILD = 'crazygames'; window.CLIFF_STORE_PREFIX = 'cg3_';</script>"
WEB_LINE="<script>window.CLIFF_STORE_PREFIX = 'w3_'; window.CLIFF_VERSION = 'v3';</script>"
# Cliff Run test build: own saves (tr_), analytics ids ra- (link opens Cliff Run first) or sa- (Story first),
# not indexed by search engines. Never written over the website or the CrazyGames files.
TEST_LINE="<meta name=\"robots\" content=\"noindex\"><script>window.CLIFF_TEST = true; window.CLIFF_STORE_PREFIX = 'tr_'; window.CLIFF_VERSION = /[?&]first=story/.test(location.search) ? 'sa' : 'ra';</script>"

# Private test pages on claude.ai: the game file with a build line, without its first title line
# and the claude-only viewport meta (claude.ai adds its own frame).
if [ "$TARGET" = "artifact-v3" ] || [ "$TARGET" = "artifact-web" ]; then
  [ -z "$2" ] && { echo "$USAGE"; exit 1; }
  if [ "$TARGET" = "artifact-v3" ]; then T="Cliff Edge Worlds"; L="$CG_LINE"; else T="Cliff Edge Web V3"; L="$WEB_LINE"; fi
  { echo "<title>$T</title>"; echo "$L"; game | sed '1d' | grep -v 'claude:viewport-fit-sides'; } > "$2"
  echo "built $2"
  exit 0
fi

# V3 worlds builds (feature/worlds): own storage prefix cg3_, so they never touch any other saves.
#   ./build.sh crazygames-v3 -> platform/crazygames-v3/index.html
# (No public preview page: testing uses the private claude.ai link, built with artifact-v3.)
if [ "$TARGET" = "crazygames-v3" ]; then
  OUT=platform/crazygames-v3
  mkdir -p "$OUT"
  "$0" crazygames-stdout | sed "s#<script>window.CLIFF_BUILD = 'crazygames';</script>#$CG_LINE#" > "$OUT/index.html"
  echo "built $OUT/index.html"
  exit 0
fi

if [ "$TARGET" = "crazygames-stdout" ]; then
  {
  cat <<'HEAD'
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#12141f">
<title>Cliff Edge</title>
<style>
*,*::before,*::after{box-sizing:border-box}
:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
body{margin:0;font:14px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
[hidden]{display:none!important}
</style>
<script>window.CLIFF_BUILD = 'crazygames';</script>
</head>
<body>
HEAD
  game
  printf '\n</body>\n</html>\n'
  }
  exit 0
fi

LINE="$WEB_LINE"
if [ "$TARGET" = "web-v3" ]; then OUT=platform/web-v3/index.html
elif [ "$TARGET" = "web" ]; then OUT=docs/index.html
elif [ "$TARGET" = "test-run" ]; then OUT=test-build/index.html; LINE="$TEST_LINE"
else echo "unknown target: $TARGET ($USAGE)"; exit 1; fi

# ---------------------------------------------------------------------------
# Website build (GitHub Pages). web-v3 writes a staging copy; web writes the published file.
# ---------------------------------------------------------------------------
mkdir -p "$(dirname "$OUT")"
{
cat <<'HEAD'
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#12141f">
<meta name="description" content="Hold to drive, let go to stop. How close to the cliff edge can you stop?">
<meta property="og:title" content="Cliff Edge">
<meta property="og:description" content="Hold to drive, let go to stop. How close to the cliff edge can you stop?">
<meta property="og:type" content="website">
<meta property="og:url" content="https://waeel1899464.github.io/cliff-edge/">
<meta property="og:image" content="https://waeel1899464.github.io/cliff-edge/preview.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="A worried pink car stopping at the edge of a cliff">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="https://waeel1899464.github.io/cliff-edge/preview.jpg">
<meta name="apple-mobile-web-app-capable" content="yes">
<style>
*,*::before,*::after{box-sizing:border-box}
:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
body{margin:0;font:14px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
[hidden]{display:none!important}
</style>
HEAD
echo "$LINE"
printf '</head>\n<body>\n'
game
printf '\n</body>\n</html>\n'
} > "$OUT"
[ "$TARGET" = "web" ] && touch docs/.nojekyll
echo "built $OUT"
