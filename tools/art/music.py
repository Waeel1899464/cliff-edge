"""Prepares the owner's AI music (design/music-src/*.mp3) for the game: silence trimmed at both ends
(so the loop has no gap), soft fade in/out (smooth restart), loudness levelled under the game sounds (-20 LUFS), mono 48 kbps MP3
(plays in every browser, small). Writes design/art/music-<name>.mp3.
Usage: python3 tools/art/music.py
"""
import os, subprocess, glob
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
for src in sorted(glob.glob(os.path.join(ROOT, 'design/music-src/*.mp3'))):
    name = os.path.splitext(os.path.basename(src))[0]
    out = os.path.join(ROOT, 'design/art', f'music-{name}.mp3')
    trim = 'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse'
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src], capture_output=True, text=True).stdout)
    # soft start and soft end, so when the track starts again the loop sounds smooth, never cut
    fades = f',afade=t=in:d=0.4,areverse,afade=t=in:d=2.5,areverse'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-af', trim + fades + ',loudnorm=I=-20:TP=-2:LRA=11', '-ac', '1', '-ar', '44100',
                    '-c:a', 'libmp3lame', '-b:a', '48k', out], check=True)
    d = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out], capture_output=True, text=True).stdout.strip()
    print(name, round(float(d), 1), 's', os.path.getsize(out) // 1024, 'KB')
