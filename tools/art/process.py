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

def key_green(path):
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    greenness = g - np.maximum(r, b)
    alpha = np.clip(1 - (greenness - 40) / 90, 0, 1)
    g2 = np.minimum(g, np.maximum(r, b) + 10)
    rgba = np.dstack([np.stack([r, np.where(alpha < 1, g2, g), b], -1), alpha * 255]).astype(np.uint8)
    im = Image.fromarray(rgba, 'RGBA')
    return im.crop(im.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox())

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
    p = src(f'world{n}-rock')
    if p:
        Image.open(p).convert('RGB').resize((512, 512), Image.LANCZOS).save(os.path.join(OUT, f'world{n}-rock.webp'), quality=82, method=6)
        w['rock'] = True
    if w: info['worlds'][str(n)] = w
json.dump(info, open(os.path.join(OUT, 'art.json'), 'w'), indent=1)
print(json.dumps(info['worlds'], indent=1))
