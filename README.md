# FSN for OpenStation

The IRIX desktop from the Jurassic Park control room, for [WordPress OpenStation](https://github.com/WordPress/openstation).

**Try it live: https://wp-os-fsn.space.fast**. WordPress runs in your browser, with nothing to install.

https://github.com/user-attachments/assets/173e2b0d-3e6a-46ff-b927-ca2fe9f7c38e

- **`theme/`**: the FSN desktop theme. Lilac-grey Motif bevels, a rose title bar, fsn-style pedestal icons and a woven IRIX desk, with the 3D File System Navigator landscape as an optional wallpaper.
- **`plugin/fsn-navigator/`**: the FSN Navigator plugin. It adds an **fsn** window that draws your site as an information landscape you can fly over: categories, pages and media are pedestals, and every post, page or file is a block whose height is its size and whose colour is its age. Works with any OpenStation theme.
- **`demo/`**: the Playground demo hosted on Spacefast.

## Reading the landscape

The fsn window lays your site out as a tree that recedes into the distance. `/` sits at the front; behind it are **Posts**, **Pages** and **Media**; behind those, a pedestal for each of your 12 largest categories, one for **Drafts**, and one for each kind of media (Images, Video, Audio, Documents). Wires on the ground join each pedestal to its parent.

Each block on a pedestal is one post, page or file.

**Height is size.** Posts and pages are measured in words, media files in bytes. The scale is logarithmic, so a 5,000-word post stands not quite twice as tall as a 100-word one, rather than fifty times taller, and a short note is still a visible stub. Within a pedestal the shortest blocks stand at the front, so none hides behind a taller one.

**Colour is age**, measured from when the item was last modified, newest to oldest, the way fsn coloured files:

| Colour | Last modified |
|---|---|
| Red | in the last day |
| Orange | in the last week |
| Yellow | in the last month |
| Green | in the last three months |
| Teal | in the last year |
| Blue | in the last three years |
| Violet | more than three years ago |

The same ramp sits in the window's control panel as a reminder.

**See-through blocks** are drafts, or posts that are pending, scheduled or private.

**Pedestals** rise a little with the total size of everything on them. Each shows its 120 most recently modified items at most.

Hover over a block to see its title, and click it to put it under the spotlight: the panel at the bottom shows its exact size and age. Double-click, or press **Open**, to edit it in a window. Click a pedestal to fly to it; drag to look around, scroll to move in and out, and use **Home**, **Up** and **Overview** to find your way back.

## Download

Every push builds both ZIPs; tagged versions attach them to a [release](../../releases/latest).

- Theme: upload `fsn-theme.zip` in OpenStation under **Preferences > Themes**, then apply its recommended layout.
- Plugin: upload `fsn-navigator.zip` under **Plugins > Add New > Upload Plugin**.

Both need an OpenStation version newer than 1.1.12.

## Build

With Node 20 or newer:

```bash
bin/build.sh          # theme assets from theme/src/, then dist/fsn-theme.zip and dist/fsn-navigator.zip
bin/demo.sh           # also assembles the demo site in dist/demo/
bin/publish-demo.sh   # builds the demo and publishes it to Spacefast
```

`plugin/dev/harness.html` runs the fsn view on fake data, outside WordPress: serve `plugin/` over HTTP and open it.

## Credits

The theme's token set and build approach started from Miguel Torres's [Retro 95](https://github.com/mmtr/wp-os-retro-95). The plugin bundles [three.js](https://threejs.org) (MIT).

## License

GPL-2.0-or-later, see `LICENSE.txt`.
