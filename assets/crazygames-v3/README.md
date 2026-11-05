# CrazyGames publishing assets: V3 (five worlds)

| File | Size | Use |
|---|---|---|
| `cover-landscape-1920x1080.png` | 1920×1080 | Landscape cover |
| `cover-portrait-800x1200.png` | 800×1200 | Portrait cover |
| `cover-square-800x800.png` | 800×800 | Square cover |
| `trailer-portrait-1080x1620-v3.mp4` | 1080×1620 (2:3), 17.1 s, H.264 30 fps, no audio, 3.5 MB | **CrazyGames portrait preview** (their upload requires 2:3) |
| `trailer-portrait-1080x1920-v3.mp4` | 1080×1920 (9:16), 17.1 s, H.264 30 fps, no audio, 3.6 MB | Portrait video for TikTok and similar |
| `trailer-landscape-1920x1080-v3.mp4` | 1920×1080, 17.1 s, H.264 30 fps, no audio, 4.1 MB | Preview video, landscape |
| `store-text.md` | | Title, descriptions, controls (V3) |

The V1/V2 assets in `assets/crazygames/` are unchanged.

## CrazyGames rules followed
- Covers: 3 sizes, the same scene on all three. The only text is the title. No borders.
- Videos: 15–20 s, under 50 MB, no sound, no black bars, no mouse cursor. No "Play Now" or other
  promotional text, and no app or social icons. No fast-forward: every scene plays in real time.
  The footage was captured with today's free bonuses already used, so no reward buttons appear.

## How they were made (all from the real V3 platform build, unchanged)
- **Covers:** a real frame from the final phase of the Sandstorm boss battle (cliff 2-10). The car
  brakes at the edge while the furious storm cloud blows.
  - The game's text drawing was switched off in that capture only.
  - The sky and cliff are continued from the frame's own pixels. Each row takes the median of a side
    strip, so thin wind streaks do not stretch into lines.
  - The water below and the title are the only additions.
- **Videos:** six real scenes, captured frame by frame under a paused clock (identical on every run):
  1. Final hit on the Giant Hill (PERFECT, the hill goes down).
  2. The Sandstorm's head wind.
  3. The Blizzard at dusk in fog.
  4. A floaty fall on the Moon.
  5. The Volcano's edge breaking off.
  6. Final hit on the Angry Volcano ("ALL 5 WORLDS COMPLETE!").
  - They open on the cover art for 0.5 s.
  - Landscape: the game on the left and a live close-up of the same footage on the right, over
    the world's own colours.

## Rebuild (from the repository root)
```
node assets/crazygames-v3/src/capture_cover_v3.js /tmp/cover      # pick a frame -> src/frame_sandstorm.png
python3 assets/crazygames-v3/src/make_covers_v3.py assets/crazygames-v3/src/frame_sandstorm.png assets/crazygames-v3
node assets/crazygames-v3/src/capture_trailer_v3.js /tmp/trv3
python3 assets/crazygames-v3/src/compose_trailer_v3.py /tmp/trv3 assets/crazygames-v3
```
