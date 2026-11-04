#!/bin/sh
# Builds the public web version (docs/index.html) from the game file (index.html).
# index.html is written as page content for claude.ai, which adds the page frame itself;
# the public version needs that frame (doctype, phone viewport, share preview tags) added here.
set -e
cd "$(dirname "$0")"
TARGET="${1:-web}"

# ---------------------------------------------------------------------------
# Platform build (CrazyGames): ./build.sh crazygames -> platform/crazygames/index.html
# Same game source. The line `window.CLIFF_BUILD = 'crazygames'` switches off what platforms
# do not allow (external links, clip sharing, friend challenge links, event tracking).
# The web version on GitHub Pages is NOT touched by this target.
# ---------------------------------------------------------------------------
# Experimental v2 builds (feature/fair-precision): same platform page, plus their own storage
# prefix (cg2_) so they never read or change the saves of the web game or of the first preview.
#   ./build.sh crazygames-v2 -> platform/crazygames-v2/index.html
#   ./build.sh preview-v2    -> docs/crazygames-preview-v2/index.html (identical file)
if [ "$TARGET" = "crazygames-v2" ] || [ "$TARGET" = "preview-v2" ]; then
  if [ "$TARGET" = "crazygames-v2" ]; then OUT=platform/crazygames-v2; else OUT=docs/crazygames-preview-v2; fi
  mkdir -p "$OUT"
  "$0" crazygames-stdout | sed "s#<script>window.CLIFF_BUILD = 'crazygames';</script>#<script>window.CLIFF_BUILD = 'crazygames'; window.CLIFF_STORE_PREFIX = 'cg2_';</script>#" > "$OUT/index.html"
  echo "built $OUT/index.html"
  exit 0
fi

# V3 worlds builds (feature/worlds): own storage prefix cg3_, so they never touch any other saves.
#   ./build.sh crazygames-v3 -> platform/crazygames-v3/index.html
#   ./build.sh preview-v3    -> docs/crazygames-preview-v3/index.html (identical file)
if [ "$TARGET" = "crazygames-v3" ] || [ "$TARGET" = "preview-v3" ]; then
  if [ "$TARGET" = "crazygames-v3" ]; then OUT=platform/crazygames-v3; else OUT=docs/crazygames-preview-v3; fi
  mkdir -p "$OUT"
  "$0" crazygames-stdout | sed "s#<script>window.CLIFF_BUILD = 'crazygames';</script>#<script>window.CLIFF_BUILD = 'crazygames'; window.CLIFF_STORE_PREFIX = 'cg3_';</script>#" > "$OUT/index.html"
  echo "built $OUT/index.html"
  exit 0
fi

if [ "$TARGET" = "crazygames" ] || [ "$TARGET" = "crazygames-stdout" ]; then
  [ "$TARGET" = "crazygames" ] && mkdir -p platform/crazygames
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
  cat index.html
  printf '\n</body>\n</html>\n'
  } > "$( [ "$TARGET" = "crazygames" ] && echo platform/crazygames/index.html || echo /dev/stdout )"
  [ "$TARGET" = "crazygames" ] && echo "built platform/crazygames/index.html"
  exit 0
fi

if [ "$TARGET" != "web" ]; then echo "unknown target: $TARGET (use: web | crazygames | crazygames-v2 | preview-v2 | crazygames-v3 | preview-v3)"; exit 1; fi

# ---------------------------------------------------------------------------
# Web build (GitHub Pages): ./build.sh  or  ./build.sh web  -> docs/index.html
# ---------------------------------------------------------------------------
mkdir -p docs
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
</head>
<body>
HEAD
cat index.html
printf '\n</body>\n</html>\n'
} > docs/index.html
touch docs/.nojekyll
echo "built docs/index.html"
