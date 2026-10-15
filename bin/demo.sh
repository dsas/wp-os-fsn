#!/bin/sh
# Assembles the Playground demo site into dist/demo/ from a fresh build:
# demo/'s pages plus the ZIPs, the video and the images they load.
# Preview it with `python3 -m http.server --directory dist/demo`, and
# publish it with bin/publish-demo.sh. Needs rsvg-convert (brew install
# librsvg) for the preview image, and curl.
set -e
cd "$( dirname "$0" )/.."

OPENSTATION_VERSION="${OPENSTATION_VERSION:-1.1.14}"
OUT=dist/demo

bin/build.sh
rm -rf "$OUT"
mkdir -p "$OUT"
cp demo/index.html demo/setup.php "$OUT/"
cp dist/fsn-theme.zip "$OUT/theme.zip"
cp dist/fsn-navigator.zip "$OUT/fsn-navigator.zip"
cp theme/wallpapers/fsn-landscape.svg "$OUT/wallpaper.svg"
cp theme/icons/desk-folder.svg "$OUT/favicon.svg"
rsvg-convert -w 1280 theme/preview.svg -o "$OUT/preview.png"
cp media/fsn-demo.jpg "$OUT/demo.jpg"
# The recording isn't in git; phones show its poster frame without it.
if [ -f media/fsn-demo.mp4 ]; then
	cp media/fsn-demo.mp4 "$OUT/demo.mp4"
else
	echo "warning: no media/fsn-demo.mp4, so the phone screen shows a still" >&2
fi

# OpenStation itself, from WordPress.org, cached per version.
CACHE=".cache/openstation-$OPENSTATION_VERSION.zip"
if [ ! -f "$CACHE" ]; then
	mkdir -p .cache
	curl -sfLo "$CACHE" "https://downloads.wordpress.org/plugin/desktop-mode.$OPENSTATION_VERSION.zip"
fi
cp "$CACHE" "$OUT/openstation.zip"

echo "assembled $OUT"
