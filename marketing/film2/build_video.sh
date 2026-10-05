#!/usr/bin/env bash
# Render film 2 to MP4: ./build_video.sh <workdir> [workers] [long|short] [audio.wav]
# Needs: python3 -m http.server 8766 running in marketing/, ffmpeg, playwright.
set -euo pipefail
work=$1; workers=${2:-3}; cut=${3:-long}; audio=${4:-music/music_film2_master.wav}
node render.mjs "$cut" "$work/$cut" "$workers" 30
ffmpeg -y -loglevel error -f concat -safe 0 -i "$work/$cut/parts.txt" -c copy "$work/$cut/video.mp4"
ffmpeg -y -loglevel error -i "$work/$cut/video.mp4" -i "$audio" \
  -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart "$work/aangan_one_courtyard_$cut.mp4"
echo "built $work/aangan_one_courtyard_$cut.mp4"
