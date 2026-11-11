"""Writes design/art/art-data.js: the game images as data URIs plus their measurements.
build.sh puts this file into the game in place of the ART-DATA line (one single-file game).
Usage: python3 tools/art/embed.py   (after tools/art/process.py)
"""
import os, json, base64
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
A = os.path.join(ROOT, 'design/art')
files = {'car': 'car-body.webp', 'wheel': 'wheel.webp'}
for n in range(1, 6):
    for kind, key in (('bg', 'bg'), ('rock', 'rock')):
        f = f'world{n}-{kind}.webp'
        if os.path.exists(os.path.join(A, f)): files[key + str(n)] = f
img = {k: 'data:image/webp;base64,' + base64.b64encode(open(os.path.join(A, f), 'rb').read()).decode() for k, f in files.items()}
info = json.load(open(os.path.join(A, 'art.json')))
font_path = os.path.join(ROOT, 'design/fonts/lilita-one-latin-400-normal.woff2')   # Lilita One, SIL Open Font License
font = 'data:font/woff2;base64,' + base64.b64encode(open(font_path, 'rb').read()).decode() if os.path.exists(font_path) else None
with open(os.path.join(A, 'art-data.js'), 'w') as f:
    f.write('  // Game images (made with AI by the owner, processed by tools/art). Generated file: do not edit.\n')
    f.write('  const ART_DATA = ' + json.dumps({'img': img, 'info': info, 'font': font}, separators=(',', ':')) + ';\n')
print('art-data.js', os.path.getsize(os.path.join(A, 'art-data.js')), 'bytes;', ', '.join(files))
