/**
 * FSN Navigator: the site's content as an fsn landscape.
 *
 * Directories are pedestals laid out as a tree that recedes from the
 * viewer, joined by wires on the ground. Files are blocks on top of
 * them: height is size, colour is age. Click a pedestal to fly to it,
 * click a block to put it under the spotlight, double-click it to open
 * it in a window. Drag to look around, scroll to move in and out.
 */
( function () {
	const ID = 'fsn-navigator';

	// Layout, in world units. Rows recede along -z.
	const PITCH = 1.0;
	const BLOCK = 0.62;
	const ROW = 15;
	const GAP = 3;

	const SKY = 0x02040c;
	const HAZE = 0x16244c;
	const GROUND = 0x223566;
	const GRID = 0x4c6aa8;
	const WIRE = 0xc8d8f0;
	const PEDESTAL = 0x6f8fb8;
	const PEDESTAL_HERE = 0xa9c4e4;

	// fsn's age ramp, newest first, with the age each colour runs to.
	const AGES = [
		{ days: 1, color: 0xff3b30, label: 'today' },
		{ days: 7, color: 0xff9500, label: 'this week' },
		{ days: 31, color: 0xffd60a, label: 'this month' },
		{ days: 92, color: 0x7ed321, label: 'this quarter' },
		{ days: 366, color: 0x29d0c8, label: 'this year' },
		{ days: 1096, color: 0x3a7bff, label: 'within three years' },
		{ days: Infinity, color: 0xc050ff, label: 'older' },
	];

	window.openStationNativeWindows = window.openStationNativeWindows || {};
	window.openStationNativeWindows[ ID ] = function ( body ) {
		const cfg = ( window.wp && wp.os && wp.os.getWindowConfig && wp.os.getWindowConfig( ID ) ) || {};
		const ui = {
			view: body.querySelector( '.fsn__view' ),
			canvas: document.createElement( 'canvas' ),
			loading: body.querySelector( '.fsn__loading' ),
			directory: body.querySelector( '.fsn__directory' ),
			selection: body.querySelector( '.fsn__selection' ),
			panel: body.querySelector( '.fsn__panel' ),
			buttons: {},
		};
		body.querySelectorAll( '[data-fsn]' ).forEach( ( b ) => ( ui.buttons[ b.dataset.fsn ] = b ) );
		ui.canvas.className = 'fsn__canvas';
		ui.view.prepend( ui.canvas );

		let stop = null;
		let disposed = false;
		start( cfg, ui )
			.then( ( teardown ) => {
				if ( disposed ) {
					teardown();
				} else {
					stop = teardown;
				}
			} )
			.catch( ( error ) => {
				ui.loading.textContent = 'fsn could not read the landscape: ' + ( error && error.message ? error.message : error );
				ui.loading.classList.add( 'is-error' );
				// eslint-disable-next-line no-console
				console.error( error );
			} );

		return () => {
			disposed = true;
			if ( stop ) {
				stop();
			}
		};
	};

	async function start( cfg, ui ) {
		const [ THREE, data ] = await Promise.all( [
			import( cfg.threeUrl ),
			fetch( cfg.restUrl, { credentials: 'same-origin', headers: { 'X-WP-Nonce': cfg.nonce } } ).then( ( r ) => {
				if ( ! r.ok ) {
					throw new Error( 'HTTP ' + r.status );
				}
				return r.json();
			} ),
		] );

		const cleanups = [];
		const listen = ( target, type, fn, opts ) => {
			target.addEventListener( type, fn, opts );
			cleanups.push( () => target.removeEventListener( type, fn, opts ) );
		};

		// --- Renderer, scene, camera ---
		const renderer = new THREE.WebGLRenderer( { canvas: ui.canvas, antialias: true } );
		renderer.setPixelRatio( Math.min( window.devicePixelRatio || 1, 2 ) );
		renderer.setClearColor( SKY );
		const scene = new THREE.Scene();
		scene.fog = new THREE.Fog( HAZE, 60, 260 );
		const camera = new THREE.PerspectiveCamera( 50, 1, 0.1, 600 );

		scene.add( new THREE.HemisphereLight( 0xb8ccff, 0x1a2244, 1.4 ) );
		const sun = new THREE.DirectionalLight( 0xffffff, 1.6 );
		sun.position.set( -30, 60, 40 );
		scene.add( sun );

		// The ground sits back in the depth buffer so wires and the grid
		// drawn on it never flicker.
		const ground = new THREE.Mesh(
			new THREE.PlaneGeometry( 2000, 2000 ),
			new THREE.MeshLambertMaterial( { color: GROUND, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 } )
		);
		ground.rotation.x = -Math.PI / 2;
		scene.add( ground );
		const grid = new THREE.GridHelper( 800, 133, GRID, GRID );
		grid.material.transparent = true;
		grid.material.opacity = 0.35;
		grid.material.depthWrite = false;
		grid.position.y = 0.01;
		scene.add( grid );

		// --- The tree ---
		const now = data.now || Date.now() / 1000;
		const root = prepare( data.root, null, 0 );
		place( root, 0 );
		const nodes = [];
		walk( root, ( n ) => nodes.push( n ) );

		const unitBox = new THREE.BoxGeometry( 1, 1, 1 );
		unitBox.translate( 0, 0.5, 0 );
		const materials = new Map();
		const material = ( color, opacity = 1 ) => {
			const key = color + ':' + opacity;
			if ( ! materials.has( key ) ) {
				materials.set( key, new THREE.MeshLambertMaterial( { color, transparent: opacity < 1, opacity } ) );
			}
			return materials.get( key );
		};
		const pickable = [];
		const textures = [];

		for ( const node of nodes ) {
			const ped = new THREE.Mesh( unitBox, material( PEDESTAL ) );
			ped.scale.set( node.w, node.h, node.d );
			ped.position.set( node.x, 0, node.z );
			ped.userData = { kind: 'pedestal', node };
			node.mesh = ped;
			scene.add( ped );
			pickable.push( ped );

			node.files.forEach( ( file, i ) => {
				const col = i % node.cols;
				const row = Math.floor( i / node.cols );
				const mesh = new THREE.Mesh( unitBox, material( ageColor( file ), file.status === 'publish' || file.status === 'inherit' ? 1 : 0.5 ) );
				mesh.scale.set( BLOCK, file.height, BLOCK );
				mesh.position.set(
					node.x - node.w / 2 + 0.3 + PITCH / 2 + col * PITCH,
					node.h,
					// Front row nearest the viewer.
					node.z + node.d / 2 - 0.3 - PITCH / 2 - row * PITCH
				);
				mesh.userData = { kind: 'file', file, node };
				file.mesh = mesh;
				scene.add( mesh );
				pickable.push( mesh );
			} );

			scene.add( label( node ) );
			if ( node.parent ) {
				scene.add( wire( node.parent, node ) );
			}
		}

		// The spotlight: a pale beam from above onto the selection,
		// fading out as it rises.
		const fade = document.createElement( 'canvas' );
		fade.width = 1;
		fade.height = 64;
		const fctx = fade.getContext( '2d' );
		const ramp = fctx.createLinearGradient( 0, 0, 0, 64 );
		ramp.addColorStop( 0, '#000' );
		ramp.addColorStop( 1, '#fff' );
		fctx.fillStyle = ramp;
		fctx.fillRect( 0, 0, 1, 64 );
		const fadeMap = new THREE.CanvasTexture( fade );
		textures.push( fadeMap );
		const beam = new THREE.Mesh(
			new THREE.CylinderGeometry( 0.15, 0.55, 1, 32, 1, true ),
			new THREE.MeshBasicMaterial( { color: 0xeaf2ff, alphaMap: fadeMap, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false } )
		);
		beam.geometry.translate( 0, 0.5, 0 );
		beam.visible = false;
		scene.add( beam );

		// --- Camera control: a target and an orbit around it ---
		const target = new THREE.Vector3();
		const orbit = { radius: 16, yaw: 0, pitch: 0.55 };
		let flight = null;
		let dirty = true;

		function applyOrbit() {
			orbit.pitch = Math.min( 1.45, Math.max( 0.05, orbit.pitch ) );
			orbit.radius = Math.min( 160, Math.max( 3, orbit.radius ) );
			const r = orbit.radius;
			camera.position.set(
				target.x + r * Math.cos( orbit.pitch ) * Math.sin( orbit.yaw ),
				target.y + r * Math.sin( orbit.pitch ),
				target.z + r * Math.cos( orbit.pitch ) * Math.cos( orbit.yaw )
			);
			camera.lookAt( target );
			dirty = true;
		}

		function flyTo( look, view, ms = 900 ) {
			const from = { target: target.clone(), ...orbit };
			// Turn the short way round.
			let yaw = view.yaw;
			while ( yaw - from.yaw > Math.PI ) {
				yaw -= Math.PI * 2;
			}
			while ( from.yaw - yaw > Math.PI ) {
				yaw += Math.PI * 2;
			}
			const to = { target: look.clone(), radius: view.radius, yaw, pitch: view.pitch };
			const t0 = performance.now();
			flight = ( t ) => {
				const k = Math.min( 1, ( t - t0 ) / ms );
				const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow( -2 * k + 2, 3 ) / 2;
				target.lerpVectors( from.target, to.target, e );
				// Pull back mid-flight, as fsn did when it swooped.
				const hop = Math.sin( Math.PI * e ) * Math.min( 14, from.target.distanceTo( to.target ) * 0.25 );
				orbit.radius = from.radius + ( to.radius - from.radius ) * e + hop;
				orbit.yaw = from.yaw + ( to.yaw - from.yaw ) * e;
				orbit.pitch = from.pitch + ( to.pitch - from.pitch ) * e;
				applyOrbit();
				if ( k >= 1 ) {
					flight = null;
				}
			};
		}

		// --- Directories and selection ---
		let here = root;
		let selected = null;

		function visit( node, ms ) {
			if ( here && here.mesh ) {
				here.mesh.material = material( PEDESTAL );
			}
			here = node;
			node.mesh.material = material( PEDESTAL_HERE );
			ui.directory.textContent = pathOf( node );
			ui.buttons.up.disabled = ! node.parent;
			if ( node.children.length ) {
				// A directory with children: frame everything under it.
				let minX = node.x - node.w / 2;
				let maxX = node.x + node.w / 2;
				let deepest = node.z;
				walk( node, ( n ) => {
					minX = Math.min( minX, n.x - n.span / 2 );
					maxX = Math.max( maxX, n.x + n.span / 2 );
					deepest = Math.min( deepest, n.z );
				} );
				const span = Math.max( maxX - minX, ROW );
				flyTo( new THREE.Vector3( ( minX + maxX ) / 2, 1, ( node.z + deepest ) / 2 ), { radius: span * 0.62 + 8, yaw: 0, pitch: 0.42 }, ms );
				return;
			}
			const size = Math.max( node.w, node.d, node.tallest );
			flyTo( new THREE.Vector3( node.x, node.h + node.tallest * 0.35, node.z ), { radius: 9 + size * 1.9, yaw: 0, pitch: 0.55 }, ms );
		}

		function select( file ) {
			selected = file;
			ui.buttons.open.disabled = ! file || ! file.edit;
			ui.buttons.view.disabled = ! file || ! file.view;
			if ( ! file ) {
				beam.visible = false;
				ui.selection.textContent = 'None selected';
				dirty = true;
				return;
			}
			const top = file.mesh.position.y + file.height;
			beam.visible = true;
			beam.position.set( file.mesh.position.x, top, file.mesh.position.z );
			beam.scale.set( 1, 14, 1 );
			ui.selection.textContent = describe( file );
			dirty = true;
		}

		function overview() {
			let minX = Infinity;
			let maxX = -Infinity;
			let minZ = Infinity;
			for ( const n of nodes ) {
				minX = Math.min( minX, n.x - n.w / 2 );
				maxX = Math.max( maxX, n.x + n.w / 2 );
				minZ = Math.min( minZ, n.z - n.d / 2 );
			}
			const span = Math.max( maxX - minX, root.z - minZ );
			flyTo( new THREE.Vector3( ( minX + maxX ) / 2, 0, ( root.z + minZ ) / 2 ), { radius: span * 0.62 + 10, yaw: 0, pitch: 0.95 }, 1100 );
		}

		function open( file, view ) {
			if ( ! file ) {
				return;
			}
			const url = view ? file.view : file.edit;
			if ( ! url ) {
				return;
			}
			const os = window.wp && wp.os;
			if ( os && os.windowManager && ! view ) {
				// The shell's own id for this URL, so a post opened here and
				// from its desktop tile share one window.
				const id = os.deriveWindowId ? os.deriveWindowId( url ) : 'fsn-edit-' + file.id;
				os.windowManager.open( { id, baseId: id, url, title: file.title, icon: file.type === 'attachment' ? 'dashicons-admin-media' : 'dashicons-edit' } );
			} else {
				window.open( url, '_blank', 'noopener' );
			}
		}

		// --- Pointer: click a pedestal to fly, a block to select, drag to look ---
		const raycaster = new THREE.Raycaster();
		const pointer = new THREE.Vector2();
		let drag = null;
		let hover = null;
		const tip = document.createElement( 'div' );
		tip.className = 'fsn__tip';
		ui.view.appendChild( tip );
		cleanups.push( () => tip.remove() );

		function pick( event ) {
			const rect = ui.canvas.getBoundingClientRect();
			pointer.set( ( ( event.clientX - rect.left ) / rect.width ) * 2 - 1, -( ( event.clientY - rect.top ) / rect.height ) * 2 + 1 );
			raycaster.setFromCamera( pointer, camera );
			const hit = raycaster.intersectObjects( pickable, false )[ 0 ];
			return hit ? hit.object.userData : null;
		}

		listen( ui.canvas, 'pointerdown', ( e ) => {
			ui.view.focus( { preventScroll: true } );
			drag = { x: e.clientX, y: e.clientY, moved: false, pan: e.button === 2 || e.shiftKey, id: e.pointerId };
			ui.canvas.setPointerCapture( e.pointerId );
		} );
		listen( ui.canvas, 'pointermove', ( e ) => {
			if ( drag ) {
				const dx = e.clientX - drag.x;
				const dy = e.clientY - drag.y;
				if ( ! drag.moved && Math.hypot( dx, dy ) < 4 ) {
					return;
				}
				drag.moved = true;
				drag.x = e.clientX;
				drag.y = e.clientY;
				flight = null;
				if ( drag.pan ) {
					// Slide the target across the ground, in screen directions.
					const k = orbit.radius / 600;
					const right = new THREE.Vector3( Math.cos( orbit.yaw ), 0, -Math.sin( orbit.yaw ) );
					const ahead = new THREE.Vector3( -Math.sin( orbit.yaw ), 0, -Math.cos( orbit.yaw ) );
					target.addScaledVector( right, -dx * k ).addScaledVector( ahead, dy * k );
				} else {
					orbit.yaw -= dx * 0.006;
					orbit.pitch += dy * 0.005;
				}
				applyOrbit();
				return;
			}
			const hit = pick( e );
			const next = hit && hit.kind === 'file' ? hit.file : null;
			ui.canvas.style.cursor = hit ? 'pointer' : '';
			if ( next !== hover ) {
				hover = next;
				tip.textContent = next ? next.title : '';
				tip.hidden = ! next;
			}
			if ( next ) {
				const rect = ui.view.getBoundingClientRect();
				tip.style.left = e.clientX - rect.left + 14 + 'px';
				tip.style.top = e.clientY - rect.top + 10 + 'px';
			}
		} );
		listen( ui.canvas, 'pointerup', ( e ) => {
			const was = drag;
			drag = null;
			if ( ui.canvas.hasPointerCapture( e.pointerId ) ) {
				ui.canvas.releasePointerCapture( e.pointerId );
			}
			if ( ! was || was.moved || e.button !== 0 ) {
				return;
			}
			const hit = pick( e );
			if ( ! hit ) {
				select( null );
			} else if ( hit.kind === 'pedestal' ) {
				visit( hit.node );
			} else {
				if ( hit.node !== here ) {
					visit( hit.node );
				}
				select( hit.file );
			}
		} );
		listen( ui.canvas, 'pointerleave', () => {
			hover = null;
			tip.hidden = true;
		} );
		listen( ui.canvas, 'dblclick', ( e ) => {
			const hit = pick( e );
			if ( hit && hit.kind === 'file' ) {
				open( hit.file, false );
			}
		} );
		listen( ui.canvas, 'contextmenu', ( e ) => e.preventDefault() );
		listen(
			ui.canvas,
			'wheel',
			( e ) => {
				e.preventDefault();
				flight = null;
				orbit.radius *= Math.exp( Math.max( -100, Math.min( 100, e.deltaY ) ) * 0.0012 );
				applyOrbit();
			},
			{ passive: false }
		);

		// --- Keyboard: arrows look, W/S move, Enter opens, Backspace goes up ---
		listen( ui.view, 'keydown', ( e ) => {
			const step = 0.08;
			switch ( e.key ) {
				case 'ArrowLeft':
					orbit.yaw += step;
					break;
				case 'ArrowRight':
					orbit.yaw -= step;
					break;
				case 'ArrowUp':
					orbit.pitch += step;
					break;
				case 'ArrowDown':
					orbit.pitch -= step;
					break;
				case 'w':
				case '+':
				case '=':
					orbit.radius *= 0.9;
					break;
				case 's':
				case '-':
					orbit.radius *= 1.1;
					break;
				case 'Home':
					visit( root );
					break;
				case 'Backspace':
					if ( here.parent ) {
						visit( here.parent );
					}
					break;
				case 'Enter':
					open( selected, false );
					break;
				case 'Escape':
					select( null );
					break;
				default:
					return;
			}
			e.preventDefault();
			flight = null;
			applyOrbit();
		} );

		listen( ui.buttons.home, 'click', () => visit( root ) );
		listen( ui.buttons.up, 'click', () => here.parent && visit( here.parent ) );
		listen( ui.buttons.overview, 'click', overview );
		listen( ui.buttons.open, 'click', () => open( selected, false ) );
		listen( ui.buttons.view, 'click', () => open( selected, true ) );

		// The age key, so the colours mean something.
		const legend = document.createElement( 'div' );
		legend.className = 'fsn__legend';
		legend.innerHTML = '<span class="fsn__label">Age:</span><span class="fsn__ramp">' + AGES.map( ( a ) => `<i style="background:#${ a.color.toString( 16 ).padStart( 6, '0' ) }" title="${ a.label }"></i>` ).join( '' ) + '</span><span class="fsn__ramp-ends">new → old</span>';
		ui.panel.appendChild( legend );
		cleanups.push( () => legend.remove() );

		// --- Size and draw ---
		function resize() {
			const w = Math.max( 1, ui.view.clientWidth );
			const h = Math.max( 1, ui.view.clientHeight );
			renderer.setSize( w, h, false );
			camera.aspect = w / h;
			camera.updateProjectionMatrix();
			dirty = true;
		}
		const observer = new ResizeObserver( resize );
		observer.observe( ui.view );
		resize();

		let frame = 0;
		const loop = ( t ) => {
			frame = requestAnimationFrame( loop );
			if ( flight ) {
				flight( t );
			}
			if ( dirty ) {
				dirty = false;
				renderer.render( scene, camera );
			}
		};

		// Arrive the way fsn opened: from high above, swooping down to /.
		target.set( root.x, 0, root.z - ROW );
		Object.assign( orbit, { radius: 120, yaw: 0, pitch: 1.2 } );
		applyOrbit();
		visit( root, 1600 );
		ui.loading.hidden = true;
		frame = requestAnimationFrame( loop );
		// Announce the first frame, for anything waiting on the view.
		requestAnimationFrame( () => ui.view.dispatchEvent( new CustomEvent( 'fsn-ready', { bubbles: true } ) ) );

		return () => {
			cancelAnimationFrame( frame );
			observer.disconnect();
			cleanups.forEach( ( fn ) => fn() );
			scene.traverse( ( o ) => {
				if ( o.geometry && o.geometry !== unitBox ) {
					o.geometry.dispose();
				}
			} );
			unitBox.dispose();
			materials.forEach( ( m ) => m.dispose() );
			textures.forEach( ( t ) => t.dispose() );
			renderer.dispose();
		};

		// --- Helpers that need THREE or the scene ---

		function label( node ) {
			const text = node.name;
			const canvas = document.createElement( 'canvas' );
			const ctx = canvas.getContext( '2d' );
			const font = '600 64px Helvetica, Arial, sans-serif';
			ctx.font = font;
			canvas.width = Math.ceil( ctx.measureText( text ).width ) + 24;
			canvas.height = 88;
			ctx.font = font;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.lineWidth = 10;
			ctx.strokeStyle = 'rgba( 10, 18, 40, 0.85 )';
			ctx.strokeText( text, canvas.width / 2, 46 );
			ctx.fillStyle = '#ffffff';
			ctx.fillText( text, canvas.width / 2, 46 );
			const texture = new THREE.CanvasTexture( canvas );
			texture.colorSpace = THREE.SRGBColorSpace;
			texture.anisotropy = 4;
			textures.push( texture );
			const height = 1.3;
			const plane = new THREE.Mesh(
				new THREE.PlaneGeometry( ( canvas.width / canvas.height ) * height, height ),
				new THREE.MeshBasicMaterial( { map: texture, transparent: true, depthWrite: false } )
			);
			// Laid back on the ground in front of the pedestal, tilted up
			// enough to read.
			plane.rotation.x = -Math.PI / 3;
			plane.position.set( node.x, 0.45, node.z + node.d / 2 + 1.1 );
			return plane;
		}

		function wire( parent, child ) {
			const y = 0.04;
			const from = parent.z - parent.d / 2;
			const to = child.z + child.d / 2 + 2.2;
			const mid = ( from + to ) / 2;
			const points = [
				new THREE.Vector3( parent.x, y, from ),
				new THREE.Vector3( parent.x, y, mid ),
				new THREE.Vector3( child.x, y, mid ),
				new THREE.Vector3( child.x, y, to ),
			];
			return new THREE.Line( new THREE.BufferGeometry().setFromPoints( points ), new THREE.LineBasicMaterial( { color: WIRE } ) );
		}

		function ageColor( file ) {
			const days = ( now - file.modified ) / 86400;
			return AGES.find( ( a ) => days < a.days ).color;
		}
	}

	// --- Layout, independent of THREE ---

	function prepare( raw, parent, depth ) {
		// Shortest blocks in front, so none hides behind a taller one.
		const files = ( raw.files || [] ).map( ( f ) => ( { ...f, height: heightOf( f ) } ) ).sort( ( a, b ) => a.height - b.height );
		const n = files.length;
		const cols = Math.max( 2, Math.ceil( Math.sqrt( n ) ) );
		const rows = Math.max( 2, Math.ceil( n / cols ) );
		const total = files.reduce( ( s, f ) => s + f.height, 0 );
		const node = {
			name: raw.name,
			parent,
			depth,
			files,
			cols,
			rows,
			w: cols * PITCH + 0.6,
			d: rows * PITCH + 0.6,
			// fsn raised a directory by the total size of what it held.
			h: 0.3 + Math.log10( 1 + total ) * 0.25,
			tallest: files.reduce( ( m, f ) => Math.max( m, f.height ), 0 ),
		};
		// The room a pedestal needs in its row: itself, or its name.
		node.span = Math.max( node.w, String( raw.name ).length * 0.6 + 0.5 );
		node.children = ( raw.children || [] ).map( ( c ) => prepare( c, node, depth + 1 ) );
		return node;
	}

	/** Lay out a subtree; returns its width. Parents centre over children. */
	function place( node, left ) {
		node.z = -node.depth * ROW;
		if ( ! node.children.length ) {
			node.x = left + node.span / 2;
			return node.span;
		}
		let x = left;
		for ( const child of node.children ) {
			x += place( child, x ) + GAP;
		}
		const width = Math.max( node.span, x - GAP - left );
		const first = node.children[ 0 ];
		const last = node.children[ node.children.length - 1 ];
		node.x = ( first.x + last.x ) / 2;
		if ( node.depth === 0 ) {
			// Centre the whole tree on the origin.
			const shift = -node.x;
			walk( node, ( n ) => ( n.x += shift ) );
		}
		return width;
	}

	function walk( node, fn ) {
		fn( node );
		node.children.forEach( ( c ) => walk( c, fn ) );
	}

	function heightOf( file ) {
		const units = file.unit === 'bytes' ? file.size / 1024 : file.size;
		return 0.25 + Math.log10( 1 + units ) * 1.15;
	}

	function pathOf( node ) {
		const parts = [];
		for ( let n = node; n && n.parent; n = n.parent ) {
			parts.unshift( n.name );
		}
		return '/' + parts.join( '/' );
	}

	function describe( file ) {
		const size = file.unit === 'bytes' ? bytes( file.size ) : file.size.toLocaleString() + ' words';
		const status = file.status === 'publish' || file.status === 'inherit' ? '' : ' · ' + file.status;
		return `${ file.title } · ${ size } · modified ${ ago( file.modified ) }${ status }`;
	}

	function bytes( n ) {
		if ( n < 1024 ) {
			return n + ' bytes';
		}
		if ( n < 1048576 ) {
			return ( n / 1024 ).toFixed( 0 ) + ' KB';
		}
		return ( n / 1048576 ).toFixed( 1 ) + ' MB';
	}

	function ago( seconds ) {
		const days = Math.floor( ( Date.now() / 1000 - seconds ) / 86400 );
		if ( days < 1 ) {
			return 'today';
		}
		if ( days < 60 ) {
			return days + ( days === 1 ? ' day ago' : ' days ago' );
		}
		if ( days < 730 ) {
			return Math.round( days / 30 ) + ' months ago';
		}
		return Math.round( days / 365 ) + ' years ago';
	}
} )();
