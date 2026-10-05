"""Soundtrack for film 2: a re-timed music bed plus a sound-design layer
synced to every transition and on-screen action.

Music: "Presenterator" by Kevin MacLeod (incompetech.com), CC BY 4.0.
It is stretched from 130 to 120 BPM (Rubber Band) so its beats sit on the
film's transition midpoints (x.25 / x.75 s), then rearranged on its 8-bar
phrase grid:
  hero flash 0:17.25 = phrase start, after a riser and a half-second gap
  breakdown 1 under "It keeps watch" (2:09)
  breakdown 2 under the document vault and trust (4:01), build through dark mode
  final section drops on the montage flash (4:25.25), extended to carry the end card

    ffmpeg -i Presenterator.mp3 -af "rubberband=tempo=0.923077:transients=crisp:detector=compound:window=standard:pitchq=quality:channels=together,aresample=44100" -ac 2 pres120.wav
    python3 soundtrack.py pres120.wav soundtrack.wav
Then normalise to -14 LUFS (see README).
"""
import sys
import wave

import numpy as np
from scipy.signal import butter, fftconvolve, istft, sosfilt, sosfiltfilt, stft

SR = 44100
D = 290.5
N = int(D * SR)
rng = np.random.default_rng(2026)


# ---------------------------------------------------------------- utils
def read_wav(p):
    w = wave.open(p); x = np.frombuffer(w.readframes(w.getnframes()), np.int16).reshape(-1, w.getnchannels()).T / 32768.0
    return x.astype(np.float64)


def ts(sec):
    return np.arange(int(sec * SR)) / SR


def lp(x, f, o=2): return sosfilt(butter(o, min(f, SR / 2 - 200) / (SR / 2), 'low', output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f / (SR / 2), 'high', output='sos'), x)
def bp(x, a, b, o=2): return sosfilt(butter(o, [a / (SR / 2), min(b, SR / 2 - 200) / (SR / 2)], 'band', output='sos'), x)


def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)


def stereo(mono, pan=0.0, width=0.0):
    """Constant-power pan; width adds a few ms of decorrelation."""
    pan = np.clip(pan, -1, 1)
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    L, R = mono * l * 1.414, mono * r * 1.414
    if width:
        d = int(width * 0.006 * SR); R = np.concatenate([np.zeros(d), R])[:len(R)]
    return np.stack([L, R])


def pan_sweep(mono, p0, p1):
    p = np.linspace(p0, p1, len(mono)); l, r = np.cos((p + 1) * np.pi / 4), np.sin((p + 1) * np.pi / 4)
    return np.stack([mono * l * 1.414, mono * r * 1.414])


def band_sweep(dur, f0, f1, q=0.35, shape='bell', f_mid=None):
    """Noise shaped by a moving Gaussian band in log-frequency (clean filter sweeps)."""
    n = int(dur * SR); x = rng.normal(0, 1, n + 2048)
    f, t, Z = stft(x, fs=SR, nperseg=1024, noverlap=768)
    p = np.clip(t / dur, 0, 1)
    if f_mid:
        c = np.where(p < 0.5, f0 * (f_mid / f0) ** (p * 2), f_mid * (f1 / f_mid) ** ((p - 0.5) * 2))
    else:
        c = f0 * (f1 / f0) ** p
    lf = np.log(np.maximum(f, 1))[:, None]
    g = np.exp(-0.5 * ((lf - np.log(c)[None, :]) / q) ** 2)
    _, y = istft(Z * g, fs=SR, nperseg=1024, noverlap=768)
    y = y[:n]; y /= (np.max(np.abs(y)) + 1e-9)
    tt = np.arange(n) / n
    if shape == 'bell': e = np.sin(np.pi * tt) ** 1.6
    elif shape == 'rise': e = tt ** 2.4
    else: e = (1 - tt) ** 2
    return y * e


# ---------------------------------------------------------------- reverb
def make_ir(sec=1.5, damp=5000):
    n = int(sec * SR); t = np.arange(n) / SR
    ir = np.stack([rng.normal(0, 1, n), rng.normal(0, 1, n)]) * np.exp(-t * 4.2)
    ir = np.stack([lp(c, damp) for c in ir]); ir[:, :int(0.008 * SR)] = 0
    for d, a in [(0.011, 0.5), (0.019, 0.35), (0.027, 0.25)]:
        ir[0, int(d * SR)] += a; ir[1, int((d + 0.003) * SR)] += a
    return ir / np.sqrt(np.sum(ir ** 2) / 2) * 0.35


# ---------------------------------------------------------------- instruments (F major)
F_PENT = [65, 67, 69, 72, 74, 77, 79, 81, 84, 86, 89, 91, 93]  # F G A C D ...


def bell(m, dur=1.2, amp=1.0, bright=1.0):
    t = ts(dur); f = mtof(m)
    y = (np.sin(2 * np.pi * f * t) * np.exp(-t * 3.2) + 0.45 * bright * np.sin(2 * np.pi * f * 2.0 * t) * np.exp(-t * 5)
         + 0.2 * bright * np.sin(2 * np.pi * f * 3.0 * t) * np.exp(-t * 8) + 0.08 * bright * np.sin(2 * np.pi * f * 4.17 * t) * np.exp(-t * 12))
    return y * np.minimum(1, t / 0.002) * amp


def glock(m, amp=1.0):
    t = ts(0.9); f = mtof(m)
    y = np.sin(2 * np.pi * f * t) * np.exp(-t * 5) + 0.3 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 14) + 0.15 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 25)
    return y * np.minimum(1, t / 0.001) * amp


# ---------------------------------------------------------------- sound effects
def sfx_whoosh(dur=0.7, lo=300, hi=3200, amp=1.0):
    return band_sweep(dur, lo, lo * 1.2, q=0.45, f_mid=hi, shape='bell') * amp


def sfx_riser(dur=2.0, amp=1.0):
    n = int(dur * SR); t = np.arange(n) / SR; p = t / dur
    noise = band_sweep(dur, 250, 9000, q=0.55, shape='rise')
    f = mtof(53) * (2 ** (p * 2.0))  # F3 → F5
    ph = 2 * np.pi * np.cumsum(f) / SR
    tone = (np.sin(ph) + 0.5 * np.sin(ph * 1.005 + 1) + 0.3 * np.sin(2 * ph)) * p ** 2.2 * (0.7 + 0.3 * np.sin(2 * np.pi * (4 + 14 * p) * t))
    y = noise * 0.8 + lp(tone, 4000) * 0.22
    y[-int(0.012 * SR):] *= np.linspace(1, 0, int(0.012 * SR))
    return y * amp


def sfx_impact(amp=1.0, tail=2.4):
    t = ts(tail)
    f = 36 + 60 * np.exp(-t * 9)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.4)
    body = lp(rng.normal(0, 1, len(t)), 1400) * np.exp(-t * 16) * 0.9
    thud = np.sin(2 * np.pi * 95 * t) * np.exp(-t * 9) * 0.6
    crash = hp(rng.normal(0, 1, len(t)), 4500) * np.exp(-t * 1.9) * 0.22
    y = np.tanh((sub * 1.1 + body + thud) * 1.4) + crash
    return y * amp


def sfx_softhit(amp=1.0):
    t = ts(0.6)
    y = np.sin(2 * np.pi * (60 + 40 * np.exp(-t * 20)) * t) * np.exp(-t * 7) + lp(rng.normal(0, 1, len(t)), 900) * np.exp(-t * 30) * 0.5
    return y * amp


def sfx_click(amp=1.0):
    t = ts(0.08)
    y = hp(rng.normal(0, 1, len(t)), 3000) * np.exp(-t * 900) * 0.7 + np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 260) * 0.5 \
        + np.sin(2 * np.pi * 170 * t) * np.exp(-t * 60) * 0.5
    return y * amp


def sfx_key(amp=1.0):
    t = ts(0.06); c = rng.uniform(1800, 4200)
    y = bp(rng.normal(0, 1, len(t)), c * 0.7, c * 1.4) * np.exp(-t * rng.uniform(380, 520)) \
        + np.sin(2 * np.pi * rng.uniform(380, 620) * t) * np.exp(-t * 120) * 0.35
    return y * amp * rng.uniform(0.75, 1.0)


def sfx_pop(m=81, amp=1.0):
    t = ts(0.22); f = mtof(m) * (0.62 + 0.38 * (1 - np.exp(-t * 90)))
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = (np.sin(ph) + 0.18 * np.sin(2 * ph)) * np.exp(-t * 22) + hp(rng.normal(0, 1, len(t)), 2500) * np.exp(-t * 700) * 0.25
    return y * np.minimum(1, t / 0.0015) * amp


def sfx_swish(amp=1.0, dur=0.32):
    return band_sweep(dur, 900, 1400, q=0.4, f_mid=5500, shape='bell') * amp


def sfx_tick(amp=1.0):
    t = ts(0.02)
    return (hp(rng.normal(0, 1, len(t)), 4500) * np.exp(-t * 1400) + np.sin(2 * np.pi * 3600 * t) * np.exp(-t * 500) * 0.4) * amp


def sfx_ping(amp=1.0):
    y = np.zeros(int(1.4 * SR))
    for o, m in [(0, 84), (0.11, 89)]:
        b = bell(m, 1.2, 1.0, 0.8); i = int(o * SR); y[i:i + len(b)] += b[:len(y) - i]
    return y * amp


def sfx_success(amp=1.0, root=77):
    y = np.zeros(int(1.6 * SR))
    for k, m in enumerate([root, root + 4, root + 7, root + 12]):
        b = bell(m, 1.3, 0.8 + 0.1 * k, 0.9); i = int(k * 0.055 * SR); y[i:i + len(b)] += b[:len(y) - i]
    return y * amp


def sfx_coin(amp=1.0):
    t = ts(1.0); y = np.zeros(len(t))
    for o in (0, 0.075):
        f = 2093.0 * (1.0 if o == 0 else 1.335); i = int(o * SR); tt = t[:len(t) - i]
        s = sum(a * np.sin(2 * np.pi * f * r * tt) * np.exp(-tt * d) for r, a, d in [(1, 1, 5), (2.41, 0.5, 9), (3.92, 0.3, 14), (5.2, 0.15, 20)])
        y[i:] += s
    return y * amp * 0.5


def sfx_flap(dur=0.6, amp=1.0, rate=26):
    y = np.zeros(int((dur + 0.05) * SR)); k = 0.0
    while k < dur:
        c = sfx_key(1.0) * 0.7; t = ts(len(c) / SR); c += np.sin(2 * np.pi * 1100 * t) * np.exp(-t * 180) * 0.25
        i = int(k * SR); y[i:i + len(c)] += c[:len(y) - i]; k += 1 / rate * rng.uniform(0.7, 1.3)
    return y * amp


def sfx_print(amp=1.0):
    t = ts(0.22)
    motor = bp(rng.normal(0, 1, len(t)), 1800, 6000) * (0.6 + 0.4 * np.sin(2 * np.pi * 90 * t)) * np.sin(np.pi * t / t[-1]) * 0.5
    y = motor.copy()
    for o in (0.0, 0.07, 0.14):
        c = sfx_tick(0.8); i = int(o * SR); y[i:i + len(c)] += c[:len(y) - i]
    return y * amp


def sfx_clocktick(m, amp=1.0):
    t = ts(0.06); f = mtof(m)
    return (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * f * 2.3 * t)) * np.exp(-t * 90) * amp


def sfx_powerdown(amp=1.0):
    t = ts(0.9); f = 420 * np.exp(-t * 3.2) + 40
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.2) * 0.8 + lp(rng.normal(0, 1, len(t)), 600) * np.exp(-t * 6) * 0.3) * amp


def sfx_poof(amp=1.0):
    return band_sweep(0.4, 3500, 300, q=0.6, shape='fall') * amp


def sfx_drop(amp=1.0):
    t = ts(0.5); f = 1700 * np.exp(-t * 2.4) + 500
    g = np.sin(2 * np.pi * np.cumsum(f) / SR) * (t / 0.5) * 0.25
    return np.concatenate([g, sfx_softhit(0.8)[:int(0.3 * SR)]]) * amp


def sfx_shimmer(notes, gap=0.07, amp=1.0, inst=glock):
    y = np.zeros(int((gap * len(notes) + 1.2) * SR))
    for k, m in enumerate(notes):
        b = inst(m); i = int(k * gap * SR); y[i:i + len(b)] += b[:len(y) - i]
    return y * amp


def sfx_swell(dur=2.0, amp=1.0):
    t = ts(dur); y = np.zeros(len(t))
    for m in (53, 57, 60, 65, 67):
        f = mtof(m); y += sum(np.sin(2 * np.pi * f * k * t + k) / k for k in range(1, 6))
    y = lp(y, 2400) * (t / dur) ** 2.5
    y[-int(0.01 * SR):] *= np.linspace(1, 0, int(0.01 * SR))
    return y / np.max(np.abs(y) + 1e-9) * amp


def sfx_glass(amp=1.0):
    t = ts(0.08); return np.sin(2 * np.pi * rng.uniform(3000, 5200) * t) * np.exp(-t * 70) * amp


# ---------------------------------------------------------------- mix buses
sfx = np.zeros((2, N)); duck = np.zeros(N); send = np.zeros((2, N))


def put(sig, at, gain=1.0, pan=0.0, rev=0.15, duckw=0.0, width=0.3, sweep=None):
    if sig.ndim == 1:
        st = pan_sweep(sig, *sweep) if sweep else stereo(sig, pan, width)
    else:
        st = sig
    i = int(at * SR)
    if i >= N: return
    if i < 0: st = st[:, -i:]; i = 0
    j = min(N, i + st.shape[1]); st = st[:, :j - i] * gain
    sfx[:, i:j] += st; send[:, i:j] += st * rev
    if duckw: duck[i:j] = np.maximum(duck[i:j], np.abs(st).max(0) * duckw)


def ending_at(sig, at, **k):  # place so the sound ENDS at `at`
    put(sig, at - len(sig) / SR if sig.ndim == 1 else at - sig.shape[1] / SR, **k)


# ---------------------------------------------------------------- music bed
def build_bed(src):
    x = read_wav(src)
    P = lambda k: 0.05 + 16 * k - 0.015            # phrase starts in the 120 BPM file, just before the kick
    segs = [(0.0, P(14)), (P(13), P(14)), (P(14), P(15)), (P(15) + 8, P(16)), (P(16), P(17)), (P(17) - 8, P(17)), (P(17), x.shape[1] / SR)]
    xf = int(0.006 * SR); out = []
    for a, b in segs:
        s = x[:, int(a * SR):int(b * SR)].copy()
        s[:, :xf] *= np.linspace(0, 1, xf); s[:, -xf:] *= np.linspace(1, 0, xf)
        out.append(s)
    # overlap the 6 ms fades
    y = out[0]
    for s in out[1:]:
        y = np.concatenate([y[:, :-xf], y[:, -xf:] + s[:, :xf], s[:, xf:]], axis=1)
    d = int(1.2 * SR)                               # beats land on x.25 / x.75; phrase 1 on the hero flash
    y = np.concatenate([np.zeros((2, d)), y], axis=1)
    y = np.pad(y, ((0, 0), (0, max(0, N - y.shape[1]))))[:, :N]
    t = np.arange(N) / SR
    env = lambda k: np.interp(t, np.array(k)[:, 0], np.array(k)[:, 1])
    lpd = np.stack([sosfiltfilt(butter(4, 600 / (SR / 2), 'low', output='sos'), c) for c in y])
    muff = env([[0, 1], [12.0, 1], [15.0, 0.8], [16.7, 0.55], [17.25, 0], [D, 0]])
    g = env([[0, -8], [10.5, -7], [15.0, -4], [16.70, -4], [16.74, -60], [17.24, -60], [17.25, 0],
             [94, 0], [94.6, -2.5], [111.2, -2.5], [111.8, -1.5], [126.8, -1.5], [127.2, 0],
             [D - 0.6, 0], [D, -60]])
    return (muff * lpd + (1 - muff) * y) * 10 ** (g / 20)


# ---------------------------------------------------------------- cue sheet
S = dict(ping=0, spark=10.5, hero=17, find=29.5, home=51, food=67.5, ask=94, doit=111.5, watch=127, translate=139.5, feed=152,
         celebrate=168.5, sports=186, market=195.5, safety=215, money=232.5, trust=246, dark=258.5, montage=265, cta=276.5)


def at(scene, lt): return S[scene] + lt


def typing(scene, start, nchars, cps, gain=0.5, pan=0.4):
    for i in range(nchars):
        put(sfx_key(), at(scene, start + i / cps + rng.uniform(-0.008, 0.008)), gain, pan + rng.uniform(-0.1, 0.1), rev=0.05)


def ticks(t0, t1, r0, r1, gain=0.25, pan=0.0):
    t = t0
    while t < t1:
        p = (t - t0) / (t1 - t0); put(sfx_tick(), t, gain * (0.8 + 0.2 * rng.random()), pan, rev=0.04); t += 1 / (r0 + (r1 - r0) * p)


def cues():
    # ---- transitions (cut moment = start + 0.25)
    for sc in ('spark', 'translate', 'trust'):
        c = S[sc] + 0.25
        ending_at(sfx_riser(1.6, 0.55), c, gain=1.0, rev=0.25, duckw=0.4)
        put(sfx_whoosh(0.9, 250, 4000), c - 0.45, 0.8, sweep=(-0.4, 0.4), rev=0.25, duckw=0.4)
        put(sfx_softhit(1.0), c, 0.8, rev=0.3)
    # find: the hero push-in rides one long riser into the search bar
    ending_at(sfx_riser(2.6, 0.7), S['find'] + 0.25, rev=0.25, duckw=0.5)
    put(sfx_impact(0.55, 1.6), S['find'] + 0.25, 1.0, rev=0.3, duckw=0.8)
    # flashes: the big drops
    for sc, rl in (('hero', 2.0), ('montage', 1.6)):
        c = S[sc] + 0.25
        ending_at(sfx_riser(rl, 0.9), c, rev=0.3, duckw=0.6)
        put(sfx_impact(1.0), c, 1.0, rev=0.35, duckw=1.0)
    for sc in ('home', 'doit', 'celebrate', 'money'):            # whips: content flies right → left
        put(sfx_whoosh(0.75, 280, 3600), S[sc] + 0.25 - 0.375, 0.95, sweep=(0.7, -0.7), rev=0.2, duckw=0.5)
    for sc in ('food', 'feed', 'market'):                        # petals: bloom
        put(sfx_whoosh(0.8, 400, 5000), S[sc] - 0.15, 0.7, sweep=(-0.3, 0.3), rev=0.3, duckw=0.4)
        put(sfx_shimmer([77, 81, 84, 89], 0.05, 0.35), S[sc] + 0.2, 1.0, rev=0.5)
    put(sfx_swell(1.4, 0.5), S['ask'] - 1.15, 1.0, rev=0.4, duckw=0.3)  # iris into Saathi
    put(sfx_shimmer([84, 88, 91, 96], 0.06, 0.4, bell), S['ask'] + 0.25, 1.0, rev=0.6)
    for sc in ('watch', 'sports', 'dark'):                       # slices: three bands
        for k, p in enumerate((-0.6, 0.6, -0.6)):
            put(sfx_swish(0.7, 0.26), S[sc] + 0.05 + k * 0.08, 1.0, sweep=(p, -p), rev=0.15, duckw=0.3)
    put(sfx_whoosh(0.9, 200, 2500), S['safety'] - 0.2, 1.0, sweep=(-0.8, 0.8), rev=0.25, duckw=0.6)  # colour wipe
    put(sfx_softhit(1.0), S['safety'] + 0.25, 0.9, rev=0.3)
    # end card petal: impact + bloom
    put(sfx_whoosh(0.9, 300, 5000), S['cta'] - 0.2, 0.8, sweep=(-0.3, 0.3), rev=0.3, duckw=0.5)
    ending_at(sfx_riser(1.4, 0.6), S['cta'] + 0.25, rev=0.3, duckw=0.5)
    put(sfx_impact(0.7), S['cta'] + 0.25, 1.0, rev=0.4, duckw=0.8)

    # ---- ping: the opening
    put(sfx_ping(0.9), at('ping', 0.2), 1.0, 0.1, rev=0.35)
    t = 1.2
    while t < 8.5:                                               # windows lighting up, ever faster
        put(sfx_glass(0.12), at('ping', t), 1.0, rng.uniform(-0.9, 0.9), rev=0.3); t += 1 / (2 + 2 ** ((t - 1.2) * 0.8))
    for lt in (2.4, 4.2, 6.0): put(sfx_softhit(0.85), at('ping', lt), 1.0, -0.2, rev=0.3)
    ticks(at('ping', 6.0), at('ping', 7.6), 34, 16, 0.18, -0.3)
    put(sfx_powerdown(0.7), at('ping', 8.55), 1.0, rev=0.4)
    put(sfx_softhit(1.0), at('ping', 9.0), 1.0, rev=0.4)
    # ---- spark: the bloom
    put(sfx_whoosh(1.3, 150, 1800, 0.6), at('spark', 0.1), 1.0, rev=0.4)
    put(sfx_shimmer([65, 69, 72, 77, 81, 84, 89, 93], 0.1, 0.55, bell), at('spark', 1.5), 1.0, rev=0.6)
    put(sfx_softhit(0.8), at('spark', 2.4), 1.0, rev=0.4)
    # ---- hero
    put(sfx_whoosh(0.5, 400, 4000, 0.6), at('hero', 0.35), 1.0, sweep=(-0.5, 0.5))
    put(sfx_whoosh(0.5, 400, 4000, 0.5), at('hero', 0.95), 1.0, sweep=(0.5, -0.5))
    for k, (lt, p) in enumerate(((3.25, -0.5), (3.45, -0.6), (3.6, 0.6), (3.75, 0.55))): put(sfx_pop(F_PENT[5 + k], 0.6), at('hero', lt), 1.0, p)
    put(sfx_softhit(0.6), at('hero', 3.4), 1.0)
    put(sfx_whoosh(0.9, 3000, 500, 0.45), at('hero', 8.3), 1.0, sweep=(0.3, -0.3))
    # ---- find
    put(sfx_swish(0.5), at('find', 0.6), 1.0, 0.0)
    typing('find', 1.4, 13, 11, 0.55, 0.0)
    put(sfx_pop(81, 0.6), at('find', 2.9), 1.0)
    put(sfx_click(0.9), at('find', 4.6), 1.0, 0.55)
    put(sfx_success(0.45, 77), at('find', 4.75), 1.0, 0.4, rev=0.4)
    put(sfx_swish(0.55), at('find', 5.3), 1.0, sweep=(0.2, -0.2))
    for i in range(6): put(sfx_pop(F_PENT[3 + i], 0.5), at('find', 6.4 + i * 0.32), 1.0, (i - 2.5) * 0.15)
    put(sfx_success(0.55, 77), at('find', 8.3), 1.0, rev=0.45)
    for i in range(3): put(sfx_pop(F_PENT[7 + i], 0.4), at('find', 8.6 + i * 0.2), 1.0, (i - 1) * 0.4)
    put(sfx_swish(0.55), at('find', 11.0), 1.0, sweep=(0.2, -0.3))
    put(sfx_whoosh(0.6, 400, 3000, 0.6), at('find', 11.7), 1.0, sweep=(0.8, 0.3))
    put(sfx_drop(0.6), at('find', 12.95), 1.0, 0.3)
    put(sfx_pop(84, 0.55), at('find', 13.8), 1.0, -0.4); put(sfx_shimmer([84, 89], 0.06, 0.25), at('find', 13.85), 1.0, -0.4, rev=0.5)
    put(sfx_pop(77, 0.4), at('find', 14.6), 1.0, 0.3)
    put(sfx_click(0.85), at('find', 16.0), 1.0, 0.3)
    for i in range(8): put(sfx_pop(F_PENT[2 + i], 0.35), at('find', 16.75 + i * 0.12), 1.0, -0.6 + i * 0.1)
    # ---- home
    for lt in (1.6, 3.4, 5.2, 7.0): put(sfx_pop(F_PENT[4], 0.3), at('home', lt), 1.0, -0.5)
    for lt in (1.6, 3.4, 5.2, 7.2): put(sfx_swish(0.25, 0.5), at('home', lt), 1.0, 0.5)
    put(sfx_whoosh(0.6, 2500, 400, 0.5), at('home', 8.8), 1.0, sweep=(0.5, 0.0))
    for k in range(9): put(sfx_pop(F_PENT[1 + k], 0.38), at('home', 9.4 + k * 0.09), 1.0, -0.7 + k * 0.17)
    ending_at(sfx_riser(1.2, 0.45), at('home', 16.75), rev=0.3)
    # ---- food
    put(sfx_click(0.9), at('food', 3.0), 1.0, 0.45)
    put(sfx_success(0.5, 77), at('food', 3.3), 1.0, 0.45, rev=0.45)
    for i in range(7): put(sfx_pop(F_PENT[2 + i], 0.3), at('food', 5.4 + i * 0.12), 1.0, -0.8 + i * 0.12)
    for i in range(5): put(sfx_tick(0.5), at('food', 6.6 + i * 0.15), 1.0, -0.8 + i * 0.12)
    put(sfx_whoosh(0.7, 300, 3500, 0.7), at('food', 8.55), 1.0, sweep=(0.6, -0.6))
    for i in range(4): put(sfx_shimmer([F_PENT[5 + i * 1], F_PENT[7 + i]], 0.06, 0.45, bell), at('food', 10.0 + i * 1.6), 1.0, -0.6 + i * 0.4, rev=0.4)
    put(sfx_whoosh(0.7, 300, 3500, 0.7), at('food', 17.4), 1.0, sweep=(-0.6, 0.6))
    for i in range(3): put(sfx_pop(F_PENT[5 + i], 0.5), at('food', 19.0 + i * 0.4), 1.0, -0.1 + i * 0.3)
    ticks(at('food', 19.0), at('food', 21.4), 28, 10, 0.12, 0.2)
    put(sfx_success(0.35, 81), at('food', 21.4), 1.0, 0.5, rev=0.4)
    for i in range(2): put(sfx_pop(88 + i * 3, 0.4), at('food', 21.6 + i * 0.6), 1.0, 0.5)
    # ---- Saathi: ask
    typing('ask', 1.0, 19, 16, 0.5, 0.2)
    put(sfx_click(0.85), at('ask', 2.4), 1.0, 0.6)
    put(sfx_swish(0.5), at('ask', 2.6), 1.0, sweep=(0.6, 0.5))
    for lt in (3.3, 3.9): put(sfx_pop(86, 0.18), at('ask', lt), 1.0, -0.2, rev=0.5)
    put(sfx_tick(0.6), at('ask', 4.4), 1.0, -0.2)
    put(sfx_pop(81, 0.45), at('ask', 5.6), 1.0, 0.0)
    for i in range(27): put(sfx_tick(0.18), at('ask', 5.9 + i * 0.12), 1.0, -0.3 + 0.6 * (i / 27))
    for i in range(3): put(sfx_pop(F_PENT[6 + i], 0.42), at('ask', 9.2 + i * 0.2), 1.0, -0.4 + i * 0.4)
    for i in range(2): put(sfx_pop(F_PENT[9 + i], 0.3), at('ask', 10.4 + i * 0.25), 1.0, -0.2 + i * 0.4)
    for i in range(3): put(sfx_tick(0.35), at('ask', 11.8 + i * 0.5), 1.0, -0.7)
    # ---- Saathi: do
    typing('doit', 0.4, 49, 22, 0.45, 0.2)
    put(sfx_click(0.85), at('doit', 2.8), 1.0, 0.6)
    put(sfx_swish(0.5), at('doit', 3.0), 1.0, sweep=(0.6, 0.5))
    for lt in (3.7, 4.3): put(sfx_pop(86, 0.18), at('doit', lt), 1.0, 0.0, rev=0.5)
    put(sfx_pop(77, 0.55), at('doit', 5.0), 1.0, 0.35)
    for i in range(4): put(sfx_tick(0.45), at('doit', 5.4 + i * 0.6), 1.0, 0.35)
    put(sfx_swell(2.4, 0.18), at('doit', 8.6), 1.0, 0.3, rev=0.5)
    put(sfx_click(1.0), at('doit', 10.9), 1.0, 0.2)
    put(sfx_whoosh(0.6, 500, 5000, 0.6), at('doit', 11.15), 1.0, sweep=(0.3, 0.9))
    put(sfx_success(0.6, 77), at('doit', 11.9), 1.0, 0.35, rev=0.45)
    for i in range(4): put(sfx_pop(F_PENT[4 + i], 0.3), at('doit', 12.6 + i * 0.18), 1.0, -0.6)
    # ---- Saathi: watch
    put(sfx_pop(81, 0.45), at('watch', 0.6), 1.0, 0.5)
    put(sfx_pop(77, 0.5), at('watch', 1.6), 1.0, 0.35)
    put(sfx_click(0.9), at('watch', 4.4), 1.0, 0.2)
    put(sfx_shimmer([77, 84], 0.07, 0.35, bell), at('watch', 4.6), 1.0, 0.2, rev=0.5)
    put(sfx_swish(0.5), at('watch', 5.8), 1.0, sweep=(0.3, 0.4))
    t, k = 6.4, 0
    while t < 9.0:                                               # time-lapse: the clock speeds up
        put(sfx_clocktick(84 if k % 2 else 79, 0.4), at('watch', t), 1.0, 0.35, rev=0.2); k += 1; t += 1 / (3 + 22 * ((t - 6.4) / 2.6) ** 1.6)
    put(sfx_whoosh(2.4, 200, 1500, 0.35), at('watch', 6.4), 1.0, sweep=(-0.3, 0.3), rev=0.3)
    put(sfx_ping(1.0), at('watch', 9.25), 1.0, 0.35, rev=0.4)
    put(sfx_pop(81, 0.45), at('watch', 10.2), 1.0, 0.35)
    # ---- translate
    put(sfx_pop(77, 0.45), at('translate', 0.6), 1.0)
    for k in range(1, 12):
        put(sfx_swish(0.22, 0.18), at('translate', 1.6 + k * 0.78 - 0.05), 1.0, 0.0)
        put(glock(F_PENT[k % len(F_PENT)] + 12, 0.18), at('translate', 1.6 + k * 0.78), 1.0, rng.uniform(-0.3, 0.3), rev=0.4)
    for i in range(12): put(sfx_pop(F_PENT[i % 10 + 1], 0.28), at('translate', 11.0 + i * 0.05), 1.0, np.cos(i / 12 * 2 * np.pi - np.pi / 2) * 0.8)
    # ---- feed & poll
    for i in range(3): put(sfx_pop(60 + i * 2, 0.45), at('feed', 1.8 + i * 0.35), 1.0, 0.1 + i * 0.15)
    put(sfx_poof(0.55), at('feed', 4.45), 1.0, 0.25, rev=0.3)
    put(sfx_pop(77, 0.5), at('feed', 6.4), 1.0, 0.45)
    ticks(at('feed', 7.6), at('feed', 10.4), 10, 28, 0.15, 0.45)
    put(sfx_success(0.55, 77), at('feed', 10.4), 1.0, 0.45, rev=0.45)
    # ---- celebrate
    put(sfx_pop(72, 0.5), at('celebrate', 0.6), 1.0, -0.4)
    ticks(at('celebrate', 1.0), at('celebrate', 4.4), 30, 8, 0.13, -0.4)
    put(sfx_success(0.55, 77), at('celebrate', 4.4), 1.0, -0.4, rev=0.45)
    for i in range(23): put(sfx_pop(F_PENT[i % 9 + 3], 0.16), at('celebrate', 2.4 + i * 0.11), 1.0, 0.2 + (i % 5) * 0.1)
    put(sfx_whoosh(0.7, 2500, 400, 0.5), at('celebrate', 8.1), 1.0, sweep=(0.0, -0.6))
    put(sfx_swish(0.5), at('celebrate', 9.0), 1.0, sweep=(0.8, 0.5))
    for i in range(11): put(sfx_print(0.35), at('celebrate', 9.4 + 5.6 * i / 11), 1.0, 0.5, rev=0.08)
    # ---- sports
    put(sfx_swish(0.55), at('sports', 0.4), 1.0, sweep=(-0.8, -0.5))
    put(sfx_swish(0.55), at('sports', 1.4), 1.0, sweep=(0.8, 0.5))
    put(sfx_pop(77, 0.45), at('sports', 2.8), 1.0, 0.5)
    for i in range(4): put(sfx_pop(F_PENT[4 + i], 0.5), at('sports', 4.0 + i * 0.6), 1.0, 0.3 + i * 0.1)
    put(sfx_success(0.6, 77), at('sports', 5.95), 1.0, 0.5, rev=0.45)
    # ---- marketplace
    put(sfx_whoosh(1.4, 200, 2500, 0.55), at('market', 0.3), 1.0, sweep=(-0.8, 0.8), rev=0.3)
    for lt in (8.2, 11.15, 14.1, 17.05):
        put(sfx_whoosh(0.5, 600, 5000, 0.6), at('market', lt - 0.15), 1.0, sweep=(0.6, 0.2))
        put(sfx_pop(77, 0.4), at('market', lt + 0.35), 1.0, 0.4)
    # ---- safety
    for i in range(4): put(sfx_flap(0.4 + 0.5, 0.45, 24), at('safety', 0.6 + i * 0.25), 1.0, -0.7 + i * 0.45, rev=0.12)
    for i in range(4): put(sfx_click(0.5), at('safety', 1.5 + i * 0.25), 1.0, -0.7 + i * 0.45)
    put(sfx_pop(72, 0.5), at('safety', 6.2), 1.0, -0.4)
    for i in range(8): put(sfx_pop(F_PENT[2 + i], 0.3), at('safety', 6.8 + i * 0.08), 1.0, 0.3 + 0.08 * i)
    put(sfx_whoosh(1.0, 200, 2000, 0.5), at('safety', 10.5), 1.0, sweep=(-0.5, 0.5))
    put(sfx_swish(0.5), at('safety', 11.0), 1.0, sweep=(-0.9, -0.4))
    for i in range(9): put(sfx_drop(0.28), at('safety', 12.0 + i * 0.22 - 0.25), 1.0, -0.8 + 0.05 * i)
    for i in range(6): put(sfx_tick(0.4), at('safety', 12.4 + i * 0.25), 1.0, 0.5)
    # ---- money
    for i in range(2): put(sfx_pop(72 + i * 5, 0.5), at('money', 0.6 + i * 0.2), 1.0, -0.6 + i * 1.2)
    put(sfx_whoosh(1.6, 600, 4000, 0.5), at('money', 1.8), 1.0, sweep=(-0.6, 0.6))
    put(sfx_tick(0.6), at('money', 2.0), 1.0, -0.6)
    put(sfx_coin(1.0), at('money', 3.4), 1.0, 0.55, rev=0.35)
    put(sfx_success(0.55, 77), at('money', 3.55), 1.0, 0.55, rev=0.45)
    put(sfx_whoosh(0.7, 2500, 400, 0.45), at('money', 7.3), 1.0, sweep=(0.0, -0.5))
    put(sfx_pop(72, 0.45), at('money', 9.2), 1.0, 0.5)
    put(sfx_click(0.9), at('money', 11.6), 1.0, 0.3); put(sfx_shimmer([84, 89], 0.05, 0.25), at('money', 11.65), 1.0, 0.3, rev=0.4)
    # ---- trust
    put(sfx_swell(5.5, 0.22), at('trust', 0.2), 1.0, rev=0.5)
    put(sfx_softhit(0.6), at('trust', 2.2), 1.0, rev=0.4)
    for lt in (6.6, 8.7, 10.8):
        put(sfx_impact(0.42, 1.2), at('trust', lt), 1.0, rev=0.35, duckw=0.4)
    # ---- dark
    put(sfx_pop(72, 0.4), at('dark', 0.6), 1.0)
    put(sfx_click(1.0), at('dark', 2.2), 1.0)
    put(sfx_whoosh(1.3, 3000, 200, 0.55), at('dark', 2.35), 1.0, rev=0.4)
    # ---- montage: a hit on every word, a light swish on every other cut
    for b in range(1, 23):
        t = at('montage', 0.25 + b * 0.5)
        if b % 3 == 2: put(sfx_softhit(0.7), t, 1.0, rev=0.25); put(sfx_whoosh(0.35, 800, 6000, 0.35), t - 0.18, 1.0, sweep=(0.5, -0.5))
        elif b % 2 == 0: put(sfx_swish(0.18, 0.2), t - 0.1, 1.0, sweep=(-0.5, 0.5))
    # ---- end card
    put(sfx_shimmer([65, 69, 72, 77, 81, 84, 89, 93], 0.1, 0.55, bell), at('cta', 0.3), 1.0, rev=0.6)
    put(sfx_softhit(0.8), at('cta', 1.1), 1.0, rev=0.4)
    for i in range(2): put(sfx_pop(77 + i * 4, 0.45), at('cta', 2.9 + i * 0.2), 1.0, -0.3 + i * 0.6)
    put(sfx_shimmer([77, 81, 84, 89, 93, 96, 101, 105], 0.06, 0.3), at('cta', 4.2), 1.0, rev=0.6)


# ---------------------------------------------------------------- render
if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    bed = build_bed(src)
    cues()
    ir = make_ir()
    wet = np.stack([fftconvolve(send[c], ir[c])[:N] for c in range(2)])
    fx = sfx + wet
    # sidechain: dip the music under the big moments (attack 8 ms, release 300 ms)
    a, r = np.exp(-1 / (0.008 * SR)), np.exp(-1 / (0.3 * SR))
    env = np.zeros(N); e = 0.0
    dk = duck[::32]; ev = np.zeros(len(dk))
    for i, v in enumerate(dk):
        e = v + (e - v) * (a ** 32 if v > e else r ** 32); ev[i] = e
    env = np.interp(np.arange(N), np.arange(len(ev)) * 32, ev)
    gain = 10 ** (-np.clip(env * 9, 0, 6) / 20)
    mix = bed * gain * 0.9 + fx * 0.55
    if len(sys.argv) > 3:  # stems for checking the balance
        for name, sig in (('bed', bed * gain * 0.9), ('fx', fx * 0.55)):
            w = wave.open(f'{sys.argv[3]}_{name}.wav', 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
            w.writeframes((np.clip(sig.T, -1, 1) * 32767).astype(np.int16).tobytes()); w.close()
    mix = hp(mix, 25)
    peak = np.max(np.abs(mix)); mix = mix / peak * 0.95
    w = wave.open(dst, 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(mix.T, -1, 1) * 32767).astype(np.int16).tobytes()); w.close()
    print('ok', dst)
