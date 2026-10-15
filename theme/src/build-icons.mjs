// Builds icons/: every icon is an fsn object. An app is a file block
// standing on a pedestal, coloured from fsn's age ramp, with a white
// glyph on its face; a folder is a directory pedestal with several
// blocks of different sizes on top.
//
// The drawing is an oblique projection in a 32x32 box: front faces are
// flat rectangles, depth runs up and to the right.
//
// Usage: node theme/src/build-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join( dirname( fileURLToPath( import.meta.url ) ), '..' );

const hex = ( c ) => [ 1, 3, 5 ].map( ( i ) => parseInt( c.slice( i, i + 2 ), 16 ) );
const shade = ( c, k ) => '#' + hex( c ).map( ( v ) => Math.round( Math.min( 255, v * k ) ).toString( 16 ).padStart( 2, '0' ) ).join( '' );

const RED = '#e8352b';
const ORANGE = '#f08a00';
const YELLOW = '#e8c000';
const GREEN = '#5fb81c';
const CYAN = '#1fb5ad';
const BLUE = '#2f6be8';
const VIOLET = '#a845e0';
const PEDESTAL = '#7f9cc4';
const OUTLINE = '#1a2340';

// Depth runs along this vector, per unit of depth.
const DX = 0.62;
const DY = -0.55;

const n = ( v ) => +v.toFixed( 2 );
const polygon = ( pts, fill ) => `<polygon points="${ pts.map( ( [ x, y ] ) => `${ n( x ) },${ n( y ) }` ).join( ' ' ) }" fill="${ fill }"/>`;

/** A box with its front-bottom-left corner at (x, y), w wide, h tall, d deep. */
function box( x, y, w, h, d, color ) {
	const ox = d * DX;
	const oy = d * DY;
	const front = [ [ x, y ], [ x + w, y ], [ x + w, y - h ], [ x, y - h ] ];
	const top = [ [ x, y - h ], [ x + w, y - h ], [ x + w + ox, y - h + oy ], [ x + ox, y - h + oy ] ];
	const side = [ [ x + w, y ], [ x + w + ox, y + oy ], [ x + w + ox, y - h + oy ], [ x + w, y - h ] ];
	// One outline path around the silhouette keeps the icon legible on
	// both the light dock and the dark desk.
	const hull = [ [ x, y ], [ x + w, y ], [ x + w + ox, y + oy ], [ x + w + ox, y - h + oy ], [ x + ox, y - h + oy ], [ x, y - h ] ];
	return (
		`<polygon points="${ hull.map( ( [ a, b ] ) => `${ n( a ) },${ n( b ) }` ).join( ' ' ) }" fill="none" stroke="${ OUTLINE }" stroke-width="1.2" stroke-linejoin="round"/>` +
		polygon( front, shade( color, 0.82 ) ) +
		polygon( side, shade( color, 0.58 ) ) +
		polygon( top, shade( color, 1.18 ) )
	);
}

function pedestal() {
	return box( 2, 29, 21, 3.2, 10, PEDESTAL );
}

// The block an app stands as, and the front face its glyph is drawn on.
const FACE = { x: 7, y: 25.8, w: 13, h: 16, d: 5 };
function block( color ) {
	return box( FACE.x, FACE.y, FACE.w, FACE.h, FACE.d, color );
}

// Glyphs are drawn in a 10x10 box and placed on the block's face.
function onFace( glyph ) {
	const s = 1.0;
	const x = FACE.x + ( FACE.w - 10 * s ) / 2;
	const y = FACE.y - FACE.h + ( FACE.h - 10 * s ) / 2;
	return `<g transform="translate(${ n( x ) } ${ n( y ) })" fill="#ffffff" stroke="#ffffff" stroke-linecap="round" stroke-linejoin="round">${ glyph }</g>`;
}

const GLYPHS = {
	dashboard: '<path d="M1 7.5a4 4 0 0 1 8 0" fill="none" stroke-width="1.6"/><path d="M5 7.5 7.2 4.2" stroke-width="1.6"/><circle cx="5" cy="7.5" r="1.1" stroke="none"/>',
	posts: '<path d="M1.5 1.5h7M1.5 4h7M1.5 6.5h7M1.5 9h4.5" fill="none" stroke-width="1.4"/>',
	media: '<rect x="0.8" y="1.2" width="8.4" height="7.6" fill="none" stroke-width="1.3"/><path d="M1.5 8 4 5l2 2 1.2-1.2L8.5 8z" stroke="none"/><circle cx="6.8" cy="3.4" r="0.9" stroke="none"/>',
	pages: '<path d="M2 0.8h4l2.4 2.4v6H2z" fill="none" stroke-width="1.3"/><path d="M6 0.8v2.4h2.4" fill="none" stroke-width="1.1"/>',
	comments: '<path d="M1 1.5h8v5H4.5L2.2 8.6V6.5H1z" fill="none" stroke-width="1.3"/>',
	appearance: '<path d="M5 0.8C6.8 3.5 8 5 8 6.4a3 3 0 0 1-6 0C2 5 3.2 3.5 5 0.8z" stroke="none"/>',
	plugins: '<path d="M3.2 0.8v2.6M6.8 0.8v2.6" stroke-width="1.4"/><path d="M1.6 3.4h6.8v1.6a3.4 3.4 0 0 1-6.8 0z" stroke="none"/><path d="M5 8.2v1.4" stroke-width="1.4"/>',
	users: '<circle cx="5" cy="3" r="2.1" stroke="none"/><path d="M1 9.4a4 3.4 0 0 1 8 0z" stroke="none"/>',
	tools: '<path d="M7.6 1a2.4 2.4 0 0 0-2.4 3.1L1.2 8.1l0.8 0.8 4-4A2.4 2.4 0 0 0 9 2.4L7.6 3.6 6.5 2.6z" stroke-width="0.8"/>',
	settings: '<circle cx="5" cy="5" r="2.6" fill="none" stroke-width="1.6"/>' + [ 0, 45, 90, 135, 180, 225, 270, 315 ].map( ( a ) => `<rect x="4.3" y="0.3" width="1.4" height="2" stroke="none" transform="rotate(${ a } 5 5)"/>` ).join( '' ),
	assistant: '<path d="M5 0.5 6 4 9.5 5 6 6 5 9.5 4 6 0.5 5 4 4z" stroke="none"/>',
	mio: '<circle cx="5" cy="5" r="4" fill="none" stroke-width="1.3"/><circle cx="3.6" cy="4" r="0.7" stroke="none"/><circle cx="6.4" cy="4" r="0.7" stroke="none"/><path d="M3.2 6.2a2.2 2.2 0 0 0 3.6 0" fill="none" stroke-width="1"/>',
	workspaces: '<rect x="0.8" y="0.8" width="3.6" height="3.6" stroke="none"/><rect x="5.6" y="0.8" width="3.6" height="3.6" stroke="none"/><rect x="0.8" y="5.6" width="3.6" height="3.6" stroke="none"/><rect x="5.6" y="5.6" width="3.6" height="3.6" fill="none" stroke-width="1"/>',
	system: '<rect x="0.8" y="1" width="8.4" height="5.8" fill="none" stroke-width="1.3"/><path d="M3 9.2h4M5 6.8v2.4" stroke-width="1.3"/>',
	// A wireframe cube: the workstation's own badge.
	start: '<path d="M5 0.8 8.8 3v4.2L5 9.4 1.2 7.2V3zM5 0.8v4.2M1.2 3 5 5l3.8-2M5 5v4.4" fill="none" stroke-width="1"/>',
	exit: '<path d="M4 1H1.2v8H4" fill="none" stroke-width="1.3"/><path d="M3.8 5h5M6.6 2.8 8.8 5 6.6 7.2" fill="none" stroke-width="1.3"/>',
	trash: '<path d="M1.2 2.4h7.6M3.6 2.4V1h2.8v1.4" fill="none" stroke-width="1.2"/><path d="M2.2 3.4h5.6l-0.6 6H2.8z" stroke="none"/>',
	explorer: '<circle cx="4.2" cy="4.2" r="3" fill="none" stroke-width="1.4"/><path d="M6.4 6.4 9 9" stroke-width="1.8"/>',
	corkboard: '<path d="M1 3h3.2L5 1.6 5.8 3H9v6H1z" stroke="none"/><circle cx="5" cy="5.6" r="1.4" fill="#000" fill-opacity="0.35" stroke="none"/>',
	document: '<path d="M2 3h6M2 5h6M2 7h4" fill="none" stroke-width="1.2"/>',
	image: '<path d="M1 8.6 4 4.6l2.2 2.4 1.2-1.2L9.4 8.6z" stroke="none"/><circle cx="7" cy="2.6" r="1.1" stroke="none"/>',
	file: '<path d="M5 1.2v5.4M2.8 4.6 5 6.8l2.2-2.2M1.6 8.8h6.8" fill="none" stroke-width="1.3"/>',
	user: '<circle cx="5" cy="3" r="2.1" stroke="none"/><path d="M1 9.4a4 3.4 0 0 1 8 0z" stroke="none"/>',
	tag: '<path d="M1 1h4.2L9 4.8 4.8 9 1 5.2z" stroke="none"/><circle cx="3" cy="3" r="0.8" fill="#000" fill-opacity="0.45" stroke="none"/>',
	comment: '<path d="M1 1.5h8v5H4.5L2.2 8.6V6.5H1z" stroke="none"/>',
	bookmark: '<path d="M2.4 0.8h5.2v8.6L5 7.2 2.4 9.4z" stroke="none"/>',
	link: '<path d="M4.2 5.8 5.8 4.2" stroke-width="1.3"/><path d="M4.4 2.8 5.6 1.6a2 2 0 0 1 2.8 2.8L7.2 5.6M5.6 7.2 4.4 8.4a2 2 0 0 1-2.8-2.8l1.2-1.2" fill="none" stroke-width="1.3"/>',
	embed: '<path d="M3.2 2.4 0.8 5l2.4 2.6M6.8 2.4 9.2 5 6.8 7.6" fill="none" stroke-width="1.4"/>',
	shortcut: '<path d="M2 8 7.6 2.4M3.6 2.4h4v4" fill="none" stroke-width="1.5"/>',
	app: '<rect x="1" y="1" width="8" height="8" fill="none" stroke-width="1.3"/><path d="M1 3.4h8" stroke-width="1.3"/>',
};

function svg( body ) {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">${ body }</svg>\n`;
}

function write( name, body ) {
	const file = join( ROOT, 'icons', `${ name }.svg` );
	mkdirSync( dirname( file ), { recursive: true } );
	writeFileSync( file, svg( body ) );
}

function app( name, color, glyph = name ) {
	write( name, pedestal() + block( color ) + onFace( GLYPHS[ glyph ] ) );
}

// A directory: a pedestal with its files on top, back row first.
function directory( name, blocks ) {
	let body = pedestal();
	for ( const [ x, depth, h, color ] of blocks ) {
		body += box( x + depth * DX, 25.8 + depth * DY, 4.2, h, 2.6, color );
	}
	write( name, body );
}

// --- Dock ---
app( 'dock-dashboard', BLUE, 'dashboard' );
app( 'dock-posts', ORANGE, 'posts' );
app( 'dock-media', GREEN, 'media' );
app( 'dock-pages', YELLOW, 'pages' );
app( 'dock-comments', CYAN, 'comments' );
app( 'dock-appearance', VIOLET, 'appearance' );
app( 'dock-plugins', RED, 'plugins' );
app( 'dock-users', ORANGE, 'users' );
app( 'dock-tools', CYAN, 'tools' );
app( 'dock-settings', BLUE, 'settings' );
app( 'dock-assistant', VIOLET, 'assistant' );
app( 'dock-mio', YELLOW, 'mio' );
app( 'dock-workspaces', GREEN, 'workspaces' );
app( 'dock-system', BLUE, 'system' );
app( 'dock-start', VIOLET, 'start' );
app( 'dock-exit', RED, 'exit' );
app( 'dock-trash', '#8a8aa0', 'trash' );

// --- Desk ---
directory( 'desk-folder', [
	[ 4, 4, 9, RED ],
	[ 10, 4, 14, BLUE ],
	[ 16, 4, 6, YELLOW ],
	[ 4, 0, 5, GREEN ],
	[ 10, 0, 11, VIOLET ],
	[ 16, 0, 8, CYAN ],
] );
app( 'desk-explorer', CYAN, 'explorer' );
app( 'desk-corkboard', ORANGE, 'corkboard' );
app( 'desk-document', BLUE, 'document' );
app( 'desk-image', GREEN, 'image' );
app( 'desk-file', '#8a8aa0', 'file' );
app( 'desk-user', ORANGE, 'user' );
app( 'desk-tag', YELLOW, 'tag' );
app( 'desk-comment', CYAN, 'comment' );
app( 'desk-bookmark', RED, 'bookmark' );
app( 'desk-link', VIOLET, 'link' );
app( 'desk-embed', VIOLET, 'embed' );
app( 'desk-shortcut', BLUE, 'shortcut' );
app( 'desk-app', '#8a8aa0', 'app' );
console.log( 'wrote icons/' );
