"""Procedural score for Aangan film 2, "One Courtyard" (I–V–vi–IV in D).

120 BPM in D major (Bm – G – D – A), with a sitar-like pluck, tabla, a
tanpura drone, pads and bass. Sections and transition hits are read from
timing.json (exported from cuts.js) so every cut lands on the picture.

    python3 compose.py long|short  ->  music_<cut>.wav
"""
import json
import sys

import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

SR = 44100
BPM = 120
BEAT = 60 / BPM
BAR = 4 * BEAT
rng = np.random.default_rng(7)

cut = sys.argv[1] if len(sys.argv) > 1 else 'film2'
T = json.load(open(__file__.replace('compose.py', 'timing.json')))[cut]
DUR = T['dur'] + 0.6
N = int(DUR * SR)


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def bus():
    return np.zeros((2, N))


def place(dst, sig, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= N or i + len(sig) <= 0:
        return
    j = min(N, i + len(sig))
    s = sig[: j - i] * gain
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    dst[0, i:j] += s * l * 1.414
    dst[1, i:j] += s * r * 1.414


def env(n, a=0.005, d=0.3, curve=6.0):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-curve * np.maximum(0, t - a) / max(d, 1e-4))
    return e


def lp(x, fc, order=2):
    return sosfilt(butter(order, min(fc, SR / 2 - 100) / (SR / 2), 'low', output='sos'), x)


def hp(x, fc, order=2):
    return sosfilt(butter(order, fc / (SR / 2), 'high', output='sos'), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo / (SR / 2), min(hi, SR / 2 - 100) / (SR / 2)], 'band', output='sos'), x)


# ---------------- instruments ----------------
def kick(vel=1.0):
    n = int(0.45 * SR); t = np.arange(n) / SR
    f = 45 + 110 * np.exp(-t * 38)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t * 7.5)
    s[:120] += rng.normal(0, 0.4, 120) * np.linspace(1, 0, 120)
    return np.tanh(s * 1.6) * vel


def clap(vel=1.0):
    n = int(0.3 * SR); s = np.zeros(n)
    for k, o in enumerate([0, 0.011, 0.022]):
        i = int(o * SR); m = n - i
        s[i:] += rng.normal(0, 1, m) * np.exp(-np.arange(m) / SR * (60 if k < 2 else 16))
    return bp(s, 900, 5200) * 0.55 * vel


def hat(open_=False, vel=1.0):
    n = int((0.22 if open_ else 0.05) * SR)
    s = hp(rng.normal(0, 1, n), 7000) * np.exp(-np.arange(n) / SR * (14 if open_ else 70))
    return s * 0.35 * vel


def shaker(vel=1.0):
    n = int(0.09 * SR); t = np.arange(n) / SR
    e = np.minimum(1, t / 0.02) * np.exp(-t * 40)
    return bp(rng.normal(0, 1, n), 4500, 11000) * e * 0.28 * vel


def tabla_na(vel=1.0):
    n = int(0.35 * SR); t = np.arange(n) / SR
    f0 = 520
    s = (np.sin(2 * np.pi * f0 * t) * np.exp(-t * 14) + 0.5 * np.sin(2 * np.pi * f0 * 2.76 * t) * np.exp(-t * 22)
         + 0.25 * np.sin(2 * np.pi * f0 * 4.1 * t) * np.exp(-t * 30))
    s[:200] += bp(rng.normal(0, 1, 200), 2000, 8000) * 0.6
    return s * 0.42 * vel


def tabla_ge(vel=1.0):
    n = int(0.6 * SR); t = np.arange(n) / SR
    f = 70 + 55 * np.exp(-t * 6)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 5)
    s[:300] += lp(rng.normal(0, 1, 300), 1500) * 0.5
    return s * 0.6 * vel


def tabla_tin(vel=1.0):
    n = int(0.2 * SR); t = np.arange(n) / SR
    s = np.sin(2 * np.pi * 760 * t) * np.exp(-t * 30) + 0.4 * np.sin(2 * np.pi * 1900 * t) * np.exp(-t * 45)
    return s * 0.3 * vel


def sitar(m, dur=0.9, vel=1.0, bend=True):
    """Additive pluck: bright attack, buzzy upper partials, a small meend (bend) into the note."""
    n = int((dur + 0.6) * SR); t = np.arange(n) / SR
    f0 = mtof(m)
    bendc = (1 - 0.06 * np.exp(-t * 18)) if bend else 1.0
    ph = 2 * np.pi * np.cumsum(f0 * bendc * (1 + 0.002 * np.sin(2 * np.pi * 5.5 * t))) / SR
    s = np.zeros(n)
    for k in range(1, 14):
        amp = (1 / k ** 0.9) * (1.35 if k % 2 == 1 and k > 3 else 1.0)  # jawari buzz on odd partials
        s += amp * np.sin(k * ph) * np.exp(-t * (2.2 + 0.9 * k))
    s *= np.minimum(1, t / 0.002)
    return s * 0.24 * vel


def bell(m, vel=1.0, dur=1.6):
    n = int(dur * SR); t = np.arange(n) / SR
    f = mtof(m)
    s = (np.sin(2 * np.pi * f * t) * np.exp(-t * 3) + 0.4 * np.sin(2 * np.pi * f * 2.0 * t) * np.exp(-t * 5)
         + 0.22 * np.sin(2 * np.pi * f * 3.01 * t) * np.exp(-t * 7) + 0.1 * np.sin(2 * np.pi * f * 4.2 * t) * np.exp(-t * 11))
    return s * np.minimum(1, t / 0.003) * 0.16 * vel


def saw_add(f, n, harm=10, detune=0.0):
    t = np.arange(n) / SR
    s = np.zeros(n)
    for k in range(1, harm + 1):
        if f * k > 9000:
            break
        s += np.sin(2 * np.pi * f * (1 + detune) * k * t + k) / k
    return s


def pad(notes, dur, vel=1.0, bright=2200, attack=0.6):
    n = int((dur + 1.2) * SR); t = np.arange(n) / SR
    s = np.zeros(n)
    for m in notes:
        f = mtof(m)
        for d in (-0.004, 0.0, 0.0045):
            s += saw_add(f, n, 10, d)
    s = hp(lp(s, bright), 170)
    e = np.minimum(1, t / attack) * np.where(t < dur, 1.0, np.exp(-(t - dur) * 3.2))
    return s * e * 0.024 * vel


def bass(m, dur, vel=1.0):
    n = int((dur + 0.15) * SR); t = np.arange(n) / SR
    f = mtof(m)
    s = np.sin(2 * np.pi * f * t) + 0.35 * lp(saw_add(f, n, 8), 700)
    e = np.minimum(1, t / 0.006) * np.where(t < dur, np.exp(-t * 3.0), np.exp(-dur * 3.0) * np.exp(-(t - dur) * 30))
    return np.tanh(s * e * 1.2) * 0.2 * vel


def stab(notes, vel=1.0):
    n = int(0.5 * SR); t = np.arange(n) / SR
    s = sum(saw_add(mtof(m), n, 12, d) for m in notes for d in (-0.003, 0.003))
    s = lp(s, 3200) * np.exp(-t * 9) * np.minimum(1, t / 0.003)
    return s * 0.05 * vel


def drone(dur, vel=1.0):
    """Tanpura: Pa–Sa–Sa–Sa (A2, D3, D3, D2) cycling, with shimmering partials."""
    n = int(dur * SR); s = np.zeros(n)
    seq = [45, 50, 50, 38]
    step = 0.75
    k = 0
    while k * step < dur:
        m = seq[k % 4]
        nn = int(2.6 * SR); t = np.arange(nn) / SR
        f = mtof(m)
        tone = sum((1 / h) * np.sin(2 * np.pi * f * h * t) * (0.6 + 0.4 * np.sin(2 * np.pi * (0.7 + 0.13 * h) * t + h))
                   for h in range(1, 12))
        tone *= np.exp(-t * 0.9) * np.minimum(1, t / 0.01)
        i = int(k * step * SR); j = min(n, i + nn)
        s[i:j] += tone[: j - i]
        k += 1
    return hp(s, 60) * 0.032 * vel


def noise_sweep(dur, f0, f1, rise=True):
    n = int(dur * SR); x = rng.normal(0, 1, n)
    out = np.zeros(n); blk = 1024
    for i in range(0, n, blk):
        p = i / n
        fc = f0 * (f1 / f0) ** p
        seg_ = x[max(0, i - 2048): i + blk]
        y = bp(seg_, fc * 0.6, fc * 1.6)
        out[i: i + blk] = y[-len(out[i: i + blk]):]
    e = np.linspace(0, 1, n) ** 2 if rise else np.sin(np.linspace(0, np.pi, n)) ** 1.5
    return out * e


def whoosh(vel=1.0):
    return noise_sweep(0.9, 400, 6000, rise=False) * 0.3 * vel


def riser(dur, vel=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    f = 200 * (8 ** (t / dur))
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.15 * (t / dur) ** 2
    return (noise_sweep(dur, 300, 9000) * 0.35 + tone) * vel


def impact(vel=1.0):
    n = int(2.2 * SR); t = np.arange(n) / SR
    f = 30 + 60 * np.exp(-t * 10)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.2)
    s += lp(rng.normal(0, 1, n), 2500) * np.exp(-t * 6) * 0.5
    s += hp(rng.normal(0, 1, n), 5000) * np.exp(-t * 2.5) * 0.12  # crash tail
    return np.tanh(s * 1.4) * 0.55 * vel


def blip(f, vel=1.0):
    n = int(0.16 * SR); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * f * 1.5 * t)) * np.exp(-t * 28) * 0.12 * vel


# ---------------- harmony ----------------
# bar index -> chord (root midi for bass, pad notes)
CHORDS = [
    (50, [57, 62, 66, 64]),   # D(add9)
    (45, [57, 61, 64, 69]),   # A
    (47, [59, 62, 66, 73]),   # Bm(add9)
    (43, [55, 59, 62, 69]),   # G(add9)
]
PENTA = [62, 64, 66, 69, 71, 74, 76, 78, 81]  # D major pentatonic
MOTIFS = [
    [(0, 3, 0.25), (0.25, 4, 0.25), (0.5, 5, 0.75), (1.5, 4, 0.5), (2, 6, 1.0), (3.25, 5, 0.25), (3.5, 4, 0.5)],
    [(0, 5, 0.5), (0.5, 4, 0.5), (1, 3, 0.5), (1.5, 4, 1.0), (3, 2, 0.5), (3.5, 3, 0.5)],
    [(0, 3, 0.5), (0.75, 4, 0.25), (1, 5, 1.0), (2.5, 4, 0.5), (3, 3, 0.5), (3.5, 1, 0.5)],
    [(0, 6, 0.75), (0.75, 5, 0.75), (1.5, 4, 0.5), (2, 3, 1.0), (3.5, 2, 0.5)],
    [(0, 2, 0.5), (0.5, 3, 0.5), (1, 4, 0.5), (1.5, 5, 0.5), (2, 6, 1.5)],
]


def chord_at(t):
    return CHORDS[int(t // BAR) % 4]


# ---------------- arrangement ----------------
drums, music, fx, padb, bassb = bus(), bus(), bus(), bus(), bus()
sections = []
for s in T['scenes']:
    a = s['start'] + (s['ov'] / 2 if s['ov'] else 0)
    sections.append((a, s))
sections.append((T['dur'], None))

kick_times = []
_base_place = place

for idx in range(len(sections) - 1):
    a, s = sections[idx]
    b = sections[idx + 1][0]
    style = s['music']
    G = {'intro': 0.5, 'tension': 0.6, 'float': 0.8}.get(style, 1.0)
    def place(dst, sig, t, gain=1.0, pan=0.0, _G=G):
        _base_place(dst, sig, t, gain * _G, pan)
    grid = np.arange(np.ceil(a / BEAT - 1e-6) * BEAT, b - 1e-6, BEAT)

    # transition sound at the start of this section
    if idx > 0:
        if s['tin'] in ('flash', 'zoom', 'zoomthru') or style in ('drop', 'outro', 'peak'):
            place(fx, impact(1.0 if style in ('drop', 'outro') else 0.7), a, 0.9)
        else:
            place(fx, whoosh(), a - 0.45, 0.75, pan=-0.3 if idx % 2 else 0.3)

    if style == 'intro':
        k = 9 / s['dur']
        place(padb, drone(b - a + 1.0), a, 1.0)
        place(padb, pad([50, 57, 62, 66], b - a, vel=0.8, bright=1400, attack=2.2), a, 1.0)
        for i in range(8):  # one bell per petal
            place(music, bell(PENTA[i % len(PENTA)] + 12, 0.8), a + (0.4 + 0.12 * i) / k, 1.0, pan=(i - 3.5) / 5)
        place(music, sitar(62, 1.4, 1.2), a + 3.0 / k, 1.0)
        place(music, sitar(69, 1.4, 0.9), a + 3.5 / k, 1.0, pan=0.2)
        place(music, sitar(74, 2.0, 0.9), a + 4.3 / k, 1.0, pan=-0.2)

    elif style == 'tension':
        end = s['dur'] - (2.6 if s['short'] else 3.6)
        collapse = a + end - s['ov'] / 2
        for t in np.arange(a, collapse, BEAT / 2):
            place(bassb, bass(38, BEAT / 2 * 0.8, 0.8), t, 1.0)
            place(drums, hat(vel=0.6 if (t / (BEAT / 2)) % 2 else 1.0), t, 1.0, pan=0.25)
        for t in np.arange(a, collapse, BEAT):
            place(drums, kick(0.55), t, 1.0)
        nb = 26 if not s['short'] else 18
        for i in range(nb):  # notification blips, denser over time
            tt = a + (0.5 + (i / nb) * (end - 1.6)) - s['ov'] / 2 + rng.uniform(0, 0.3)
            place(fx, blip(rng.choice([1568, 1760, 2093, 2349])), tt, 0.9, pan=rng.uniform(-0.8, 0.8))
        place(padb, pad([50, 57, 62, 65], collapse - a, vel=0.7, bright=900, attack=1.5), a, 1.0)
        place(fx, riser(collapse - a - 0.5, 0.8), a + 0.5, 1.0)
        place(fx, impact(0.6), collapse + 0.6, 1.0)
        place(padb, pad([47, 54, 59, 62], b - collapse - 0.2, vel=0.9, bright=1600, attack=0.3), collapse + 0.6, 1.0)
        place(fx, riser(1.4, 1.0), b - 1.4, 1.0)

    elif style in ('groove', 'groove2', 'drop', 'peak'):
        energy = {'drop': 1.0, 'groove': 0.85, 'groove2': 0.95, 'peak': 1.1}[style]
        for t in grid:
            bi = int(round(t / BEAT))
            beat = bi % 4
            root, notes = chord_at(t)
            place(drums, kick(0.9 * energy), t, 1.0)
            kick_times.append(t)
            if beat in (1, 3):
                place(drums, clap(0.8 * energy), t, 1.0)
            place(drums, hat(vel=0.7), t + BEAT / 2, 1.0, pan=0.3)
            if style in ('groove2', 'peak') or bi % 8 == 7:
                place(drums, hat(True, 0.5), t + BEAT / 2, 1.0, pan=0.3)
            for q in range(4):
                place(drums, shaker(0.5 + 0.4 * (q == 2)), t + q * BEAT / 4, 1.0, pan=-0.35)
            # bass: root on the beat, octave on the off
            place(bassb, bass(root - 12 + 12, BEAT * 0.45, 0.9), t, 1.0)
            place(bassb, bass(root + 12 - 12 + (12 if beat % 2 else 0), BEAT * 0.3, 0.6), t + BEAT * 0.75, 1.0)
            if beat == 0:
                place(padb, pad(notes, BAR, 0.9 * energy, bright=2600), t, 1.0)
            if beat in (0, 2) or style == 'peak':
                place(music, stab([n + 12 for n in notes[:3]], 0.5), t + BEAT * 0.5, 1.0, pan=0.15)
            # tabla
            if style in ('groove2', 'peak', 'drop'):
                place(drums, tabla_ge(0.6), t, 1.0, pan=-0.15)
                place(drums, tabla_na(0.7), t + BEAT * 0.5, 1.0, pan=0.2)
                if beat == 3:
                    place(drums, tabla_tin(0.6), t + BEAT * 0.75, 1.0, pan=0.25)
            elif beat in (1, 3):
                place(drums, tabla_na(0.45), t + BEAT * 0.75, 1.0, pan=0.2)
            # sitar melody: one motif per 2 bars, phrases every other phrase
            if bi % 8 == 0 and (bi // 8) % 2 == (0 if style != 'peak' else (bi // 8) % 2):
                mot = MOTIFS[(bi // 8 + idx) % len(MOTIFS)]
                for (o, deg, d) in mot:
                    tt = t + o * BEAT * 2
                    if tt < b - 0.2:
                        oct_ = 12 if style == 'peak' else 0
                        place(music, sitar(PENTA[deg] + oct_, d * BEAT * 2, 0.8), tt, 1.0, pan=0.1)

    elif style == 'float':
        for t in grid:
            bi = int(round(t / BEAT)); beat = bi % 4
            root, notes = chord_at(t)
            if beat == 0:
                place(padb, pad(notes, BAR, 1.0, bright=1800, attack=0.4), t, 1.0)
                place(bassb, bass(root - 12, BAR * 0.9, 0.55), t, 1.0)
            for q in range(4):  # arpeggio
                m = sorted(notes)[(bi * 4 + q) % 4] + 12
                place(music, bell(m, 0.55 + 0.25 * (q == 0), 0.9), t + q * BEAT / 4, 1.0, pan=0.4 * np.sin(bi + q))
            place(drums, shaker(0.35), t + BEAT / 2, 1.0, pan=-0.3)
            if beat == 2:
                place(drums, clap(0.35), t, 1.0)
            if beat == 0 and bi % 16 == 0:
                place(drums, kick(0.5), t, 1.0)

    elif style == 'outro':
        root, notes = CHORDS[2]
        place(fx, impact(1.1), a, 1.0)
        place(padb, pad([50, 57, 62, 66, 69, 76], b - a, 1.1, bright=3000, attack=0.05), a, 1.0)
        place(bassb, bass(38, 3.0, 0.9), a, 1.0)
        place(padb, drone(b - a), a, 0.8)
        for i, (o, m) in enumerate([(1.2, 69), (1.6, 71), (2.0, 74), (3.0, 78), (3.6, 76), (4.2, 74)]):
            place(music, sitar(m, 1.2, 0.85), a + o, 1.0, pan=(i - 2.5) / 6)
        for i in range(8):
            place(music, bell(PENTA[i] + 12, 0.6), a + 4.2 + i * 0.08, 1.0, pan=(i - 3.5) / 5)
        place(music, sitar(62, 3.0, 1.0, bend=False), b - 3.2, 1.0)

# sidechain pump on pads & bass from kicks
side = np.ones(N)
for kt in kick_times:
    i = int(kt * SR); n = int(0.32 * SR)
    j = min(N, i + n)
    curve = 1 - 0.55 * np.exp(-np.arange(j - i) / SR * 9)
    side[i:j] = np.minimum(side[i:j], curve)
padb *= side
bassb *= 0.5 + 0.5 * side

# reverb send
ir_n = int(2.6 * SR); ir_t = np.arange(ir_n) / SR
ir = np.stack([rng.normal(0, 1, ir_n) * np.exp(-ir_t * 2.4), rng.normal(0, 1, ir_n) * np.exp(-ir_t * 2.4)])
ir[:, : int(0.012 * SR)] = 0
ir = lp(ir, 6000) * 0.05
send = music * 0.8 + padb * 0.5 + fx * 0.3 + drums * 0.06
wet = np.stack([fftconvolve(send[c], ir[c])[:N] for c in range(2)])

mix = drums * 0.9 + music * 1.0 + fx * 0.85 + padb * 1.0 + bassb * 1.0 + wet * 1.0
mix = hp(mix, 28)
# glue + limiter
peak = np.max(np.abs(mix))
mix = mix / peak * 0.95
# fades
fi = int(0.05 * SR); mix[:, :fi] *= np.linspace(0, 1, fi)
fo = int(2.5 * SR); mix[:, -fo:] *= np.linspace(1, 0, fo) ** 2

out = (np.clip(mix.T, -1, 1) * 32767).astype(np.int16)
import wave
w = wave.open(__file__.replace('compose.py', f'music_{cut}.wav'), 'wb')
w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(out.tobytes()); w.close()
print(cut, f'{DUR:.1f}s', 'rms', float(np.sqrt(np.mean(mix ** 2))))
