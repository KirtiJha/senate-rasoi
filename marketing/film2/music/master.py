"""Master to a loudness target with a look-ahead, true-peak-aware limiter.

    python3 master.py in.wav out.wav [lufs=-14] [ceiling_db=-1.2]
Loudness is measured with ffmpeg's EBU R128 meter.
"""
import re
import subprocess
import sys
import wave

import numpy as np
from scipy.ndimage import maximum_filter1d, uniform_filter1d
from scipy.signal import resample_poly

src, dst = sys.argv[1], sys.argv[2]
target = float(sys.argv[3]) if len(sys.argv) > 3 else -14.0
ceil = 10 ** ((float(sys.argv[4]) if len(sys.argv) > 4 else -1.2) / 20)


def lufs(path):
    out = subprocess.run(['ffmpeg', '-hide_banner', '-i', path, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    return float(re.findall(r'I:\s+(-?[\d.]+) LUFS', out)[-1])


w = wave.open(src); sr = w.getframerate()
x = np.frombuffer(w.readframes(w.getnframes()), np.int16).reshape(-1, 2).T / 32768.0
for _ in range(3):  # limiting lowers loudness a little; iterate the make-up gain
    g = 10 ** ((target - lufs(src)) / 20) if _ == 0 else g * 10 ** ((target - lufs(dst)) / 20)
    y = x * g
    # true-peak detection at 4x, look-ahead 3 ms, release 80 ms
    det = np.max(np.stack([np.abs(resample_poly(c, 4, 1)[:len(c) * 4]).reshape(-1, 4).max(1) for c in y]), axis=0)
    det = np.maximum(det, np.max(np.abs(y), axis=0))
    la = int(0.003 * sr)
    need = np.minimum(1.0, ceil / np.maximum(maximum_filter1d(det, size=2 * la + 1), 1e-9))
    rel = np.exp(-1 / (0.08 * sr)); gr = np.empty_like(need); e = 1.0
    for i in range(0, len(need), 64):  # block-wise release for speed
        blk = need[i:i + 64].min()
        e = blk if blk < e else blk + (e - blk) * rel ** 64
        gr[i:i + 64] = e
    gr = uniform_filter1d(gr, size=la)
    gr = np.minimum(gr, need)
    out = np.clip(y * gr, -ceil, ceil)
    o = wave.open(dst, 'wb'); o.setnchannels(2); o.setsampwidth(2); o.setframerate(sr)
    o.writeframes((out.T * 32767).astype(np.int16).tobytes()); o.close()
print(dst, 'LUFS', lufs(dst))
