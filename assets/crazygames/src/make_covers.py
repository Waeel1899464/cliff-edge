"""Builds the three CrazyGames covers from a real Cliff Edge frame.

The frame (frame_mud.png) is a 1080x1920 capture of the platform build in classic view
(no ruler labels), mud ground, car braking at the very edge. Nothing is drawn by hand except:
- sky/cliff continuation: the frame's own edge columns/rows stretched (the game's sky is a
  vertical gradient and the cliff is horizontal bands, so the continuation is seamless);
- the sea far below, in the game's own sea color and highlight line;
- the title, the only text CrazyGames allows on a cover.
Usage: python3 make_covers.py <frame_mud.png> <out_dir>
"""
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

FONT = '/usr/share/fonts/opentype/inter/InterDisplay-Black.otf'
TOP = (42, 31, 92)          # game sky top  #2a1f5c
SEA = (31, 61, 122)         # game sea      #1f3d7a
INK = (27, 21, 48)          # title outline
WHITE, YELLOW = (255, 255, 255), (255, 210, 63)

frame = Image.open(sys.argv[1]).convert('RGB')
out = sys.argv[2]
BAND = frame.crop((0, 760, 1080, 1920))          # below the in-game distance counter: no UI text
EDGE_X = 744                                      # cliff edge x inside the band (from the frame)


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
    # left / right continuation: stretch the band's edge columns
    if ox > 0:
        img.paste(band.crop((0, 0, 1, band.height)).resize((ox, band.height)), (0, band_top))
    right = ox + band.width
    if right < W:
        img.paste(band.crop((band.width - 1, 0, band.width, band.height)).resize((W - right, band.height)), (right, band_top))
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


cover(1920, 1080, k=0.98, edge_x=1330, band_top=95, sea_y=985, title_xy=(110, 250), title_size=230).save(out + '/cover-landscape-1920x1080.png', optimize=True)
cover(800, 1200, k=0.86, edge_x=610, band_top=340, sea_y=1125, title_xy=(400, 64), title_size=150, align='center').save(out + '/cover-portrait-800x1200.png', optimize=True)
cover(800, 800, k=0.74, edge_x=612, band_top=165, sea_y=748, title_xy=(48, 44), title_size=104).save(out + '/cover-square-800x800.png', optimize=True)
# opening frames for the trailers (the docs recommend starting the preview video on the cover)
cover(1080, 1920, k=1.0, edge_x=760, band_top=640, sea_y=1800, title_xy=(540, 190), title_size=210, align='center').save(out + '/src/trailer-open-portrait.png')
cover(1920, 1080, k=0.98, edge_x=1330, band_top=95, sea_y=985, title_xy=(110, 250), title_size=230).save(out + '/src/trailer-open-landscape.png')
print('covers written to', out)
