"""V5 CrazyGames trailers: edits the scenes captured by capture_trailer_v5.js into three videos.

CrazyGames rules followed: 15-20 s, no sound, no black bars, no mouse cursor, no "Play Now" or other
promotional text, no app/social icons, no fast-forward (every scene plays in real time). The only
text is the game's own interface, plus the title on the landscape opening frame (the V5 cover).
Each video is the game recorded at that size (the game lays itself out for the frame).
Usage: python3 compose_trailer_v5.py <frames_dir> <out_dir>
"""
import json, os, subprocess, sys
from PIL import Image

FR, OUT = sys.argv[1], sys.argv[2]
HERE = os.path.dirname(os.path.abspath(__file__))
os.makedirs(OUT, exist_ok=True)
# (scene, frames before the stop/fall, frames after)
SCENES = [('s1_hill_final', 40, 35), ('s2_sandstorm', 50, 30), ('s3_blizzard', 55, 28),
          ('s4_moon_fall', 25, 60), ('s5_volcano_edge', 45, 30), ('s6_final_hit', 40, 60)]
OPEN, XFADE = 15, 5          # landscape: 0.5 s on the cover, short cross-fade into the action
VIDEOS = [('land', 1920, 1080, 'trailer-landscape-1920x1080-v5.mp4', os.path.join(HERE, '..', 'cover-landscape-1920x1080.png')),
          ('p23', 1080, 1620, 'trailer-portrait-1080x1620-v5.mp4', None),      # 2:3, CrazyGames portrait preview
          ('p916', 1080, 1920, 'trailer-portrait-1080x1920-v5.mp4', None)]     # 9:16, TikTok and similar

def encoder(path, w, h):
    return subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{w}x{h}', '-r', '30', '-i', '-',
                             '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path],
                            stdin=subprocess.PIPE)

for fmt, w, h, name, opening in VIDEOS:
    e = encoder(os.path.join(OUT, name), w, h); count = 0
    op = Image.open(opening).convert('RGB').resize((w, h)) if opening else None
    if op:
        for i in range(OPEN): e.stdin.write(op.tobytes()); count += 1
    first = True
    for sid, before, after in SCENES:
        d = os.path.join(FR, fmt, sid); log = json.load(open(os.path.join(d, 'log.json')))
        end = next(i for i, x in enumerate(log) if x['st'] in ('stopped', 'falling'))
        a, b = max(0, end - before), min(len(log), end + after)
        for n in range(a, b):
            f = Image.open(os.path.join(d, '%04d.jpg' % n)).convert('RGB')
            if f.size != (w, h): raise SystemExit(f'{fmt} frame size {f.size} != {(w, h)}')
            if op and first and n - a < XFADE: f = Image.blend(op, f, (n - a + 1) / (XFADE + 1))
            e.stdin.write(f.tobytes()); count += 1
        first = False
    e.stdin.close(); e.wait()
    print(name, 'frames', count, '=', round(count / 30, 2), 's')
