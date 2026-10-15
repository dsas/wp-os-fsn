<?php
/**
 * Plugin Name:       FSN Navigator
 * Description:       Fly over your site's content in 3D, the way SGI's File System Navigator flew over a file system. Needs WordPress OpenStation.
 * Version:           1.0.0
 * Requires at least: 6.5
 * Requires PHP:      7.4
 * Author:            Dean Sas
 * License:           GPL-2.0-or-later
 * Text Domain:       fsn-navigator
 *
 * Every content group is a directory pedestal and every post, page or
 * attachment a block standing on one. A block's height is its size
 * (words for writing, bytes for media) and its colour its age.
 */

defined( 'ABSPATH' ) || exit;

const FSN_NAVIGATOR_VERSION = '1.0.0';
const FSN_NAVIGATOR_WINDOW  = 'fsn-navigator';

// How many items a single pedestal shows; the rest are summarised.
const FSN_NAVIGATOR_MAX_PER_PEDESTAL = 120;

add_action( 'init', 'fsn_navigator_register', 20 );
add_action( 'admin_enqueue_scripts', 'fsn_navigator_enqueue_access' );
add_action( 'rest_api_init', 'fsn_navigator_register_routes' );

/**
 * The native window and its desktop icon. Silent when OpenStation is
 * not active, so the plugin can stay installed without it.
 */
function fsn_navigator_register() {
	if ( ! function_exists( 'openstation_register_window' ) || ! current_user_can( 'edit_posts' ) ) {
		return;
	}

	wp_register_script(
		'fsn-navigator',
		plugins_url( 'assets/navigator.js', __FILE__ ),
		array( 'openstation' ),
		FSN_NAVIGATOR_VERSION,
		true
	);
	wp_register_style(
		'fsn-navigator',
		plugins_url( 'assets/navigator.css', __FILE__ ),
		array(),
		FSN_NAVIGATOR_VERSION
	);

	$icon = file_get_contents( __DIR__ . '/assets/icon.svg' );

	openstation_register_window(
		FSN_NAVIGATOR_WINDOW,
		array(
			'title'     => __( 'fsn', 'fsn-navigator' ),
			'icon'       => 'data:image/svg+xml;base64,' . base64_encode( $icon ),
			'width'      => 960,
			'height'     => 640,
			'min_width'  => 480,
			'min_height' => 360,
			'script'     => 'fsn-navigator',
			'style'      => 'fsn-navigator',
			'template'   => 'fsn_navigator_template',
			'config'     => array(
				'restUrl'  => esc_url_raw( rest_url( 'fsn-navigator/v1/landscape' ) ),
				'nonce'    => wp_create_nonce( 'wp_rest' ),
				'threeUrl' => plugins_url( 'assets/vendor/three.module.min.js', __FILE__ ),
			),
		)
	);

	if ( function_exists( 'openstation_register_icon' ) ) {
		openstation_register_icon(
			FSN_NAVIGATOR_WINDOW,
			array(
				'title'    => __( 'fsn', 'fsn-navigator' ),
				'icon_svg' => $icon,
				'window'   => FSN_NAVIGATOR_WINDOW,
				'position' => 5,
			)
		);
	}
}

/**
 * The /access command for the command palette. It must be on the page
 * before the palette opens, so it loads with the shell rather than with
 * the fsn window; the lockout window it opens uses the same stylesheet.
 */
function fsn_navigator_enqueue_access() {
	if ( ! function_exists( 'openstation_is_enabled' ) || ! openstation_is_enabled() ) {
		return;
	}
	wp_enqueue_script(
		'fsn-navigator-access',
		plugins_url( 'assets/access.js', __FILE__ ),
		array( 'openstation' ),
		FSN_NAVIGATOR_VERSION,
		true
	);
	wp_enqueue_style( 'fsn-navigator' );
}

/**
 * The window body: the 3D view, and the control panel along the
 * bottom that fsn kept under its landscape. Templates pass through
 * wp_kses, so the canvas is added by the script.
 */
function fsn_navigator_template() {
	?>
	<div class="fsn">
		<div class="fsn__view" tabindex="0" aria-label="<?php esc_attr_e( 'Content landscape. Click a pedestal to fly to it, click a block to select it, double-click to open it. Drag to look around, scroll to move.', 'fsn-navigator' ); ?>">
			<div class="fsn__loading"><?php esc_html_e( 'Reading the information landscape…', 'fsn-navigator' ); ?></div>
		</div>
		<div class="fsn__panel">
			<div class="fsn__path">
				<span class="fsn__label"><?php esc_html_e( 'Directory:', 'fsn-navigator' ); ?></span>
				<span class="fsn__directory">/</span>
			</div>
			<div class="fsn__file">
				<span class="fsn__label"><?php esc_html_e( 'File:', 'fsn-navigator' ); ?></span>
				<span class="fsn__selection"><?php esc_html_e( 'None selected', 'fsn-navigator' ); ?></span>
			</div>
			<div class="fsn__buttons">
				<button type="button" class="fsn__button" data-fsn="home"><?php esc_html_e( 'Home', 'fsn-navigator' ); ?></button>
				<button type="button" class="fsn__button" data-fsn="up"><?php esc_html_e( 'Up', 'fsn-navigator' ); ?></button>
				<button type="button" class="fsn__button" data-fsn="overview"><?php esc_html_e( 'Overview', 'fsn-navigator' ); ?></button>
				<button type="button" class="fsn__button" data-fsn="open" disabled><?php esc_html_e( 'Open', 'fsn-navigator' ); ?></button>
				<button type="button" class="fsn__button" data-fsn="view" disabled><?php esc_html_e( 'View', 'fsn-navigator' ); ?></button>
			</div>
		</div>
	</div>
	<?php
}

function fsn_navigator_register_routes() {
	register_rest_route(
		'fsn-navigator/v1',
		'/landscape',
		array(
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => 'fsn_navigator_landscape',
			'permission_callback' => function () {
				return current_user_can( 'edit_posts' );
			},
		)
	);
}

/**
 * The site as a tree of directories. Each directory carries its own
 * files and its children: Posts by category, Pages, Media by type.
 */
function fsn_navigator_landscape() {
	$posts = array(
		'name'     => __( 'Posts', 'fsn-navigator' ),
		'files'    => array(),
		'children' => array(),
	);
	$categories = get_terms(
		array(
			'taxonomy'   => 'category',
			'hide_empty' => true,
			'orderby'    => 'count',
			'order'      => 'DESC',
			'number'     => 12,
		)
	);
	foreach ( is_array( $categories ) ? $categories : array() as $term ) {
		$posts['children'][] = array(
			'name'  => $term->name,
			'files' => fsn_navigator_files(
				array(
					'post_type' => 'post',
					'cat'       => $term->term_id,
				)
			),
		);
	}
	// A directory of its own for anything not yet published.
	$drafts = fsn_navigator_files(
		array(
			'post_type'   => array( 'post', 'page' ),
			'post_status' => array( 'draft', 'pending', 'future', 'private' ),
		)
	);
	if ( $drafts ) {
		$posts['children'][] = array(
			'name'  => __( 'Drafts', 'fsn-navigator' ),
			'files' => $drafts,
		);
	}

	$media = array(
		'name'     => __( 'Media', 'fsn-navigator' ),
		'files'    => array(),
		'children' => array(),
	);
	$types = array(
		'image'       => __( 'Images', 'fsn-navigator' ),
		'video'       => __( 'Video', 'fsn-navigator' ),
		'audio'       => __( 'Audio', 'fsn-navigator' ),
		'application' => __( 'Documents', 'fsn-navigator' ),
	);
	foreach ( $types as $mime => $label ) {
		$files = fsn_navigator_files(
			array(
				'post_type'      => 'attachment',
				'post_status'    => 'inherit',
				'post_mime_type' => $mime,
			)
		);
		if ( $files ) {
			$media['children'][] = array(
				'name'  => $label,
				'files' => $files,
			);
		}
	}

	$root = array(
		'name'     => '/',
		'files'    => array(),
		'children' => array(
			$posts,
			array(
				'name'  => __( 'Pages', 'fsn-navigator' ),
				'files' => fsn_navigator_files( array( 'post_type' => 'page' ) ),
			),
			$media,
		),
	);

	return rest_ensure_response(
		array(
			'site' => get_bloginfo( 'name' ),
			'now'  => time(),
			'root' => $root,
		)
	);
}

/**
 * One directory's files, newest first, in the shape the view draws.
 *
 * @param array $query WP_Query arguments.
 * @return array[]
 */
function fsn_navigator_files( array $query ) {
	$query = wp_parse_args(
		$query,
		array(
			'post_status'            => 'publish',
			'posts_per_page'         => FSN_NAVIGATOR_MAX_PER_PEDESTAL,
			'orderby'                => 'modified',
			'order'                  => 'DESC',
			'no_found_rows'          => true,
			'update_post_term_cache' => false,
		)
	);
	$files = array();
	foreach ( get_posts( $query ) as $post ) {
		if ( ! current_user_can( 'edit_post', $post->ID ) ) {
			continue;
		}
		if ( 'attachment' === $post->post_type ) {
			$meta = wp_get_attachment_metadata( $post->ID );
			$size = isset( $meta['filesize'] ) ? (int) $meta['filesize'] : 0;
			if ( ! $size ) {
				$path = get_attached_file( $post->ID );
				$size = $path && file_exists( $path ) ? (int) filesize( $path ) : 0;
			}
			$unit = 'bytes';
		} else {
			$size = str_word_count( wp_strip_all_tags( strip_shortcodes( $post->post_content ) ) );
			$unit = 'words';
		}
		$title   = get_the_title( $post );
		$files[] = array(
			'id'       => $post->ID,
			'title'    => '' !== $title ? html_entity_decode( $title, ENT_QUOTES, get_bloginfo( 'charset' ) ) : __( '(no title)', 'fsn-navigator' ),
			'type'     => $post->post_type,
			'status'   => $post->post_status,
			'size'     => $size,
			'unit'     => $unit,
			'modified' => (int) get_post_modified_time( 'U', true, $post ),
			'edit'     => get_edit_post_link( $post->ID, 'raw' ),
			'view'     => 'attachment' === $post->post_type ? wp_get_attachment_url( $post->ID ) : get_permalink( $post ),
		);
	}
	return $files;
}
