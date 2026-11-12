#!/bin/sh
# Makes the 400 and 800 px wide WebP variants of each phone screenshot (assets/img/<name>.webp, 1272×2582) used in
# srcset. Run after adding or replacing a screenshot. Needs cwebp and sips (macOS).
set -eu
cd "$(dirname "$0")/../assets/img"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
for f in home livedata dashboard faults procedure controlunits controlunitfunctions coding mileage1 mileage2; do
  sips -s format png "$f.webp" --out "$tmp/$f.png" >/dev/null
  for w in 400 800; do
    cwebp -quiet -q 78 -m 6 -resize "$w" 0 "$tmp/$f.png" -o "$f-$w.webp"
  done
done
