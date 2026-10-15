// Builds the theme's chrome/ artwork: the window frame, the title-bar
// and dock-key bevels and the window-control glyphs, in the Motif
// style IRIX's 4Dwm drew them.
//
// Each piece is a small pixel grid painted from an ordered list of
// rings (outermost first), then written as an SVG of merged rects.
// theme.json 9-slices these through `border-image` or stretches them
// as button faces, so every edge is whole pixels at 1x.
//
// Usage: node theme/src/build-chrome.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join( dirname( fileURLToPath( import.meta.url ) ), '..' );

/**
 * A grid of `w` x `h` pixels filled with `fill` (or transparent), then
 * painted with bevel rings. Each ring is `[ topLeft, bottomRight ]`:
 * ring 0 is the outermost pixel, ring 1 the next one in. The
 * bottom-right colour wins at the two shared corners, as the box
 * shadows in the original UIs did.
 */
function bevel( w, h, rings, fill = null ) {
	const px = Array.from( { length: h }, () => Array( w ).fill( fill ) );
	rings.forEach( ( [ tl, br ], i ) => {
		for ( let y = i; y < h - i; y++ ) {
			for ( let x = i; x < w - i; x++ ) {
				const onTop = y === i;
				const onLeft = x === i;
				const onBottom = y === h - 1 - i;
				const onRight = x === w - 1 - i;
				if ( ! ( onTop || onLeft || onBottom || onRight ) ) {
					continue;
				}
				px[ y ][ x ] = onBottom || onRight ? br : tl;
			}
		}
	} );
	return px;
}

function toSvg( px ) {
	const h = px.length;
	const w = px[ 0 ].length;
	const rects = [];
	for ( let y = 0; y < h; y++ ) {
		let x = 0;
		while ( x < w ) {
			const c = px[ y ][ x ];
			let end = x + 1;
			while ( end < w && px[ y ][ end ] === c ) {
				end++;
			}
			if ( c ) {
				rects.push( { x, y, w: end - x, h: 1, c } );
			}
			x = end;
		}
	}
	// Merge vertically identical runs.
	const merged = [];
	for ( const r of rects ) {
		const above = merged.find( ( m ) => m.x === r.x && m.w === r.w && m.c === r.c && m.y + m.h === r.y );
		if ( above ) {
			above.h++;
		} else {
			merged.push( { ...r } );
		}
	}
	const body = merged
		.map( ( r ) => `<rect x="${ r.x }" y="${ r.y }" width="${ r.w }" height="${ r.h }" fill="${ r.c }"/>` )
		.join( '' );
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${ w }" height="${ h }" viewBox="0 0 ${ w } ${ h }" shape-rendering="crispEdges">${ body }</svg>\n`;
}

function write( name, px ) {
	const file = join( ROOT, 'chrome', `${ name }.svg` );
	mkdirSync( dirname( file ), { recursive: true } );
	writeFileSync( file, toSvg( px ) );
	console.log( 'wrote', file );
}

const IRIX = {
	dark: '#3e3e50',
	shadow: '#7a7a90',
	face: '#b4b4c4',
	light: '#d6d6e2',
	white: '#f2f2f8',
};

// Window frame: a 2px Motif bevel + 1px face, sliced 3 / width 3px.
write( 'frame', bevel( 7, 7, [ [ IRIX.light, IRIX.dark ], [ IRIX.white, IRIX.shadow ], [ IRIX.face, IRIX.face ] ] ) );
// Raised title-bar control: the bevel only. The face is the button's
// own background colour, so hover and the close button's red show
// through it.
write( 'button', bevel( 18, 16, [ [ IRIX.white, IRIX.dark ], [ IRIX.light, IRIX.shadow ] ] ) );
// The same button pressed in.
write( 'button-pressed', bevel( 18, 16, [ [ IRIX.dark, IRIX.white ], [ IRIX.shadow, IRIX.light ] ] ) );
// Sunken well (fields, list boxes): 9-slice, slice 2.
write( 'sunken', bevel( 5, 5, [ [ IRIX.shadow, IRIX.white ], [ IRIX.dark, IRIX.light ] ] ) );

/**
 * A glyph from ASCII art: `#` is ink, anything else is transparent.
 * Control glyphs are painted as masks, so only the shape matters.
 */
function glyph( rows, ink = '#000000' ) {
	return rows.map( ( row ) => [ ...row ].map( ( ch ) => ( ch === '#' ? ink : null ) ) );
}

function writeGlyph( name, rows ) {
	write( `glyph-${ name }`, glyph( rows ) );
}

// Glyphs fill a 16x16 box on an 18x16 button. 4Dwm's own controls
// were a small square to iconify and a large one to maximize.
writeGlyph( 'minimize', [
	'................',
	'................',
	'................',
	'................',
	'................',
	'................',
	'......####......',
	'......####......',
	'......####......',
	'......####......',
	'................',
	'................',
	'................',
	'................',
	'................',
	'................',
] );
writeGlyph( 'maximize', [
	'................',
	'................',
	'................',
	'...##########...',
	'...##########...',
	'...##......##...',
	'...##......##...',
	'...##......##...',
	'...##......##...',
	'...##......##...',
	'...##......##...',
	'...##########...',
	'...##########...',
	'................',
	'................',
	'................',
] );
writeGlyph( 'close', [
	'................',
	'................',
	'................',
	'....##....##....',
	'....###..###....',
	'.....######.....',
	'......####......',
	'......####......',
	'.....######.....',
	'....###..###....',
	'....##....##....',
	'................',
	'................',
	'................',
	'................',
	'................',
] );
writeGlyph( 'fullscreen', [
	'................',
	'................',
	'...####..####...',
	'...##......##...',
	'...#.#....#.#...',
	'...#..#..#..#...',
	'................',
	'................',
	'................',
	'...#..#..#..#...',
	'...#.#....#.#...',
	'...##......##...',
	'...####..####...',
	'................',
	'................',
	'................',
] );
writeGlyph( 'fullscreen-exit', [
	'................',
	'................',
	'...#........#...',
	'....#......#....',
	'.....##..##.....',
	'.....#....#.....',
	'................',
	'................',
	'................',
	'.....#....#.....',
	'.....##..##.....',
	'....#......#....',
	'...#........#...',
	'................',
	'................',
	'................',
] );
writeGlyph( 'menu', [
	'................',
	'................',
	'................',
	'................',
	'................',
	'................',
	'...##########...',
	'...##########...',
	'...##########...',
	'................',
	'................',
	'................',
	'................',
	'................',
	'................',
	'................',
] );
writeGlyph( 'reload', [
	'................',
	'................',
	'.....#####......',
	'....#.....#.#...',
	'...#.......##...',
	'...#......###...',
	'...#............',
	'...#.......#....',
	'...#.......#....',
	'....#.....#.....',
	'.....#####......',
	'................',
	'................',
	'................',
	'................',
	'................',
] );
writeGlyph( 'detach', [
	'................',
	'................',
	'........######..',
	'..........####..',
	'.........#####..',
	'...####.###.##..',
	'...#...###...#..',
	'...#..###....#..',
	'...#.........#..',
	'...#.........#..',
	'...#.........#..',
	'...###########..',
	'................',
	'................',
	'................',
	'................',
] );

// Dock keys: the bevel at the dock tile's own size, so a 1px line
// stays 1px instead of being stretched.
write( 'key', bevel( 44, 44, [ [ IRIX.white, IRIX.dark ], [ IRIX.light, IRIX.shadow ] ], IRIX.face ) );
write( 'key-pressed', bevel( 44, 44, [ [ IRIX.dark, IRIX.white ], [ IRIX.shadow, IRIX.light ] ], '#a2a2b4' ) );
