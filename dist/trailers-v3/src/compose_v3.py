"""Trailer V3 — edit and compose both trailers from the captured gameplay frames.

Usage: python3 compose_v3.py <frames_dir> <out_dir>
Inputs: frames + log.json from capture_v3.js, labels from labels_v3.js, and the existing title art
(assets/crazygames/src/trailer-open-*.png, read only). Writes two H.264 MP4 files (30 fps).

Edit (capture frame ranges, 30 fps):
  0.0-1.7  opening: cliff 8 mud, the camera rushes in as the car brakes to the flag and stops 0.8 cm
           away (PERFECT shows at 0.8 s)
  1.7-6.4  cliff 9: ready -> PRESS TO DRIVE -> RELEASE TO STOP -> GREAT 4.6 cm -> THE CLOSER, THE BETTER
  6.4-15.3 cliff 10 ice: drives off, fall and splash, INSTANT RETRY, retry with the ghost,
           12 cm -> CHECKPOINT SAVED
  15.3-16.7 cliff 11: the night zone appears -> NEW ZONE EVERY 5 CLIFFS
  16.7-19.5 end card: title art, HOW CLOSE CAN YOU STOP?, PLAY NOW
"""
import json, os, subprocess, sys
from PIL import Image, ImageDraw, ImageFilter

FR, OUT = sys.argv[1], sys.argv[2]
HERE = os.path.dirname(os.path.abspath(__file__))
LAB = os.path.join(HERE, 'labels')
ART = os.path.join(HERE, '../../../assets/crazygames/src')
os.makedirs(OUT, exist_ok=True)
LOG = json.load(open(os.path.join(FR, 'log.json')))

SEGMENTS = [(54, 106), (116, 255), (317, 584), (589, 633)]
END_FRAMES, XFADE = 84, 8
# portrait labels: name -> (first capture frame, last capture frame, exclusive)
PLABELS = {'press': (119, 167), 'release': (167, 219), 'closer': (225, 255), 'retry': (409, 441), 'zone': (595, 633)}
EVENT_LABELS = ('retry', 'zone')          # also shown in the landscape version (over the close-up)

lab = {n: Image.open(os.path.join(LAB, n + '.png')).convert('RGBA') for n in
       ['press', 'release', 'closer', 'retry', 'zone', 'question', 'cta',
        'step1_on', 'step1_off', 'step2_on', 'step2_off', 'step3_on', 'step3_off']}

def frame(n):
    return Image.open(os.path.join(FR, '%04d.jpg' % n)).convert('RGBA')

def place(base, im, cx, cy, scale=1.0, alpha=1.0):
    if scale != 1.0:
        im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
    if alpha < 1.0:
        a = im.getchannel('A').point(lambda v: round(v * alpha))
        im = im.copy(); im.putalpha(a)
    base.alpha_composite(im, (round(cx - im.width / 2), round(cy - im.height / 2)))

def label_anim(n, start, end):
    """pop in over 5 frames, fade out over 4; returns (alpha, scale) or None"""
    if n < start or n >= end:
        return None
    i, left = n - start, end - 1 - n
    a = min(1.0, (i + 1) / 5, (left + 1) / 4)
    s = 0.86 + 0.14 * min(1.0, (i + 1) / 5)
    return a, s

def rounded_mask(w, h, r):
    m = Image.new('L', (w, h), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, w - 1, h - 1), r, fill=255)
    return m

# ---------------- portrait ----------------
def portrait(n, f):
    for name, (a, b) in PLABELS.items():
        an = label_anim(n, a, b)
        if an:
            place(f, lab[name], 540, 1560, an[1], an[0])
    return f

# ---------------- landscape ----------------
LW, LH = 1920, 1080
def make_bg():
    bg = Image.new('RGB', (LW, LH))
    d = ImageDraw.Draw(bg)
    top, mid, bot = (14, 15, 34), (29, 20, 66), (46, 24, 70)
    for y in range(LH):
        t = y / (LH - 1)
        c = [round(top[i] + (mid[i] - top[i]) * t * 2) if t < 0.5 else round(mid[i] + (bot[i] - mid[i]) * (t - 0.5) * 2) for i in range(3)]
        d.line([(0, y), (LW, y)], fill=tuple(c))
    bg = bg.convert('RGBA')
    sh = Image.new('RGBA', (LW, LH), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    sd.rounded_rectangle((110 + 6, 40 + 14, 110 + 562 + 6, 40 + 1000 + 14), 26, fill=(0, 0, 0, 150))
    sd.rounded_rectangle((770 + 6, 60 + 14, 770 + 1040 + 6, 60 + 585 + 14), 22, fill=(0, 0, 0, 150))
    bg.alpha_composite(sh.filter(ImageFilter.GaussianBlur(18)))
    return bg
BG = make_bg()
GAME_MASK = rounded_mask(562, 1000, 26)
CU_MASK = rounded_mask(1040, 585, 22)
CU_BORDER = Image.new('RGBA', (1040, 585), (0, 0, 0, 0))
ImageDraw.Draw(CU_BORDER).rounded_rectangle((0, 0, 1039, 584), 22, outline=(255, 255, 255, 40), width=3)

def active_step(info):
    if info['held']:
        return 1
    if info['st'] == 'sliding':
        return 2
    if info['st'] == 'stopped' and info['grade']:
        return 3
    return 0

def landscape(n, f, cy):
    out = BG.copy()
    g = f.resize((562, 1000), Image.LANCZOS); g.putalpha(GAME_MASK)
    out.alpha_composite(g, (110, 40))
    top = round(cy - 270)
    cu = f.crop((60, top, 1020, top + 540)).resize((1040, 585), Image.LANCZOS); cu.putalpha(CU_MASK)
    out.alpha_composite(cu, (770, 60)); out.alpha_composite(CU_BORDER, (770, 60))
    st = active_step(LOG[n])
    for i in (1, 2, 3):
        im = lab['step%d_%s' % (i, 'on' if st == i else 'off')]
        out.alpha_composite(im, (790, 690 + (i - 1) * 104))
    for name in EVENT_LABELS:
        a, b = PLABELS[name]
        an = label_anim(n, a, b)
        if an:
            place(out, lab[name], 770 + 520, 60 + 585 - 70, 0.78 * an[1], an[0])
    return out

def cy_target(info):
    return 1330 if info['st'] in ('falling', 'fell') else 1110

# ---------------- end cards ----------------
def end_portrait(i):
    c = Image.open(os.path.join(ART, 'trailer-open-portrait.png')).convert('RGBA')
    k = min(1.0, (i + 1) / 8)
    place(c, lab['question'], 540, 1250, 1.0, k)
    if i >= 6:
        j = i - 6
        place(c, lab['cta'], 540, 1430, 0.9 + 0.1 * min(1.0, (j + 1) / 6), min(1.0, (j + 1) / 6))
    return c

def end_landscape(i):
    c = Image.open(os.path.join(ART, 'trailer-open-landscape.png')).convert('RGBA')
    k = min(1.0, (i + 1) / 8)
    q = lab['question']
    place(c, q, 112 + q.width * 0.82 / 2, 775, 0.82, k)
    if i >= 6:
        j = i - 6; t = lab['cta']
        place(c, t, 112 + t.width * 0.82 / 2, 895, 0.82 * (0.9 + 0.1 * min(1.0, (j + 1) / 6)), min(1.0, (j + 1) / 6))
    return c

# ---------------- encode ----------------
def encoder(path, w, h):
    return subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (w, h), '-r', '30',
                             '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p',
                             '-movflags', '+faststart', path], stdin=subprocess.PIPE)

P_OUT = os.path.join(OUT, 'cliff-edge-trailer-v3-portrait-1080x1920.mp4')
L_OUT = os.path.join(OUT, 'cliff-edge-trailer-v3-landscape-1920x1080.mp4')
ep, el = encoder(P_OUT, 1080, 1920), encoder(L_OUT, 1920, 1080)
count = 0
last_p = last_l = None
for a, b in SEGMENTS:
    cy = cy_target(LOG[a])
    for n in range(a, b):
        f = frame(n)
        cy += (cy_target(LOG[n]) - cy) * 0.12
        p = portrait(n, f.copy()); l = landscape(n, f, cy)
        ep.stdin.write(p.convert('RGB').tobytes()); el.stdin.write(l.convert('RGB').tobytes())
        last_p, last_l = p, l; count += 1
for i in range(END_FRAMES):
    p, l = end_portrait(i), end_landscape(i)
    if i < XFADE:
        t = (i + 1) / (XFADE + 1)
        p = Image.blend(last_p, p, t); l = Image.blend(last_l, l, t)
    ep.stdin.write(p.convert('RGB').tobytes()); el.stdin.write(l.convert('RGB').tobytes()); count += 1
for e in (ep, el):
    e.stdin.close(); e.wait()
print('frames', count, '=', round(count / 30, 2), 's')
print(P_OUT); print(L_OUT)
