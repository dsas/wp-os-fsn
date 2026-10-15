#!/bin/sh
# Assembles the Playground demo in demo/ from a fresh build, ready to
# publish with `sf publish demo`. Needs rsvg-convert (brew install
# librsvg) for the preview image, and curl.
set -e
cd "$( dirname "$0" )/.."

OPENSTATION_VERSION="${OPENSTATION_VERSION:-1.1.14}"

bin/build.sh
cp dist/fsn-theme.zip demo/theme.zip
cp dist/fsn-navigator.zip demo/fsn-navigator.zip
cp theme/wallpapers/fsn-landscape.svg demo/wallpaper.svg
cp theme/icons/desk-folder.svg demo/favicon.svg
rsvg-convert -w 1280 theme/preview.svg -o demo/preview.png

# OpenStation itself, from WordPress.org, fetched once per version.
if [ "$( cat demo/.openstation-version 2> /dev/null )" != "$OPENSTATION_VERSION" ]; then
	curl -sfLo demo/openstation.zip "https://downloads.wordpress.org/plugin/desktop-mode.$OPENSTATION_VERSION.zip"
	echo "$OPENSTATION_VERSION" > demo/.openstation-version
fi

echo "demo/ is ready: sf publish demo"
