#!/bin/sh
# Assembles the two trailers from captured gameplay frames (capture_trailer.js).
# Portrait 1080x1920: cover (1 s) + gameplay.  Landscape 1920x1080: cover (1 s) + the same gameplay
# centered on the side background the game itself shows on wide screens (see body CSS in index.html).
# Usage: sh make_trailers.sh <frames_dir>
set -e
cd "$(dirname "$0")/.."
FR="$1"
python3 - <<'PY'
from PIL import Image, ImageDraw, ImageFilter
W, H = 1920, 1080
stops = [(0.0, (42, 31, 92)), (0.60, (255, 122, 89)), (0.842, (255, 179, 107)), (0.844, (31, 61, 122)), (1.0, (26, 52, 104))]
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
dark = Image.new('RGBA', (W, H), (10, 10, 25, 97))          # same 0.38 darkening as the game page
bg = Image.alpha_composite(bg.convert('RGBA'), dark)
gw = round(H * 540 / 960)                                     # game area 608x1080
sh = Image.new('RGBA', (W, H), (0, 0, 0, 0))
ImageDraw.Draw(sh).rectangle(((W - gw) // 2, 0, (W + gw) // 2, H), fill=(0, 0, 0, 140))
bg = Image.alpha_composite(bg, sh.filter(ImageFilter.GaussianBlur(30)))
bg.convert('RGB').save('src/landscape-bg.png')
print('game area width', gw)
PY
ffmpeg -v error -y -loop 1 -t 1 -i src/trailer-open-portrait.png -framerate 30 -i "$FR/%04d.jpg" \
  -filter_complex "[0:v]scale=1080:1920,setsar=1,fps=30,format=yuv420p[a];[1:v]scale=1080:1920,setsar=1,format=yuv420p[b];[a][b]concat=n=2:v=1[v]" \
  -map "[v]" -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -movflags +faststart trailer-portrait-1080x1920.mp4
ffmpeg -v error -y -loop 1 -t 1 -i src/trailer-open-landscape.png -loop 1 -i src/landscape-bg.png -framerate 30 -i "$FR/%04d.jpg" \
  -filter_complex "[0:v]scale=1920:1080,setsar=1,fps=30,format=yuv420p[a];[2:v]scale=608:1080[g];[1:v][g]overlay=(W-w)/2:0:shortest=1,setsar=1,fps=30,format=yuv420p[b];[a][b]concat=n=2:v=1[v]" \
  -map "[v]" -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -movflags +faststart trailer-landscape-1920x1080.mp4
echo done
