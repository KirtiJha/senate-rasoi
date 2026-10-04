# Aangan launch film

Two cuts of an animated launch ad built from real recordings of the web app
(https://my-aangan.vercel.app), as a seekable HTML timeline:

- **Full film** — 4:32, every flow (`?cut=long`)
- **Short cut** — 1:45, for socials and launch posts (`?cut=short`)

No voiceover. Music is an original procedural score (`music/compose.py`).

## Files

| Path | What |
| --- | --- |
| `cuts.js` | Storyboards for both cuts: scenes, copy, clip time-maps, transitions |
| `ad.js`, `ad.css` | The engine: phones, lenses, kinetic type, scenes, transitions, player |
| `index.html` | Local page (render + preview) · `artifact.html` the published page |
| `media/clips/*.json` | Frame manifests for each recorded app flow (timing + tap points) |
| `media/video/*.mp4` | The recorded flows, used for live playback |
| `media/stills`, `media/dark` | Screens for the feature wall and dark-mode scene |
| `music/compose.py` | Score generator; reads `music/timing.json` exported from `cuts.js` |
| `render.mjs`, `build_video.sh` | Frame-accurate 1080p30 renderer → MP4 |
| `out/` | Rendered films: short cut 1080p, full film 720p (the 1080p full master is 136 MB, too large for git) |

## Rebuild

```sh
python3 -m http.server 8765            # in this folder
# music (after editing cuts.js, re-export timing.json first)
python3 music/compose.py long && python3 music/compose.py short
# video — needs the raw frame folders linked at ./frames/<clip>/NNNN.jpg
./build_video.sh short out 3 && ./build_video.sh long out 3
```

Rendering uses `?render=1`, where every frame is a pure function of time and
clips are drawn from their JPEG frames, so output is deterministic.

## Edit the copy

All headlines, captions and timings live in `cuts.js`. Wrap words in `*…*`
to highlight them. The end card (Android + web URL) is in `scCta` in `ad.js`.
