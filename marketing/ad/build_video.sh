#!/usr/bin/env bash
# Render a cut to MP4: ./build_video.sh <short|long> <workdir> [workers]
# Needs: python3 -m http.server 8765 running in this folder, ffmpeg, playwright.
set -euo pipefail
cut=$1; work=$2; workers=${3:-3}
node render.mjs "$cut" "$work/$cut" "$workers" 30
ffmpeg -y -loglevel error -f concat -safe 0 -i "$work/$cut/parts.txt" -c copy "$work/$cut/video.mp4"
ffmpeg -y -loglevel error -i "$work/$cut/video.mp4" -i "music/music_${cut}_master.wav" \
  -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart "$work/aangan_${cut}.mp4"
echo "built $work/aangan_${cut}.mp4"
