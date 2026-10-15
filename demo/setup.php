<?php
/*
 * Runs once inside Playground, after OpenStation is installed and the
 * theme ZIP is written to /tmp/theme.zip. Leaves the visitor on a
 * furnished desk wearing the theme, with nothing to dismiss first.
 */
require_once '/wordpress/wp-load.php';
require_once ABSPATH . 'wp-admin/includes/file.php';

$user = get_user_by( 'login', 'admin' );
wp_set_current_user( $user->ID );
wp_update_user( array( 'ID' => $user->ID, 'display_name' => 'Webmaster' ) );
update_option( 'blogname', 'OpenStation' );

// The desktop theme, installed the way Preferences > Themes does it.
$theme = openstation_desktop_theme_install_from_zip( '/tmp/theme.zip' );
if ( is_wp_error( $theme ) ) {
	throw new Exception( $theme->get_error_message() );
}

// OpenStation on, every first-run intro already seen, and the
// Dashboard showing its boxes rather than the welcome panel.
update_user_meta( $user->ID, 'show_welcome_panel', 0 );
update_user_meta( $user->ID, 'desktop_mode_mode', '1' );
update_user_meta(
	$user->ID,
	'desktop_mode_seen_intros',
	array( 'activation-nudge', 'activation-welcome', 'openstation-rebrand', 'shell-tour', 'usage-feedback' )
);

// The theme with its recommended settings, as the Apply button in
// Preferences > Themes would leave them.
$slug     = $theme['slug'];
$rec      = (array) ( $theme['manifest']['recommendedOsSettings'] ?? array() );
$settings = array(
	'desktopTheme'                => $slug,
	'appliedThemeRecommendations' => array( $slug ),
);
foreach ( array( 'dockSize', 'desktopLayout', 'dockPlacement', 'windowRadius', 'adminBarMode', 'dockRailRenderer', 'windowReveal', 'windowRevealDuration' ) as $key ) {
	if ( isset( $rec[ $key ] ) ) {
		$settings[ $key ] = $rec[ $key ];
	}
}
if ( ! empty( $rec['wallpaper'] ) ) {
	$settings['wallpaper'] = 'desktop-theme/' . $slug . '/' . $rec['wallpaper'];
}
if ( ! empty( $rec['accentColor'] ) ) {
	$settings['accent']       = 'custom';
	$settings['customAccent'] = $rec['accentColor'];
}
if ( ! empty( $rec['navPlacement'] ) ) {
	$settings['navPlacement'] = $rec['navPlacement'];
}
update_user_meta( $user->ID, 'desktop_mode_os_settings', openstation_sanitize_os_settings( $settings ) );

// A must-use plugin for the demo's lifetime.
wp_mkdir_p( WPMU_PLUGIN_DIR );
file_put_contents(
	WPMU_PLUGIN_DIR . '/demo-desk.php',
	<<<'PHP'
<?php
// The demo resets on every visit and cannot update itself, so it
// reports nothing to update.
add_filter(
	'pre_site_transient_update_core',
	fn() => (object) array( 'last_checked' => time(), 'version_checked' => get_bloginfo( 'version' ), 'updates' => array(), 'translations' => array() )
);
foreach ( array( 'update_plugins', 'update_themes' ) as $transient ) {
	add_filter(
		"pre_site_transient_$transient",
		fn() => (object) array( 'last_checked' => time(), 'checked' => array(), 'response' => array(), 'translations' => array() )
	);
}

// The widget column lives in the browser's storage, which every
// Playground on the same origin shares. Clear it on the first page of
// each visit, so the desk starts from the theme's own column rather
// than what another Playground left behind.
add_action(
	'admin_head',
	function () {
		if ( get_option( 'demo_desk_cleared' ) ) {
			return;
		}
		update_option( 'demo_desk_cleared', 1 );
		echo "<script>try{localStorage.removeItem('desktop-mode-widgets');localStorage.removeItem('desktop-mode-widgets-geometry');}catch(e){}</script>";
	}
);

// Tell the page hosting Playground when the fsn window has drawn, so
// its splash stays up until there is something to see.
add_action(
	'admin_footer',
	function () {
		if ( 'openstation' !== ( $_GET['page'] ?? '' ) ) {
			return;
		}
		echo "<script>document.addEventListener('fsn-ready',function(){setTimeout(function(){try{window.top.postMessage({source:'fsn-demo',ready:true},'*');}catch(e){}},300);});</script>";
	}
);

// Arrange the first view, once per visit: the Dashboard clear of the
// desktop icons, and fsn open in front of it.
add_action(
	'admin_footer',
	function () {
		if ( get_option( 'demo_fsn_opened' ) || 'openstation' !== ( $_GET['page'] ?? '' ) ) {
			return;
		}
		update_option( 'demo_fsn_opened', 1 );
		?>
<script>
addEventListener( 'load', function () {
	wp.os.whenReady( function () {
		setTimeout( arrange, 800 );
	} );
} );
function arrange() {
	var wm = wp.os.windowManager;
	var dash = wm.getAll().find( function ( w ) {
		return w.config.baseId === 'index-php' || w.config.title === 'Dashboard';
	} );
	var area = dash ? dash.element.parentElement : document.body, box = area.getBoundingClientRect(), right = 0;
	document.querySelectorAll( '.os-icon, .os-file-tile' ).forEach( function ( icon ) {
		if ( ! icon.closest( '.os-window' ) ) {
			right = Math.max( right, icon.getBoundingClientRect().right - box.left );
		}
	} );
	var left = Math.round( right + 12 );
	if ( dash ) {
		dash.element.style.left = left + 'px';
		if ( left + dash.element.offsetWidth > area.clientWidth - 16 ) {
			dash.element.style.width = Math.max( 480, area.clientWidth - 16 - left ) + 'px';
		}
	}
	wp.os.openWindow( 'fsn-navigator' );
	var tries = 0;
	( function place() {
		var w = wm.getById( 'fsn-navigator' );
		if ( ! w ) {
			if ( tries++ < 20 ) {
				setTimeout( place, 150 );
			}
			return;
		}
		var e = w.element, p = e.parentElement;
		var x = Math.min( left + 48, Math.max( 16, p.clientWidth - 980 ) );
		e.style.left = x + 'px';
		e.style.top = '28px';
		e.style.width = Math.max( 560, p.clientWidth - x - 24 ) + 'px';
		e.style.height = Math.max( 400, p.clientHeight - 56 ) + 'px';
	} )();
}
</script>
		<?php
	}
);
PHP
);

// Something to look at.
$posts = array(
	'It is a UNIX system'                      => 'Somebody has to get the doors locked, and the fastest way there is to fly over the file system.',
	'Reading the information landscape'        => 'Pedestals are directories and blocks are files. A tall block is a big file; a red one is new, a violet one is old.',
	'Restoring power to the visitor center'    => 'Main breakers first, then the fences, then the phones. Write it down this time.',
	'Why my Indigo has a name'                 => 'Every workstation deserves one. Mine is called raptor, and it has opinions about the network.',
	'A field guide to /usr/people'             => 'Home directories, dot files and one account nobody will admit to creating.',
);
$ids = array();
foreach ( $posts as $title => $body ) {
	$ids[ $title ] = wp_insert_post(
		array(
			'post_title'   => $title,
			'post_content' => $body,
			'post_status'  => 'publish',
			'post_author'  => $user->ID,
		)
	);
}
$pages = array();
foreach ( array( 'Park map', 'Visitor center', 'Control room' ) as $title ) {
	$pages[] = wp_insert_post(
		array(
			'post_title'  => $title,
			'post_type'   => 'page',
			'post_status' => 'publish',
			'post_author' => $user->ID,
		)
	);
}
// A short note about the demo, first in the Documents folder.
$name  = $theme['manifest']['name'];
$about = wp_insert_post(
	array(
		'post_title'   => 'About this demo',
		'post_status'  => 'publish',
		'post_author'  => $user->ID,
		'post_content' => '<!-- wp:paragraph --><p>This is WordPress, running entirely in your browser. Every visit starts a fresh site, and nothing you change here is saved.</p><!-- /wp:paragraph -->'
			. '<!-- wp:paragraph --><p>The desktop is <a href="https://openstation.me">WordPress OpenStation</a>, a plugin that turns wp-admin into a desktop with windows, a dock and files on the desk. This look is its <a href="https://wp-os-fsn.space.fast/theme.zip">' . esc_html( $name ) . '</a> theme, after the 3D File System Navigator that SGI shipped for IRIX. Grab the ZIP and upload it in Preferences &gt; Themes.</p><!-- /wp:paragraph -->'
			. '<!-- wp:paragraph --><p>The <strong>fsn</strong> window is the <a href="https://wp-os-fsn.space.fast/fsn-navigator.zip">FSN Navigator</a> plugin. It draws this site as an information landscape: each category, the pages and each kind of media is a pedestal, and every post, page or file is a block on it. A block\'s height is its size and its colour its age, red for new through to violet for old. Click a pedestal to fly to it, click a block to select it, and double-click to open it.</p><!-- /wp:paragraph -->'
			. '<!-- wp:paragraph --><p>WordPress runs in the browser with <a href="https://wordpress.org/playground/">WordPress Playground</a>, and this page is hosted on <a href="https://spacefast.com">Spacefast</a>.</p><!-- /wp:paragraph -->'
			. '<!-- wp:paragraph --><p>Go ahead and click around.</p><!-- /wp:paragraph -->',
	)
);
update_option( 'demo_about_post', $about );

$folder = openstation_files_create_folder( $user->ID, array( 'name' => 'Documents' ) );
if ( ! is_wp_error( $folder ) ) {
	update_option( 'demo_documents_folder', $folder );
	openstation_files_place_at_next_free_slot( $user->ID, $folder, 'post', (string) $about );
	openstation_files_place( $user->ID, 0, 'folder', (string) $folder, array( 'x' => 0, 'y' => 2 ) );
	foreach ( array_slice( $ids, 0, 3 ) as $id ) {
		openstation_files_place_at_next_free_slot( $user->ID, $folder, 'post', (string) $id );
	}
}
openstation_files_place( $user->ID, 0, 'post', (string) $ids['It is a UNIX system'], array( 'x' => 0, 'y' => 3 ) );

// A landscape worth flying over: posts in categories, of every length
// and age, a few drafts, and some images.
$words = explode( ' ', 'the park fence power grid raptor paddock visitor center control room tour vehicle generator door lock system network file directory amber sample embryo genetics hatchery island storm ferry dock jungle river helicopter radio security camera perimeter feeding schedule veterinarian paleontologist dig site fossil theory chaos mathematics butterfly weather rain lab mosquito sequence gap frog dna computer terminal unix workstation monitor keyboard telephone line backup' );
$sentence = function ( $n ) use ( $words ) {
	$out = array();
	for ( $i = 0; $i < $n; $i++ ) {
		$out[] = $words[ mt_rand( 0, count( $words ) - 1 ) ];
	}
	return ucfirst( implode( ' ', $out ) ) . '.';
};
$paragraphs = function ( $count ) use ( $sentence ) {
	$out = '';
	while ( $count > 0 ) {
		$n     = min( $count, mt_rand( 30, 90 ) );
		$text  = '';
		$left  = $n;
		while ( $left > 0 ) {
			$len   = min( $left, mt_rand( 6, 16 ) );
			$text .= $sentence( $len ) . ' ';
			$left -= $len;
		}
		$out   .= '<!-- wp:paragraph --><p>' . trim( $text ) . '</p><!-- /wp:paragraph -->';
		$count -= $n;
	}
	return $out;
};
// Back-date a post: wp_insert_post always stamps the modified date now.
$age = function ( $id, $days ) {
	global $wpdb;
	$when = gmdate( 'Y-m-d H:i:s', time() - (int) ( $days * DAY_IN_SECONDS ) );
	$wpdb->update(
		$wpdb->posts,
		array( 'post_date' => $when, 'post_date_gmt' => $when, 'post_modified' => $when, 'post_modified_gmt' => $when ),
		array( 'ID' => $id )
	);
	clean_post_cache( $id );
};
mt_srand( 1993 );

$catalogue = array(
	'Park Operations' => array( 'Morning checklist for the tour vehicles', 'Fence voltage, explained', 'When the ferry leaves early', 'Feeding schedule for the east paddocks', 'Storm protocol', 'Generator maintenance log', 'Rebooting the door locks' ),
	'Genetics'        => array( 'Filling the gaps in the sequence', 'Why frog DNA seemed like a good idea', 'Notes from the hatchery', 'Amber, mosquitoes and patience', 'Lysine contingency' ),
	'Control Room'    => array( 'Every terminal has a name', 'Backups nobody tested', 'The network map on the wall', 'Flying the file system in 3D', 'A short history of the phone lines', 'Keyboard shortcuts I wish I knew sooner' ),
	'Visitor Center'  => array( 'Gift shop inventory', 'The animatronic tour script', 'Lunch menu for opening weekend', 'Signage that needs fixing' ),
	'Field Notes'     => array( 'A dig site in Montana', 'Chaos theory over dinner', 'The river tour, reviewed', 'Watching the herd from the ridge' ),
);
$ages = array( 0.2, 0.6, 3, 5, 12, 20, 45, 70, 120, 200, 300, 500, 800, 1300 );
$i    = 0;
foreach ( $catalogue as $category => $titles ) {
	$term = wp_insert_term( $category, 'category' );
	$cat  = is_wp_error( $term ) ? (int) get_cat_ID( $category ) : (int) $term['term_id'];
	foreach ( $titles as $title ) {
		$id = wp_insert_post(
			array(
				'post_title'    => $title,
				'post_content'  => $paragraphs( (int) round( 40 * pow( 1.6, mt_rand( 0, 9 ) ) ) ),
				'post_status'   => 0 === $i % 9 ? 'draft' : 'publish',
				'post_author'   => $user->ID,
				'post_category' => array( $cat ),
			)
		);
		$age( $id, $ages[ $i % count( $ages ) ] * ( 0.7 + mt_rand( 0, 60 ) / 100 ) );
		$i++;
	}
}
// The original handful go to the Control Room too, and age a little.
$control = (int) get_cat_ID( 'Control Room' );
foreach ( $ids as $title => $id ) {
	wp_set_post_categories( $id, array( $control ) );
	$age( $id, mt_rand( 1, 30 ) );
}
foreach ( $pages as $n => $page ) {
	wp_update_post( array( 'ID' => $page, 'post_content' => $paragraphs( 120 + 300 * $n ) ) );
	$age( $page, 40 + 200 * $n );
}
foreach ( array( 'Emergency contacts' => 90, 'Staff handbook' => 1500, 'Press kit' => 400 ) as $title => $length ) {
	$id = wp_insert_post( array( 'post_title' => $title, 'post_type' => 'page', 'post_status' => 'publish', 'post_author' => $user->ID, 'post_content' => $paragraphs( $length ) ) );
	$age( $id, mt_rand( 2, 900 ) );
}

// Images, painted with GD where Playground has it.
if ( function_exists( 'imagecreatetruecolor' ) ) {
	$palette = array( array( 232, 53, 43 ), array( 240, 138, 0 ), array( 232, 192, 0 ), array( 95, 184, 28 ), array( 31, 181, 173 ), array( 47, 107, 232 ), array( 168, 69, 224 ) );
	foreach ( array( 'paddock-aerial', 'fence-detail', 'raptor-pen', 'visitor-center', 'control-room', 'amber-sample', 'ferry-dock', 'storm-front', 'dig-site' ) as $n => $slug ) {
		$w   = 160 * ( 1 + $n % 4 );
		$h   = (int) ( $w * 0.66 );
		$img = imagecreatetruecolor( $w, $h );
		list( $r, $g, $b ) = $palette[ $n % count( $palette ) ];
		for ( $y = 0; $y < $h; $y++ ) {
			$k = $y / $h;
			imageline( $img, 0, $y, $w, $y, imagecolorallocate( $img, (int) ( $r * ( 1 - $k ) ), (int) ( $g * ( 1 - $k ) ), (int) ( $b * ( 1 - $k ) + 60 * $k ) ) );
		}
		// Noise, so the files differ in size the way photos do.
		for ( $p = 0; $p < $w * $h / 6; $p++ ) {
			imagesetpixel( $img, mt_rand( 0, $w - 1 ), mt_rand( 0, $h - 1 ), imagecolorallocate( $img, mt_rand( 0, 255 ), mt_rand( 0, 255 ), mt_rand( 0, 255 ) ) );
		}
		ob_start();
		imagepng( $img );
		$png = ob_get_clean();
		imagedestroy( $img );
		$upload = wp_upload_bits( $slug . '.png', null, $png );
		if ( empty( $upload['error'] ) ) {
			$id = wp_insert_attachment(
				array(
					'post_title'     => ucwords( str_replace( '-', ' ', $slug ) ),
					'post_mime_type' => 'image/png',
					'post_status'    => 'inherit',
					'post_author'    => $user->ID,
				),
				$upload['file']
			);
			$age( $id, mt_rand( 0, 700 ) );
		}
	}
}
