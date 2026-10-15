# FSN for OpenStation

The IRIX desktop from the Jurassic Park control room, for [WordPress OpenStation](https://github.com/WordPress/openstation).

**Try it live: https://wp-os-fsn.space.fast**. WordPress runs in your browser, with nothing to install.

- **`theme/`**: the FSN desktop theme. Lilac-grey Motif bevels, a rose title bar, fsn-style pedestal icons and the 3D File System Navigator landscape as the wallpaper.
- **`plugin/fsn-navigator/`**: the FSN Navigator plugin. It adds an **fsn** window that draws your site as an information landscape you can fly over: categories, pages and media are pedestals, and every post, page or file is a block whose height is its size and whose colour is its age. Works with any OpenStation theme.
- **`demo/`**: the Playground demo hosted on Spacefast.

## Download

Every push builds both ZIPs; tagged versions attach them to a [release](../../releases/latest).

- Theme: upload `fsn-theme.zip` in OpenStation under **Preferences > Themes**, then apply its recommended layout.
- Plugin: upload `fsn-navigator.zip` under **Plugins > Add New > Upload Plugin**.

Both need an OpenStation version newer than 1.1.12.

## Build

With Node 20 or newer:

```bash
bin/build.sh   # theme assets from theme/src/, then dist/fsn-theme.zip and dist/fsn-navigator.zip
bin/demo.sh    # also assembles demo/; then publish with: sf publish demo
```

`plugin/dev/harness.html` runs the fsn view on fake data, outside WordPress: serve `plugin/` over HTTP and open it.

## Credits

The theme's token set and build approach started from Miguel Torres's [Retro 95](https://github.com/mmtr/wp-os-retro-95). The plugin bundles [three.js](https://threejs.org) (MIT).

## License

GPL-2.0-or-later, see `LICENSE.txt`.
