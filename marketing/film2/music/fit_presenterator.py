"""Fit "Presenterator" (Kevin MacLeod, incompetech.com, CC BY 4.0) to film 2.

130 BPM. We repeat exactly 20 bars (36.925 s, measured from the audio) inside
the second main section, splicing on a drum hit at 177.05 s. That keeps the
first breakdown under Saathi (1:58), lands the second breakdown on the trust
scene (4:04) so the build rises through dark mode into the montage, and puts
the track's final stop on the end card (4:48). The mix is muffled through the
opening skyline and opens into the hero flash.

    curl -o Presenterator.mp3 https://incompetech.com/music/royalty-free/mp3-royaltyfree/Presenterator.mp3
    python3 fit_presenterator.py Presenterator.mp3 music_film2.wav
"""
import sys
import wave

import librosa
import numpy as np
from scipy.signal import butter, sosfiltfilt

src, dst = sys.argv[1], sys.argv[2]
sr = 44100
x, _ = librosa.load(src, sr=sr, mono=False)
b = int(177.052 * sr); a = b - int(36.925 * sr)
xf = int(0.015 * sr); fade = np.linspace(0, 1, xf)
first, rep = x[:, :b], x[:, a:]
y = np.concatenate([first[:, :-xf], first[:, -xf:] * (1 - fade) + rep[:, :xf] * fade, rep[:, xf:]], axis=1)
D = 290.5; N = int(D * sr)
y = np.pad(y, ((0, 0), (0, max(0, N - y.shape[1]))))[:, :N]
t = np.arange(N) / sr
lp = np.stack([sosfiltfilt(butter(4, 650 / (sr / 2), 'low', output='sos'), c) for c in y])
env = lambda k: np.interp(t, np.array(k)[:, 0], np.array(k)[:, 1])
muff = env([[0, 1], [10.0, 1], [13.5, 0.65], [16.6, 0.25], [17.25, 0], [D, 0]])
g = env([[0, -6], [10, -5], [17.0, -1], [17.25, 0], [94, 0], [95, -2], [151.5, -2], [152.5, 0], [D - 1.2, 0], [D, -40]])
z = (muff * lp + (1 - muff) * y) * 10 ** (g / 20)
z[:, :int(0.04 * sr)] *= np.linspace(0, 1, int(0.04 * sr))
o = wave.open(dst, 'wb'); o.setnchannels(2); o.setsampwidth(2); o.setframerate(sr)
o.writeframes((np.clip(z.T, -1, 1) * 32767).astype(np.int16).tobytes()); o.close()
m = z.mean(0)
print(' '.join(f'{20*np.log10(np.sqrt(np.mean(m[i*sr*5:(i+1)*sr*5]**2))+1e-9):.0f}' for i in range(len(m) // (sr * 5))))
