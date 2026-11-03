# CrazyGames publishing assets (A6)

| File | Size | Use |
|---|---|---|
| `cover-landscape-1920x1080.png` | 1920×1080 | Landscape cover |
| `cover-portrait-800x1200.png` | 800×1200 | Portrait cover |
| `cover-square-800x800.png` | 800×800 | Square cover |
| `trailer-landscape-1920x1080.mp4` | 1920×1080, 19.2 s, H.264, 1.3 MB | Preview video, landscape |
| `trailer-portrait-1080x1920.mp4` | 1080×1920, 19.3 s, H.264, 2.6 MB | Preview video, portrait |
| `store-text.md` | | Title, descriptions, controls |

## How they were made (all from the real game)
- Covers: a real 1080×1920 frame of the CrazyGames build (classic view, so the ruler labels do not
  count as extra text), mud ground, car braking at the edge. The sky and cliff are continued by
  stretching the frame's own edge pixels; the sea and the title are the only added drawing.
  The title is the only text, as the cover rules require. Script: `src/make_covers.py`.
- Trailers: real gameplay of the CrazyGames build captured frame by frame at 30 fps under a paused
  clock (identical result on every run), played by a bot that presses and releases like a player.
  Sequence: cover (1 s), slide off the ice on cliff 5 and fall, retry the same cliff with the ghost
  of the last try and reach the checkpoint (21.8 cm), then stop 2.8 cm from the edge on cliff 6.
  No promotional text, no "Play Now", only the game's own interface. No audio (the capture method
  records no sound; platform previews play muted). The landscape version shows the game exactly as
  it appears on a wide screen: centered, with the side background from the game page.
  Scripts: `src/capture_trailer.js`, `src/make_trailers.sh`.

## Rebuild
```
python3 src/make_covers.py src/frame_mud.png .
node src/capture_trailer.js /tmp/frames
sh src/make_trailers.sh /tmp/frames
```
