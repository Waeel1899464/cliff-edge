"""V3 CrazyGames trailers: edits the scenes captured by capture_trailer_v3.js into two videos.

CrazyGames rules followed: 15-20 s, no sound, no black bars, no mouse cursor, no "Play Now" or other
promotional text, no app/social icons, no fast-forward (every scene plays in real time). The only
text is the game's own interface, plus the title on the opening frame (the V3 cover art).

Portrait 1080x1920: the game at full size. Landscape 1920x1080: the game on the left and a large
live close-up of the same footage on the right, over the world's own colours (no black bars).
Usage: python3 compose_trailer_v3.py <frames_dir> <out_dir>
"""
import json, os, subprocess, sys
from PIL import Image, ImageDraw, ImageFilter

FR, OUT = sys.argv[1], sys.argv[2]
HERE = os.path.dirname(os.path.abspath(__file__))
os.makedirs(OUT, exist_ok=True)

# (scene, frames before the stop/fall, frames after, world look for the landscape background)
SCENES = [('s1_hill_final', 40, 35, 1), ('s2_sandstorm', 50, 30, 2), ('s3_blizzard', 55, 28, 3),
          ('s4_moon_fall', 25, 60, 4), ('s5_volcano_edge', 45, 30, 5), ('s6_final_hit', 40, 60, 5)]
PAGE = {1: ('#2a6fc4', '#6cb6ee'), 2: ('#d9672e', '#f5a35a'), 3: ('#2c3561', '#5d6a9c'), 4: ('#03040a', '#1a1e3a'), 5: ('#1c0a10', '#b9421e')}
OPEN, XFADE = 15, 5          # 0.5 s opening on the cover art, short cross-fade into the action

def hexrgb(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))

def rounded(w, h, r):
    m = Image.new('L', (w, h), 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, w - 1, h - 1), r, fill=255); return m

LW, LH = 1920, 1080
GAME = (100, 40, 562, 1000)          # x, y, w, h
CLOSE = (712, 40, 1108, 1000)
GM, CM = rounded(GAME[2], GAME[3], 26), rounded(CLOSE[2], CLOSE[3], 26)

def background(world):
    a, b = [tuple(int(c * 0.45) for c in hexrgb(x)) for x in PAGE[world]]
    bg = Image.new('RGB', (LW, LH)); d = ImageDraw.Draw(bg)
    for y in range(LH):
        t = y / (LH - 1); d.line([(0, y), (LW, y)], fill=tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3)))
    bg = bg.convert('RGBA')
    sh = Image.new('RGBA', (LW, LH), (0, 0, 0, 0)); sd = ImageDraw.Draw(sh)
    for (x, y, w, h) in (GAME, CLOSE): sd.rounded_rectangle((x + 6, y + 14, x + w + 6, y + h + 14), 26, fill=(0, 0, 0, 150))
    bg.alpha_composite(sh.filter(ImageFilter.GaussianBlur(18)))
    return bg
BGS = {w: background(w) for w in PAGE}

def landscape(frame, world, cy):
    out = BGS[world].copy()
    g = frame.resize(GAME[2:], Image.LANCZOS); g.putalpha(GM); out.alpha_composite(g, GAME[:2])
    cw, ch = 860, int(860 * CLOSE[3] / CLOSE[2])          # crop with the close-up's own shape
    top = int(max(0, min(1920 - ch, cy - ch / 2)))
    c = frame.crop((110, top, 110 + cw, top + ch)).resize(CLOSE[2:], Image.LANCZOS); c.putalpha(CM)
    out.alpha_composite(c, CLOSE[:2])
    return out

def encoder(path, w, h):
    return subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{w}x{h}', '-r', '30', '-i', '-',
                             '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path],
                            stdin=subprocess.PIPE)

P_OUT = os.path.join(OUT, 'trailer-portrait-1080x1920-v3.mp4')
L_OUT = os.path.join(OUT, 'trailer-landscape-1920x1080-v3.mp4')
ep, el = encoder(P_OUT, 1080, 1920), encoder(L_OUT, LW, LH)
op = Image.open(os.path.join(HERE, 'trailer-end-portrait.png')).convert('RGBA')
ol = Image.open(os.path.join(HERE, 'trailer-end-landscape.png')).convert('RGBA')
count = 0
for i in range(OPEN):
    ep.stdin.write(op.convert('RGB').tobytes()); el.stdin.write(ol.convert('RGB').tobytes()); count += 1
first = True
for sid, before, after, world in SCENES:
    log = json.load(open(os.path.join(FR, sid, 'log.json')))
    end = next(i for i, x in enumerate(log) if x['st'] == 'stopped' or x['st'] == 'falling')
    a, b = max(0, end - before), min(len(log), end + after)
    cy = 1215
    for n in range(a, b):
        f = Image.open(os.path.join(FR, sid, '%04d.jpg' % n)).convert('RGBA')
        target = 1330 if log[n]['st'] in ('falling', 'fell') else 1215   # below the game's text rows
        cy += (target - cy) * 0.12
        p, l = f, landscape(f, world, cy)
        if first and n - a < XFADE:              # cross-fade from the opening frame
            t = (n - a + 1) / (XFADE + 1); p = Image.blend(op, p, t); l = Image.blend(ol, l, t)
        ep.stdin.write(p.convert('RGB').tobytes()); el.stdin.write(l.convert('RGB').tobytes()); count += 1
    first = False
for e in (ep, el): e.stdin.close(); e.wait()
print('frames', count, '=', round(count / 30, 2), 's'); print(P_OUT); print(L_OUT)
