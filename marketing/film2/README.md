# Aangan — "One Courtyard" (film 2)

A 4:50 long-form launch film in a product-ad style. Instead of watching whole
phone screens, real UI is lifted out of the app (captured at 3×) and the key
moments are rebuilt large, with camera moves and modern transitions. It is
separate from the first films in `../ad`.

## Story

| Time | Scene | What happens |
| --- | --- | --- |
| 0:00 | Ping | One chat bubble becomes a skyline of lit windows: 400 flats, 14 groups, 3,248 unread |
| 0:10 | Spark | Zoom into one window; the Aangan flower blooms |
| 0:17 | Hero | The phone spins in; the home screen explodes into real cards |
| 0:29 | 01 Find your society | Search "DS Max Senate" → Join → 6-digit PIN → founder path on the map |
| 0:51 | 02 Home | Scroll the real home screen; every hub tile flies into a wall |
| 1:07 | 03 Home food | Dosa card → order placed → order timeline → kitchen dashboard and reviews |
| 1:34 | 04 Saathi | Asks (plumber), does (drafts the tanker notice, waits for "Post it"), watches (2 BHK alert), translates (12 languages) |
| 2:32 | 05 Community | Feed and a live poll · ₹42,401 festival ring and the budget receipt · court booking filling up |
| 3:15 | 06 Marketplace | 3D ring of categories · flat for rent, borrow, lost keys, carpool |
| 3:35 | 07 Safety & money | 112/108/101/100 · blood donors · nearby places · UPI between neighbours · document vault |
| 4:06 | Trust, dark mode, montage, end card | |

## Files

- `story.js` — scene order, durations, transitions, music sections
- `film.js`, `film.css` — the engine and all scenes
- `media/ui` — real UI cards cropped from the app at 3× (`index.json` has sizes and positions)
- `media/screens` — full screens at 3× for the phones
- `music/fit_presenterator.py` — the soundtrack: “Presenterator” by Kevin MacLeod (incompetech.com, CC BY 4.0), fitted and mixed to the film. The credit is on the end card; keep it in any post description too.
- `music/fit_music.py` — the earlier “Inspired” version (`video/aangan_one_courtyard_inspired_720p.mp4`)
- `music/compose.py` — the earlier synthesised score (no longer used)
- `render.mjs`, `build_video.sh` — frame-accurate 1080p30 render
- `video/` — the rendered film (1080p and 720p), plus the “Inspired” version at 720p

## Rebuild

```sh
cd marketing && python3 -m http.server 8766
# in marketing/film2:
python3 music/fit_presenterator.py Presenterator.mp3 music/music_film2.wav   # then normalise to -14 LUFS
./build_video.sh out 3
```

Open `http://127.0.0.1:8766/film2/` to play it live with the score.
