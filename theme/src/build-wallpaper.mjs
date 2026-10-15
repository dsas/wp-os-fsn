// Builds wallpapers/: the fsn information landscape, rendered in true
// perspective from a small 3D scene, and the empty night grid.
//
// fsn drew each directory as a pedestal on a ground plane, with its
// files as blocks on top: a block's height is the file's size and its
// colour the file's age. Wires on the ground join a directory to its
// children, which recede into the distance. The scene here is a
// WordPress install, with one directory under the spotlight.
//
// Usage: node theme/src/build-wallpaper.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join( dirname( fileURLToPath( import.meta.url ) ), '..' );
const W = 1920;
const H = 1080;

// --- A seeded random, so every build draws the same landscape. ---
let seed = 1993;
function rand() {
	seed = ( seed * 1103515245 + 12345 ) % 2147483648;
	return seed / 2147483648;
}

// --- Camera ---
const EYE = [ 0, 8.5, -9 ];
const TARGET = [ 0, 0, 40 ];
const FOCAL = 1000;
const sub = ( a, b ) => [ a[ 0 ] - b[ 0 ], a[ 1 ] - b[ 1 ], a[ 2 ] - b[ 2 ] ];
const dot = ( a, b ) => a[ 0 ] * b[ 0 ] + a[ 1 ] * b[ 1 ] + a[ 2 ] * b[ 2 ];
const cross = ( a, b ) => [ a[ 1 ] * b[ 2 ] - a[ 2 ] * b[ 1 ], a[ 2 ] * b[ 0 ] - a[ 0 ] * b[ 2 ], a[ 0 ] * b[ 1 ] - a[ 1 ] * b[ 0 ] ];
const norm = ( a ) => {
	const l = Math.hypot( ...a );
	return a.map( ( v ) => v / l );
};
const FWD = norm( sub( TARGET, EYE ) );
const RIGHT = norm( cross( [ 0, 1, 0 ], FWD ) );
const UP = cross( FWD, RIGHT );
// The horizon sits a little above centre so the landscape fills the
// lower two thirds, where the dock and windows leave it visible.
const CY = H * 0.32;

function project( p ) {
	const d = sub( p, EYE );
	const z = dot( d, FWD );
	return [ W / 2 + ( dot( d, RIGHT ) * FOCAL ) / z, CY - ( dot( d, UP ) * FOCAL ) / z, z ];
}
const pt = ( p ) => {
	const [ x, y ] = project( p );
	return `${ x.toFixed( 1 ) },${ y.toFixed( 1 ) }`;
};
const poly = ( pts, fill, extra = '' ) => `<polygon points="${ pts.map( pt ).join( ' ' ) }" fill="${ fill }"${ extra }/>`;

// --- Colour ---
const hex = ( c ) => [ 1, 3, 5 ].map( ( i ) => parseInt( c.slice( i, i + 2 ), 16 ) );
const toHex = ( rgb ) => '#' + rgb.map( ( v ) => Math.round( Math.max( 0, Math.min( 255, v ) ) ).toString( 16 ).padStart( 2, '0' ) ).join( '' );
const mix = ( a, b, t ) => toHex( hex( a ).map( ( v, i ) => v + ( hex( b )[ i ] - v ) * t ) );
const shade = ( c, k ) => toHex( hex( c ).map( ( v ) => v * k ) );
const HAZE = '#16244c';
// Things fade into the haze with distance, as fsn's depth cueing did.
const fog = ( c, z ) => mix( c, HAZE, Math.min( 0.78, Math.max( 0, ( z - 22 ) / 70 ) ) );

// fsn's age ramp: the newest files hot, the oldest cool.
const AGE = [ '#ff3b30', '#ff9500', '#ffd60a', '#7ed321', '#29d0c8', '#3a7bff', '#c050ff' ];
const PEDESTAL = '#6f8fb8';
const PEDESTAL_LIT = '#a9c4e4';

// --- A box, drawn as the faces the camera can see. ---
function box( x0, y0, z0, x1, y1, z1, color ) {
	const c = [ ( x0 + x1 ) / 2, ( y0 + y1 ) / 2, ( z0 + z1 ) / 2 ];
	const z = project( c )[ 2 ];
	const col = fog( color, z );
	const faces = [];
	// Front (facing the camera, -z).
	faces.push( poly( [ [ x0, y0, z0 ], [ x1, y0, z0 ], [ x1, y1, z0 ], [ x0, y1, z0 ] ], shade( col, 0.72 ) ) );
	// The side facing the camera.
	if ( EYE[ 0 ] < x0 ) {
		faces.push( poly( [ [ x0, y0, z0 ], [ x0, y0, z1 ], [ x0, y1, z1 ], [ x0, y1, z0 ] ], shade( col, 0.52 ) ) );
	} else if ( EYE[ 0 ] > x1 ) {
		faces.push( poly( [ [ x1, y0, z0 ], [ x1, y0, z1 ], [ x1, y1, z1 ], [ x1, y1, z0 ] ], shade( col, 0.52 ) ) );
	}
	// Top.
	if ( EYE[ 1 ] > y1 ) {
		faces.push( poly( [ [ x0, y1, z0 ], [ x1, y1, z0 ], [ x1, y1, z1 ], [ x0, y1, z1 ] ], col ) );
	}
	return faces.join( '' );
}

// --- The directory tree ---
const TREE = {
	name: '/',
	files: 6,
	children: [
		{ name: 'wp-admin', files: 14, children: [ { name: 'css', files: 9 }, { name: 'images', files: 12 }, { name: 'includes', files: 16 }, { name: 'js', files: 11 } ] },
		{
			name: 'wp-content',
			files: 4,
			lit: true,
			children: [ { name: 'plugins', files: 10 }, { name: 'themes', files: 7 }, { name: 'uploads', files: 16 }, { name: 'mu-plugins', files: 3 } ],
		},
		{ name: 'wp-includes', files: 16, children: [ { name: 'blocks', files: 16 }, { name: 'js', files: 9 }, { name: 'rest-api', files: 8 } ] },
		{ name: 'usr', files: 3, children: [ { name: 'people', files: 6 }, { name: 'local', files: 5 }, { name: 'nedry', files: 4 } ] },
	],
};

const ROW_Z = [ 8, 19, 34 ];
const LEAF_GAP = 5.2;

// Lay the tree out: each row recedes, the leaves share the back row
// evenly, and every parent sits where it looks centred in front of its
// children, so nearer rows draw in towards the middle.
function layout() {
	const nodes = [];
	let slot = 0;
	const leaves = ( node ) => ( node.children ? node.children.reduce( ( n, k ) => n + leaves( k ), 0 ) : 1 );
	const total = leaves( TREE );
	const place = ( node, depth ) => {
		let x;
		if ( node.children ) {
			const xs = node.children.map( ( kid ) => place( kid, depth + 1 ) );
			const pull = ( ROW_Z[ depth ] - EYE[ 2 ] ) / ( ROW_Z[ depth + 1 ] - EYE[ 2 ] );
			x = ( ( xs[ 0 ] + xs[ xs.length - 1 ] ) / 2 ) * pull;
		} else {
			x = ( slot++ - ( total - 1 ) / 2 ) * LEAF_GAP;
		}
		const cols = Math.ceil( Math.sqrt( node.files ) );
		const rows = Math.ceil( node.files / cols );
		node.depth = depth;
		node.x = x;
		node.z = ROW_Z[ depth ];
		node.cols = cols;
		node.rows = rows;
		node.w = cols * 0.9 + 0.8;
		node.d = rows * 0.9 + 0.8;
		node.h = 0.35 + rand() * 0.35;
		nodes.push( node );
		return x;
	};
	place( TREE, 0 );
	// Centre the root in front of the camera.
	const shift = TREE.x;
	nodes.forEach( ( n ) => ( n.x -= shift ) );
	return nodes;
}

function wire( parent, child ) {
	const y = 0.02;
	const zMid = ( parent.z + parent.d / 2 + child.z - child.d / 2 ) / 2;
	const path = [
		[ parent.x, y, parent.z + parent.d / 2 ],
		[ parent.x, y, zMid ],
		[ child.x, y, zMid ],
		[ child.x, y, child.z - child.d / 2 ],
	];
	const z = project( [ child.x, 0, zMid ] )[ 2 ];
	return `<polyline points="${ path.map( pt ).join( ' ' ) }" fill="none" stroke="${ fog( '#c8d8f0', z ) }" stroke-width="${ Math.max( 0.8, 60 / z ).toFixed( 2 ) }" stroke-linejoin="round"/>`;
}

function pedestal( node ) {
	const { x, z, w, d, h } = node;
	const x0 = x - w / 2;
	const z0 = z - d / 2;
	let out = box( x0, 0, z0, x0 + w, h, z0 + d, node.lit ? PEDESTAL_LIT : PEDESTAL );
	// Files, back row first so nearer blocks overlap farther ones.
	const files = [];
	for ( let i = 0; i < node.files; i++ ) {
		const c = i % node.cols;
		const r = Math.floor( i / node.cols );
		files.push( { c, r } );
	}
	files.sort( ( a, b ) => b.r - a.r || Math.abs( b.c - ( node.cols - 1 ) / 2 ) - Math.abs( a.c - ( node.cols - 1 ) / 2 ) );
	for ( const { c, r } of files ) {
		const fx = x0 + 0.55 + c * 0.9;
		const fz = z0 + 0.55 + r * 0.9;
		const size = Math.pow( rand(), 2.2 ) * 3.2 + 0.18;
		const age = AGE[ Math.floor( rand() * AGE.length ) ];
		out += box( fx, h, fz, fx + 0.6, h + size, fz + 0.6, age );
	}
	// The name, on the ground in front, as fsn labelled its pedestals.
	const [ lx, ly, lz ] = project( [ x, 0, z0 - 0.7 ] );
	const size = Math.max( 9, ( 0.95 * FOCAL ) / lz );
	out += `<text x="${ lx.toFixed( 1 ) }" y="${ ( ly + size * 0.4 ).toFixed( 1 ) }" font-size="${ size.toFixed( 1 ) }" fill="${ fog( '#ffffff', lz ) }" stroke="${ HAZE }" stroke-width="${ ( size / 5 ).toFixed( 1 ) }" paint-order="stroke" text-anchor="middle">${ node.name }</text>`;
	return out;
}

function spotlight( node ) {
	// A soft cone from above the frame down onto the lit pedestal, and
	// the pool of light it leaves on the ground.
	const top = project( [ node.x + 3, 60, node.z + 4 ] );
	const l = project( [ node.x - node.w / 2 - 1.2, 0, node.z ] );
	const r = project( [ node.x + node.w / 2 + 1.2, 0, node.z ] );
	const c = project( [ node.x, 0, node.z ] );
	const rx = ( r[ 0 ] - l[ 0 ] ) / 2;
	return (
		`<polygon points="${ top[ 0 ].toFixed( 1 ) },${ Math.max( -20, top[ 1 ] ).toFixed( 1 ) } ${ l[ 0 ].toFixed( 1 ) },${ c[ 1 ].toFixed( 1 ) } ${ r[ 0 ].toFixed( 1 ) },${ c[ 1 ].toFixed( 1 ) }" fill="url(#beam)"/>` +
		`<ellipse cx="${ c[ 0 ].toFixed( 1 ) }" cy="${ c[ 1 ].toFixed( 1 ) }" rx="${ rx.toFixed( 1 ) }" ry="${ ( rx * 0.32 ).toFixed( 1 ) }" fill="url(#pool)"/>`
	);
}

function ground( { lines = true } = {} ) {
	const horizon = project( [ 0, 0, 4000 ] )[ 1 ];
	let out =
		`<rect width="${ W }" height="${ H }" fill="url(#sky)"/>` +
		`<rect y="${ horizon.toFixed( 1 ) }" width="${ W }" height="${ ( H - horizon ).toFixed( 1 ) }" fill="url(#plain)"/>`;
	if ( lines ) {
		// A faint survey grid on the plain, fading with distance.
		const grid = [];
		for ( let gx = -120; gx <= 120; gx += 6 ) {
			grid.push( `<polyline points="${ pt( [ gx, 0, -6 ] ) } ${ pt( [ gx, 0, 160 ] ) }"/>` );
		}
		for ( let gz = 0; gz <= 160; gz += gz < 40 ? 6 : 12 ) {
			grid.push( `<polyline points="${ pt( [ -200, 0, gz ] ) } ${ pt( [ 200, 0, gz ] ) }" stroke-opacity="${ Math.max( 0.08, 1 - gz / 120 ).toFixed( 2 ) }"/>` );
		}
		out += `<g stroke="#4c6aa8" stroke-opacity="0.45" stroke-width="1" fill="none">${ grid.join( '' ) }</g>`;
	}
	out += `<rect y="${ ( horizon - 40 ).toFixed( 1 ) }" width="${ W }" height="80" fill="url(#glow)"/>`;
	return out;
}

const DEFS = `<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000000"/><stop offset="0.24" stop-color="#050a1e"/><stop offset="0.34" stop-color="${ HAZE }"/></linearGradient>
<linearGradient id="plain" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${ HAZE }"/><stop offset="0.25" stop-color="#1b2d5c"/><stop offset="1" stop-color="#2a4078"/></linearGradient>
<linearGradient id="glow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4f78c8" stop-opacity="0"/><stop offset="0.5" stop-color="#4f78c8" stop-opacity="0.35"/><stop offset="1" stop-color="#4f78c8" stop-opacity="0"/></linearGradient>
<linearGradient id="beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0"/><stop offset="1" stop-color="#e8f0ff" stop-opacity="0.22"/></linearGradient>
<radialGradient id="pool"><stop offset="0" stop-color="#ffffff" stop-opacity="0.35"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
</defs>`;

function svg( body ) {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${ W }" height="${ H }" viewBox="0 0 ${ W } ${ H }" font-family="Helvetica, Arial, sans-serif">${ DEFS }${ body }</svg>\n`;
}

function write( name, content ) {
	const file = join( ROOT, 'wallpapers', `${ name }.svg` );
	mkdirSync( dirname( file ), { recursive: true } );
	writeFileSync( file, content );
	console.log( 'wrote', file, `${ ( content.length / 1024 ).toFixed( 0 ) } KB` );
}

// The landscape.
const nodes = layout();
let scene = ground();
const walk = ( node ) => ( node.children || [] ).forEach( ( kid ) => {
	scene += wire( node, kid );
	walk( kid );
} );
walk( TREE );
const lit = nodes.find( ( n ) => n.lit );
// Painter's order: farthest pedestals first.
for ( const node of [ ...nodes ].sort( ( a, b ) => b.z - a.z || Math.abs( b.x ) - Math.abs( a.x ) ) ) {
	if ( node === lit ) {
		scene += spotlight( node );
	}
	scene += pedestal( node );
}
write( 'fsn-landscape', svg( scene ) );

// The empty plain.
write( 'fsn-night', svg( ground() ) );

// The theme card in Preferences > Themes: the landscape, a dock of
// keys down the left, and one 4Dwm window with the focused rose bar.
const card = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200" role="img" aria-label="FSN">
<svg width="320" height="200" viewBox="192 40 1536 960" font-family="Helvetica, Arial, sans-serif">${ DEFS }${ scene }</svg>
<rect x="0" y="0" width="22" height="200" fill="#b4b4c4"/>
${ [ '#2f6be8', '#f08a00', '#5fb81c', '#e8c000', '#1fb5ad', '#a845e0', '#e8352b' ].map( ( c, i ) => `<rect x="3" y="${ 6 + i * 20 }" width="16" height="16" fill="#b4b4c4" stroke="#f2f2f8" stroke-width="1"/><rect x="7" y="${ 9 + i * 20 }" width="8" height="10" fill="${ c }"/>` ).join( '' ) }
<rect x="150" y="96" width="150" height="92" fill="#b4b4c4" stroke="#3e3e50"/>
<rect x="152" y="98" width="146" height="12" fill="#a35a6e"/>
<text x="225" y="107.5" font-family="Helvetica, Arial, sans-serif" font-size="8" fill="#ffffff" text-anchor="middle">fsn</text>
<rect x="155" y="114" width="140" height="70" fill="#f2f2f8" stroke="#7a7a90"/>
<path d="M162 124h80M162 134h110M162 144h96M162 154h60" stroke="#7a7a90" stroke-width="3"/>
</svg>
`;
writeFileSync( join( ROOT, 'preview.svg' ), card );
console.log( 'wrote preview.svg' );
