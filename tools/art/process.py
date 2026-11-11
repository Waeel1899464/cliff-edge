"""Turns the AI images in design/art-src into game-ready files in design/art.
Green-screen images: the green is removed (soft edge, green spill cleaned), cropped, and saved as
transparent WebP. The car is mirrored so it faces right (towards the cliff edge).
Prints the car's wheel-arch positions so the game can put the wheels in them.
Usage: python3 tools/art/process.py
"""
import os, json
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC, OUT = os.path.join(ROOT, 'design/art-src'), os.path.join(ROOT, 'design/art')
os.makedirs(OUT, exist_ok=True)

def key_green(path):
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    greenness = g - np.maximum(r, b)                       # high on the green screen
    alpha = np.clip(1 - (greenness - 40) / 90, 0, 1)       # soft edge between 40 and 130
    # spill: pull green down to the other channels near the edge
    g2 = np.minimum(g, np.maximum(r, b) + 10)
    rgb = np.stack([r, np.where(alpha < 1, g2, g), b], -1)
    rgba = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    im = Image.fromarray(rgba, 'RGBA')
    return im.crop(im.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox())

car = key_green(os.path.join(SRC, 'car-body.jpg')).transpose(Image.FLIP_LEFT_RIGHT)
wheel = key_green(os.path.join(SRC, 'wheel.jpg'))

# wheel arches: columns where the lowest solid pixel is well above the bottom of the body
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
info = {'car_w': Wd, 'car_h': H, 'arches': []}
for x0, x1 in arches:
    top = H - 1 - int((H - 1 - low[x0:x1 + 1]).max())     # highest point of the arch opening
    cx, r = (x0 + x1) / 2, (x1 - x0) / 2
    info['arches'].append({'cx': round(cx / Wd, 4), 'r': round(r / Wd, 4), 'top': round(top / H, 4)})

car.resize((480, round(480 * H / Wd)), Image.LANCZOS).save(os.path.join(OUT, 'car-body.webp'), quality=88, method=6)
wheel.resize((128, 128), Image.LANCZOS).save(os.path.join(OUT, 'wheel.webp'), quality=88, method=6)
bg = Image.open(os.path.join(SRC, 'world1-hills-bg.jpg')).convert('RGB')
bg.save(os.path.join(OUT, 'world1-hills-bg.webp'), quality=84, method=6)
# where the sea starts in the background (first row that is mostly sea-coloured, from the top)
b = np.asarray(bg).astype(int)
med = np.median(b, axis=1)
row = next(y for y in range(b.shape[0] // 3, b.shape[0]) if med[y, 2] > 200 and med[y, 1] > 180 and med[y, 0] < 130)
info['bg_w'], info['bg_h'], info['bg_sea_top'] = bg.width, bg.height, round(row / bg.height, 4)
json.dump(info, open(os.path.join(OUT, 'art.json'), 'w'), indent=1)
print(json.dumps(info, indent=1))
for f in sorted(os.listdir(OUT)): print(f, os.path.getsize(os.path.join(OUT, f)))
