"""V3 covers: the three CrazyGames covers from a real Cliff Edge V3 frame.

The frame (frame_sandstorm.png) is a 1080x1920 capture of the V3 platform build (capture_cover_v3.js):
the final phase of the Sandstorm boss battle, the car braking at the edge on sand while the furious
storm cloud blows. The game's text drawing was off in that capture (covers allow only the title).
Nothing is drawn by hand except:
- sky/cliff continuation: the frame's own edge columns/rows stretched (the game's sky is a
  vertical gradient and the cliff is horizontal bands, so the continuation is seamless);
- the sea far below, in the game's own sea color and highlight line;
- the title, the only text CrazyGames allows on a cover.
Usage: python3 make_covers_v3.py <frame_sandstorm.png> <out_dir>
"""
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np

FONT = '/usr/share/fonts/opentype/inter/InterDisplay-Black.otf'
TOP = (217, 103, 46)        # desert sky top  #d9672e
SEA = (38, 112, 150)        # desert sea      rgba(38,112,150)
INK = (27, 21, 48)          # title outline
WHITE, YELLOW = (255, 255, 255), (255, 210, 63)

frame = Image.open(sys.argv[1]).convert('RGB')
out = sys.argv[2]
BAND = frame.crop((0, 540, 1080, 1920))          # below the hearts: no UI shapes (the boss cloud starts at ~640)
EDGE_X = 727                                      # cliff edge x inside the band (measured on the frame)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def cover(W, H, k, edge_x, band_top, sea_y, title_xy, title_size, align='left'):
    band = BAND.resize((int(BAND.width * k), int(BAND.height * k)), Image.LANCZOS)
    ox = int(edge_x - EDGE_X * k)
    img = Image.new('RGB', (W, H))
    px = img.load()
    # sky above the band: game top color fading into the band's first row
    c0 = band.getpixel((band.width - 1, 0))
    for y in range(max(0, band_top)):
        col = lerp(TOP, c0, (y / max(1, band_top)) ** 0.9)
        for x in range(W):
            px[x, y] = col
    img.paste(band, (ox, band_top))
    # left / right continuation: each row takes the median colour of a strip at the band's side,
    # so thin details (wind streaks, ruler ticks, dust) do not turn into long lines
    road_row = int((1240 - 540) * k) - 6          # rows above this are sky (the road top is at frame y 1240)
    def side_column(x0, x1):
        a = np.asarray(band.crop((x0, 0, x1, band.height))).astype(float)
        col = np.median(a, axis=1)                   # across the strip
        sky = col[:road_row].copy()                  # in the sky, also smooth vertically: wind streaks are 3 px lines
        for y in range(road_row):
            sky[y] = np.median(col[max(0, y - 7):min(road_row, y + 8)], axis=0)
        col[:road_row] = sky
        return Image.fromarray(col.astype('uint8')[:, None, :])
    if ox > 0:
        img.paste(side_column(0, int(24 * k)).resize((ox, band.height)), (0, band_top))
    right = ox + band.width
    if right < W:
        img.paste(side_column(band.width - int(60 * k), band.width).resize((W - right, band.height)), (right, band_top))
    # below the band: stretch the last row (cliff face on the left, sky on the right)
    bottom = band_top + band.height
    if bottom < H:
        row = img.crop((0, bottom - 1, W, bottom))
        img.paste(row.resize((W, H - bottom)), (0, bottom))
    # soft warm glow over the drop, then the sea far below (same style as the game)
    glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    r = int(H * 0.45)
    gx, gy = edge_x + int(W * 0.12), sea_y
    gd.ellipse((gx - r, gy - r, gx + r, gy + r), fill=(255, 226, 170, 70))
    glow = glow.filter(ImageFilter.GaussianBlur(r // 3))
    # keep the glow over the open drop only (not on the cliff face)
    mask = Image.new('L', (W, H), 0)
    ImageDraw.Draw(mask).rectangle((edge_x, 0, W, H), fill=255)
    glow.putalpha(Image.composite(glow.getchannel('A'), Image.new('L', (W, H), 0), mask))
    img = Image.alpha_composite(img.convert('RGBA'), glow)
    sea = Image.new('RGBA', (W, H - sea_y), SEA + (235,))
    img.alpha_composite(sea, (0, sea_y))
    hl = Image.new('RGBA', (W, max(2, int(4 * k))), (255, 255, 255, 90))
    img.alpha_composite(hl, (0, sea_y))
    # title: the only text allowed on a cover
    d = ImageDraw.Draw(img)
    font = ImageFont.truetype(FONT, title_size)
    tx, ty = title_xy
    stroke = max(4, title_size // 16)
    for i, (word, color) in enumerate((('CLIFF', WHITE), ('EDGE', YELLOW))):
        y = ty + int(i * title_size * 0.88)
        bbox = d.textbbox((0, 0), word, font=font, stroke_width=stroke)
        x = tx if align == 'left' else tx - (bbox[2] - bbox[0]) // 2
        # drop shadow, then outlined word
        d.text((x, y + stroke * 1.4), word, font=font, fill=(10, 10, 25, 110), stroke_width=stroke, stroke_fill=(10, 10, 25, 110))
        d.text((x, y), word, font=font, fill=color, stroke_width=stroke, stroke_fill=INK)
    return img.convert('RGB')


cover(1920, 1080, k=0.78, edge_x=1450, band_top=0, sea_y=985, title_xy=(110, 300), title_size=230).save(out + '/cover-landscape-1920x1080.png', optimize=True)
cover(800, 1200, k=0.74, edge_x=560, band_top=300, sea_y=1125, title_xy=(400, 52), title_size=150, align='center').save(out + '/cover-portrait-800x1200.png', optimize=True)
cover(800, 800, k=0.56, edge_x=540, band_top=40, sea_y=748, title_xy=(40, 520), title_size=104).save(out + '/cover-square-800x800.png', optimize=True)
cover(1080, 1920, k=1.0, edge_x=727, band_top=380, sea_y=1840, title_xy=(540, 110), title_size=200, align='center').save(out + '/src/trailer-end-portrait.png')
cover(1920, 1080, k=0.78, edge_x=1450, band_top=0, sea_y=985, title_xy=(110, 300), title_size=230).save(out + '/src/trailer-end-landscape.png')
print('covers written to', out)
