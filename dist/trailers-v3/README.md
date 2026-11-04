# Cliff Edge — trailers V3 (for review, not published)

| File | Size | Duration |
|---|---|---|
| `cliff-edge-trailer-v3-portrait-1080x1920.mp4` | 1080×1920, H.264 High, 30 fps, yuv420p | 19.53 s (586 frames), 2.3 MB |
| `cliff-edge-trailer-v3-landscape-1920x1080.mp4` | 1920×1080, H.264 High, 30 fps, yuv420p | 19.53 s (586 frames), 2.4 MB |

All gameplay is real footage of the V2 build (`docs/crazygames-preview-v2/index.html`, unchanged),
captured frame by frame under a paused clock. Labels mark the real press/release moments from the
capture log. End card: the existing title art (`assets/crazygames/src/trailer-open-*.png`).

Rebuild (from the repository root):
```
node dist/trailers-v3/src/capture_v3.js /tmp/v3frames
node dist/trailers-v3/src/labels_v3.js dist/trailers-v3/src/labels
python3 dist/trailers-v3/src/compose_v3.py /tmp/v3frames dist/trailers-v3
```
