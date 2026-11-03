#!/bin/sh
# Builds the public web versions from the game files:
#   index.html        -> docs/index.html        (Cliff Edge)
#   merge/index.html  -> docs/merge/index.html  (Merge Anything)
# The game files are written as page content for claude.ai, which adds the page frame itself;
# the public versions need that frame (doctype, phone viewport, share preview tags) added here.
set -e
cd "$(dirname "$0")"
mkdir -p docs docs/merge

# page <source> <output> <title> <description> <url> <image> <image-alt> <theme-color>
page() {
{
cat <<HEAD
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="$8">
<meta name="description" content="$4">
<meta property="og:title" content="$3">
<meta property="og:description" content="$4">
<meta property="og:type" content="website">
<meta property="og:url" content="$5">
<meta property="og:image" content="$6">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="$7">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="$6">
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
cat "$1"
printf '\n</body>\n</html>\n'
} > "$2"
echo "built $2"
}

page index.html docs/index.html "Cliff Edge" \
  "Hold to drive, let go to stop. How close to the cliff edge can you stop?" \
  "https://waeel1899464.github.io/cliff-edge/" \
  "https://waeel1899464.github.io/cliff-edge/preview.jpg" \
  "A worried pink car stopping at the edge of a cliff" "#12141f"

page merge/index.html docs/merge/index.html "Merge Anything" \
  "Drop things into Gulp the jar. Same size things fuse into something new. Can you make something nobody in the world has made?" \
  "https://waeel1899464.github.io/cliff-edge/merge/" \
  "https://waeel1899464.github.io/cliff-edge/merge/preview.jpg" \
  "Gulp, a glass jar with googly eyes, full of round emoji stickers" "#f3e9d8"

touch docs/.nojekyll
