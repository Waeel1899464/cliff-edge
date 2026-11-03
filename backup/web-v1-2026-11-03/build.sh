#!/bin/sh
# Builds the public web version (docs/index.html) from the game file (index.html).
# index.html is written as page content for claude.ai, which adds the page frame itself;
# the public version needs that frame (doctype, phone viewport, share preview tags) added here.
set -e
cd "$(dirname "$0")"
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
