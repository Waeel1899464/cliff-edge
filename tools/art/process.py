"""Turns the AI images in design/art-src into game-ready files in design/art.
  car-body.jpg, wheel.jpg   green screen: removed (soft edge, spill cleaned), cropped, transparent WebP.
                            The car is mirrored to face right (towards the edge); its wheel arches are measured.
  world<N>-bg.jpg           background of world N: WebP, plus where its sea starts and the sea's colour.
  world<N>-rock.jpg         rock face of world N (seamless tile): 512 px WebP.
Files named *-alt-* are kept for comparison only. Writes design/art/art.json.
Usage: python3 tools/art/process.py
"""
import os, json, glob, re
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC, OUT = os.path.join(ROOT, 'design/art-src'), os.path.join(ROOT, 'design/art')
os.makedirs(OUT, exist_ok=True)
SEA_TOP_OVERRIDE = {}      # world -> fraction, if the automatic sea line is ever wrong
# world -> (x in the picture, x on the phone screen), both 0..1: keeps something important in view
# on a narrow phone screen (the picture is wider than the screen). Default: centred.
FOCUS = {4: (0.23, 0.2)}   # the Moon: the Earth stays on screen, upper left

def key_green(path, keep_green=False):
    """Removes the green screen. Only green that is connected to the picture's border is removed
    (flood fill), so green parts of the character itself (the Giant Hill's grass) stay solid.
    Soft edge from the colour distance to the screen colour; green spill cleaned on the edge only."""
    from PIL import ImageDraw
    rgb = Image.open(path).convert('RGB')
    a = np.asarray(rgb).astype(np.float32)
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    key = np.median(border, axis=0)                                # the screen colour
    d = np.sqrt(((a - key) ** 2).sum(-1))
    T1, T2 = 60.0, 115.0
    cand = Image.fromarray(np.where(d < T2, 255, 0).astype(np.uint8), 'L').copy()   # own buffer, so the flood fill sticks
    h, w = d.shape
    for x, y in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]:
        if cand.getpixel((x, y)) == 255: ImageDraw.floodfill(cand, (x, y), 128)
    bg = np.asarray(cand) == 128                                   # screen pixels connected to the border
    alpha = np.where(bg, np.clip((d - T1) / (T2 - T1), 0, 1), 1.0)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    # green spill: on the edge always; everywhere for characters with no green of their own
    # (see-through wind and snow swirls keep a green tint otherwise)
    spill = (alpha < 1) | ((not keep_green) & (g > np.maximum(r, b) + 12))
    g2 = np.where(spill, np.minimum(g, np.maximum(r, b) + 10), g)
    rgba = np.dstack([r, g2, b, alpha * 255]).astype(np.uint8)
    im = Image.fromarray(rgba, 'RGBA')
    return im.crop(im.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox())

def heal_seams(im, band=0.08):
    """Hides a visible seam where the tile meets itself: near each edge the picture is cross-faded
    with a copy shifted by half a tile (whose edges continue across the wrap). Only on the axis that
    needs it (top/bottom or left/right rows differ). Returns the picture and which axes were fixed."""
    a = np.asarray(im).astype(np.float32)
    h, w = a.shape[:2]
    fixed = []
    for axis, n in ((0, h), (1, w)):
        first, last = np.take(a, [0, 1, 2], axis=axis).mean(axis=axis), np.take(a, [n - 3, n - 2, n - 1], axis=axis).mean(axis=axis)
        if np.abs(first.mean(axis=0) - last.mean(axis=0)).max() < 12: continue   # only a clearly visible seam
        rolled = np.roll(a, n // 2, axis=axis)
        t = np.arange(n) / (n - 1)
        m = np.clip(np.minimum(t, 1 - t) / band, 0, 1)            # 0 at the edges, 1 inside
        m = m[:, None, None] if axis == 0 else m[None, :, None]
        a = a * m + rolled * (1 - m)
        fixed.append('vertical' if axis == 0 else 'horizontal')
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)), fixed

def src(name):
    m = [p for p in glob.glob(os.path.join(SRC, name + '.*')) if '-alt-' not in p]
    return m[0] if m else None

info = {'worlds': {}}
car = key_green(src('car-body')).transpose(Image.FLIP_LEFT_RIGHT)
wheel = key_green(src('wheel'))
A = np.asarray(car.getchannel('A')) > 128
H, Wd = A.shape
low = np.array([np.max(np.nonzero(A[:, x])[0]) if A[:, x].any() else -1 for x in range(Wd)])
gap = (H - 1 - low) > H * 0.015
arches, x = [], 0
while x < Wd:
    if gap[x] and low[x] >= 0:
        x0 = x
        while x < Wd and gap[x]: x += 1
        if x - x0 > Wd * 0.08: arches.append((x0, x - 1))
    x += 1
info.update(car_w=Wd, car_h=H, arches=[])
for x0, x1 in arches:
    top = H - 1 - int((H - 1 - low[x0:x1 + 1]).max())
    info['arches'].append({'cx': round((x0 + x1) / 2 / Wd, 4), 'r': round((x1 - x0) / 2 / Wd, 4), 'top': round(top / H, 4)})
car.resize((480, round(480 * H / Wd)), Image.LANCZOS).save(os.path.join(OUT, 'car-body.webp'), quality=88, method=6)
wheel.resize((128, 128), Image.LANCZOS).save(os.path.join(OUT, 'wheel.webp'), quality=88, method=6)

BOSS_NAMES = {1: 'boss1-hill', 2: 'boss2-sandstorm', 3: 'boss3-blizzard', 4: 'boss4-crater', 5: 'boss5-volcano'}
info['bosses'] = {}
for n, name in BOSS_NAMES.items():
    p = src(name)
    if not p: continue
    im = key_green(p, keep_green=(n == 1))       # the Giant Hill is green itself
    k = min(1, 640 / max(im.size))
    im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    im.save(os.path.join(OUT, f'boss{n}.webp'), quality=86, method=6)
    info['bosses'][str(n)] = {'w': im.width, 'h': im.height}

for n in range(1, 6):
    w = {}
    p = src(f'world{n}-bg')
    if p:
        bg = Image.open(p).convert('RGB')
        bg.save(os.path.join(OUT, f'world{n}-bg.webp'), quality=84, method=6)
        b = np.asarray(bg).astype(float)
        rows = np.median(b, axis=1)                                   # one colour per row
        lo, hi = int(len(rows) * 0.5), int(len(rows) * 0.9)
        diff = np.abs(rows[lo + 3:hi] - rows[lo:hi - 3]).sum(1)       # strongest land -> sea change
        top = SEA_TOP_OVERRIDE.get(n) or (lo + 3 + int(np.argmax(diff)) + 2) / len(rows)
        sea = np.median(b[int(len(rows) * (top + 0.04)):, :, :].reshape(-1, 3), axis=0)
        w.update(bg_w=bg.width, bg_h=bg.height, sea_top=round(top, 4), sea=[int(v) for v in sea])
        if n in FOCUS: w['focus'] = list(FOCUS[n])
    p = src(f'world{n}-rock')
    if p:
        rock, fixed = heal_seams(Image.open(p).convert('RGB').resize((512, 512), Image.LANCZOS))
        rock.save(os.path.join(OUT, f'world{n}-rock.webp'), quality=82, method=6)
        w['rock'] = True
        if fixed: w['rock_seams_fixed'] = fixed
    if w: info['worlds'][str(n)] = w
json.dump(info, open(os.path.join(OUT, 'art.json'), 'w'), indent=1)
print(json.dumps(info['worlds'], indent=1))
