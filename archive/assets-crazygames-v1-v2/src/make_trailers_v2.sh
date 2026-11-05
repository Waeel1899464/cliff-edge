#!/bin/sh
# Trailer v2: assembles the two v2 trailers from frames captured by capture_trailer_v2.js.
# Portrait 1080x1920: cover (0.5 s) + gameplay. Landscape 1920x1080: cover (0.5 s) + the same
# gameplay centered on the side background the game shows on wide screens. The footage is in the
# DUSK zone (cliffs 6-10), so the landscape background uses the DUSK page colors from index.html.
# The first trailers (without -v2) are not touched.
# Usage: sh make_trailers_v2.sh <frames_dir>
set -e
cd "$(dirname "$0")/.."
FR="$1"
python3 - <<'PY'
from PIL import Image, ImageDraw, ImageFilter
W, H = 1920, 1080
hexs = ['#1d1442', '#a8467a', '#f08a6a', '#1c2e68', '#17285a']      # ZONES[1].page in index.html
c = [tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) for h in hexs]
stops = [(0.0, c[0]), (0.60, c[1]), (0.842, c[2]), (0.844, c[3]), (1.0, c[4])]
def col(t):
    for (a, ca), (b, cb) in zip(stops, stops[1:]):
        if a <= t <= b:
            f = 0 if b == a else (t - a) / (b - a)
            return tuple(int(ca[i] + (cb[i] - ca[i]) * f) for i in range(3))
    return stops[-1][1]
bg = Image.new('RGB', (W, H))
d = ImageDraw.Draw(bg)
for y in range(H):
    d.line([(0, y), (W, y)], fill=col(y / (H - 1)))
bg = Image.alpha_composite(bg.convert('RGBA'), Image.new('RGBA', (W, H), (10, 10, 25, 97)))
gw = round(H * 540 / 960)
sh = Image.new('RGBA', (W, H), (0, 0, 0, 0))
ImageDraw.Draw(sh).rectangle(((W - gw) // 2, 0, (W + gw) // 2, H), fill=(0, 0, 0, 140))
bg = Image.alpha_composite(bg, sh.filter(ImageFilter.GaussianBlur(30)))
bg.convert('RGB').save('src/landscape-bg-dusk.png')
PY
ffmpeg -v error -y -loop 1 -t 0.5 -i src/trailer-open-portrait.png -framerate 30 -i "$FR/%04d.jpg" \
  -filter_complex "[0:v]scale=1080:1920,setsar=1,fps=30,format=yuv420p[a];[1:v]scale=1080:1920,setsar=1,format=yuv420p[b];[a][b]concat=n=2:v=1[v]" \
  -map "[v]" -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -movflags +faststart trailer-portrait-1080x1920-v2.mp4
ffmpeg -v error -y -loop 1 -t 0.5 -i src/trailer-open-landscape.png -loop 1 -i src/landscape-bg-dusk.png -framerate 30 -i "$FR/%04d.jpg" \
  -filter_complex "[0:v]scale=1920:1080,setsar=1,fps=30,format=yuv420p[a];[2:v]scale=608:1080[g];[1:v][g]overlay=(W-w)/2:0:shortest=1,setsar=1,fps=30,format=yuv420p[b];[a][b]concat=n=2:v=1[v]" \
  -map "[v]" -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -movflags +faststart trailer-landscape-1920x1080-v2.mp4
echo done
