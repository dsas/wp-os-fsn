/**
 * The /access command, an easter egg for anyone who has seen the film.
 *
 * Type `/access security` in the command palette and the system refuses.
 * Keep trying, or go straight for `/access main security grid`, and the
 * security interface locks you out: a terminal fills with the one line
 * everybody remembers while a finger wags at you. Type "please" to be
 * let back in.
 */
( function () {
	const ID = 'fsn-access';
	const LINE = "YOU DIDN'T SAY THE MAGIC WORD!";
	const DENIED = 'access: PERMISSION DENIED.';
	const TRIES = [ 'security', 'security grid', 'main security grid' ];

	// Every attempt this page load, for the terminal's transcript.
	const attempts = [];

	// The shell mounts wp.os.ready() after this script has run, so wait
	// for its os-init event when ready() is not there yet.
	function whenShellReady( cb ) {
		if ( window.wp && wp.os && typeof wp.os.ready === 'function' ) {
			wp.os.ready( cb );
			return;
		}
		document.addEventListener( 'os-init', () => ( typeof wp.os.ready === 'function' ? wp.os.ready( cb ) : cb() ), { once: true } );
	}

	whenShellReady( function () {
		wp.os.registerCommand( {
			slug: 'access',
			label: 'access',
			description: 'Access a restricted system.',
			hint: '[system]',
			icon: 'dashicons-lock',
			suggest: ( args ) => {
				const typed = args.trim().toLowerCase();
				return TRIES.filter( ( t ) => t.startsWith( typed ) ).map( ( t ) => ( { value: t, label: 'access ' + t } ) );
			},
			run: ( args, ctx ) => {
				const what = args.trim().toLowerCase() || 'security';
				attempts.push( what );
				if ( what !== 'main security grid' && attempts.length < 3 ) {
					return '`' + DENIED + '`';
				}
				ctx.close();
				lockout();
			},
		} );
	} );

	function lockout() {
		const manager = wp.os.windowManager;
		if ( manager.getById( ID ) ) {
			wp.os.openWindow( ID );
			return;
		}
		wp.os.registerWindow( {
			id: ID,
			title: 'Jurassic Park, System Security Interface',
			icon: 'dashicons-lock',
			width: 720,
			height: 460,
			render,
		} );
		if ( ! manager.getById( ID ) ) {
			wp.os.openWindow( ID );
		}
	}

	function render( body ) {
		body.replaceChildren();
		const root = document.createElement( 'div' );
		root.className = 'fsn-access';
		root.tabIndex = 0;
		root.setAttribute( 'role', 'log' );
		root.setAttribute( 'aria-label', LINE + ' Type please to continue.' );
		const screen = document.createElement( 'pre' );
		screen.className = 'fsn-access__screen';
		const inset = document.createElement( 'canvas' );
		inset.className = 'fsn-access__finger';
		inset.width = 32;
		inset.height = 32;
		inset.setAttribute( 'aria-hidden', 'true' );
		// Out of sight until the line starts.
		inset.hidden = true;
		root.append( screen, inset );
		body.append( root );

		const timers = [];
		const later = ( fn, ms ) => timers.push( setTimeout( fn, ms ) );
		const write = ( text ) => {
			screen.append( text + '\n' );
			// Keep the log bounded, and the newest line in view.
			while ( screen.childNodes.length > 400 ) {
				screen.firstChild.remove();
			}
			screen.scrollTop = screen.scrollHeight;
		};

		// The transcript, then the refusal, then the line, over and over.
		write( 'Jurassic Park, System Security Interface' );
		write( 'Version 4.0.5, Alpha E' );
		write( 'Ready...' );
		let t = 300;
		for ( const what of attempts.slice( -3 ) ) {
			later( () => write( '> access ' + what ), ( t += 350 ) );
			later( () => write( DENIED ), ( t += 350 ) );
		}
		later( () => write( '...and...' ), ( t += 600 ) );
		let flood = null;
		let stopFinger = () => {};
		later( () => {
			inset.hidden = false;
			stopFinger = wag( inset );
			write( LINE );
			beep();
			flood = setInterval( () => {
				write( LINE );
				beep();
			}, 260 );
		}, ( t += 700 ) );

		// Saying the magic word lets you back in.
		let typed = '';
		const onKey = ( e ) => {
			if ( e.key.length !== 1 ) {
				return;
			}
			typed = ( typed + e.key.toLowerCase() ).slice( -6 );
			if ( typed === 'please' ) {
				clearInterval( flood );
				write( '' );
				write( 'Thank you. Access granted.' );
				stopFinger();
				later( () => wp.os.windowManager.getById( ID )?.close(), 1200 );
			}
		};
		root.addEventListener( 'keydown', onKey );
		setTimeout( () => root.focus( { preventScroll: true } ), 0 );

		return () => {
			clearInterval( flood );
			timers.forEach( clearTimeout );
			stopFinger();
			root.removeEventListener( 'keydown', onKey );
			attempts.length = 0;
		};
	}

	// A wagging finger, drawn as 16x16 pixel art on a 32px canvas: the
	// index finger raised at the side of a fist, the others curled beside
	// it, tipping left and right from the wrist.
	const HAND = [
		'...##...........',
		'..#ww#..........',
		'..#ww#..........',
		'..#ww#..........',
		'..#ww#..........',
		'..#ww#.####.....',
		'..#ww##wwww#....',
		'..#ww#ssssss#...',
		'..#ww#wwwwww#...',
		'..#ww#ssssss##..',
		'..#ww#wwwwwww#..',
		'..#wws#######w#.',
		'..#wwwwwwwwwww#.',
		'...#wwwwwwwwww#.',
		'....#wwwwwwww#..',
		'.....########...',
	];
	const INK = { '#': '#1a1a1a', w: '#f2c9a0', s: '#c9966c' };
	function wag( canvas ) {
		const ctx = canvas.getContext( '2d' );
		const sprite = document.createElement( 'canvas' );
		sprite.width = 16;
		sprite.height = 16;
		const sctx = sprite.getContext( '2d' );
		HAND.forEach( ( row, y ) =>
			[ ...row ].forEach( ( ch, x ) => {
				if ( INK[ ch ] ) {
					sctx.fillStyle = INK[ ch ];
					sctx.fillRect( x, y, 1, 1 );
				}
			} )
		);
		ctx.imageSmoothingEnabled = false;
		let frame = 0;
		const tick = () => {
			const angle = [ -0.28, 0, 0.28, 0 ][ frame++ % 4 ];
			ctx.clearRect( 0, 0, 32, 32 );
			ctx.save();
			// Pivot at the wrist, with room for the finger at full tilt.
			ctx.translate( 16, 30 );
			ctx.rotate( angle );
			ctx.drawImage( sprite, -12, -25, 24, 24 );
			ctx.restore();
		};
		tick();
		const timer = setInterval( tick, 160 );
		return () => clearInterval( timer );
	}

	// The terminal's chirp: a short, quiet square wave per line.
	let audio = null;
	function beep() {
		try {
			audio = audio || new ( window.AudioContext || window.webkitAudioContext )();
			const osc = audio.createOscillator();
			const gain = audio.createGain();
			osc.type = 'square';
			osc.frequency.value = 880;
			gain.gain.value = 0.03;
			osc.connect( gain ).connect( audio.destination );
			osc.start();
			osc.stop( audio.currentTime + 0.06 );
		} catch ( e ) {
			// No sound is fine.
		}
	}
} )();
