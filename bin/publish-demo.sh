#!/bin/sh
# Builds the demo and publishes it to the Space named in
# demo/.spacefast/space.json.
#
# Inside a git checkout, `sf publish` uploads only the files git tracks,
# and every file the demo serves is a build product that git ignores.
# So the site is copied outside the checkout and published from there.
set -e
cd "$( dirname "$0" )/.."

bin/demo.sh
SPACE=$( node -p "require( './demo/.spacefast/space.json' ).space" )
STAGE=$( mktemp -d )
trap 'rm -rf "$STAGE"' EXIT
cp -R dist/demo/. "$STAGE/"
sf publish "$STAGE" --space "$SPACE" "$@"
