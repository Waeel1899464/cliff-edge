#!/bin/sh
# Builds the public web version of Merge Anything (public/index.html) from index.html.
# Separate from Cliff Edge: this script only touches the merge/ folder.
set -e
cd "$(dirname "$0")"
mkdir -p public
{
cat <<'HEAD'
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#f3e9d8">
<meta name="description" content="Drop things into Gulp the jar. Same size things fuse into something new. Can you make something nobody in the world has made?">
<meta property="og:title" content="Merge Anything">
<meta property="og:description" content="Drop things into Gulp the jar. Same size things fuse into something new. Can you make something nobody in the world has made?">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
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
} > public/index.html
echo "built merge/public/index.html"
