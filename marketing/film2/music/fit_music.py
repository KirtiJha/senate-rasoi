"""Fit "Inspired" (Kevin MacLeod, incompetech.com, CC BY 4.0) to film 2.

The track is already 120 BPM, the film's grid. We trim 50 ms so its beats
land on the cuts, repeat 4 bars (exactly 8 s) inside the Saathi section so
its natural ending plays under the end card, then automate the mix: muffled
through the opening skyline, opening up into the hero flash, 2 dB softer
under Saathi. Normalise afterwards to -14 LUFS (see README).

    curl -o Inspired.mp3 https://incompetech.com/music/royalty-free/mp3-royaltyfree/Inspired.mp3
    python3 fit_music.py Inspired.mp3 music_film2.wav
"""
import sys
import wave

import librosa
import numpy as np
from scipy.signal import butter, sosfiltfilt

src, dst = sys.argv[1], sys.argv[2]
sr = 44100
x, _ = librosa.load(src, sr=sr, mono=False)
x = x[:, int(0.050 * sr):]
a = int(118.0 * sr); b = a + int(8.0 * sr)
xf = int(0.02 * sr); fade = np.linspace(0, 1, xf)
first, rep = x[:, :b], x[:, a:]
y = np.concatenate([first[:, :-xf], first[:, -xf:] * (1 - fade) + rep[:, :xf] * fade, rep[:, xf:]], axis=1)
D = 290.5; N = int(D * sr)
y = np.pad(y, ((0, 0), (0, max(0, N - y.shape[1]))))[:, :N]
t = np.arange(N) / sr
lp = np.stack([sosfiltfilt(butter(4, 650 / (sr / 2), 'low', output='sos'), c) for c in y])
env = lambda k: np.interp(t, np.array(k)[:, 0], np.array(k)[:, 1])
muff = env([[0, 1], [10.0, 1], [13.5, 0.65], [16.6, 0.25], [17.25, 0], [D, 0]])
g = env([[0, -5], [10, -4], [17.0, -1], [17.25, 0], [94, 0], [95, -2.2], [151.5, -2.2], [152.5, 0],
         [246, 0], [247, -1.5], [258, -1.5], [258.5, 0], [D - 2.5, 0], [D, -40]])
z = (muff * lp + (1 - muff) * y) * 10 ** (g / 20)
z[:, :int(0.04 * sr)] *= np.linspace(0, 1, int(0.04 * sr))
o = wave.open(dst, 'wb'); o.setnchannels(2); o.setsampwidth(2); o.setframerate(sr)
o.writeframes((np.clip(z.T, -1, 1) * 32767).astype(np.int16).tobytes()); o.close()
