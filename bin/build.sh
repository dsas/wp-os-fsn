#!/bin/sh
# Builds the theme's assets and both installable ZIPs into dist/:
#
#   dist/fsn-theme.zip      the desktop theme, for OpenStation Preferences > Themes
#   dist/fsn-navigator.zip  the plugin, for Plugins > Add New > Upload Plugin
#
# Needs Node 20 or newer and zip. GitHub Actions runs this on every push.
set -e
cd "$( dirname "$0" )/.."

node theme/src/build-chrome.mjs > /dev/null
node theme/src/build-icons.mjs > /dev/null
node theme/src/build-wallpaper.mjs > /dev/null
node theme/src/build-theme.mjs

rm -rf dist
mkdir dist
( cd theme && zip -qr ../dist/fsn-theme.zip theme.json preview.svg chrome icons wallpapers -x '*.DS_Store' )
zip -qj dist/fsn-theme.zip LICENSE.txt
( cd plugin && zip -qr ../dist/fsn-navigator.zip fsn-navigator -x '*.DS_Store' )

ls -l dist
