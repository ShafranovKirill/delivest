# Demo menu preset

This is the current standard test menu for local Delivest instances: 5 categories, 30 products, and 6 banners. Product and banner images are optimized WebP assets committed with this preset. The product images use the server's 800 px, Q80 thumbnail pipeline; banners use its 1600 px, Q80 pipeline. Transparency is retained. The original PNG files are not needed.

Run this after creating and migrating a **local** database, configuring its local S3 bucket, and seeding at least one active branch and staff account. From the repository root:

```bash
make demo-menu
```

Or from `server/`:

```bash
MIX_ENV=dev mix run ../examples/demo-menu/apply.exs
```

By default the target branch slugs are `demo-center,demo-north,demo-south`. To apply it to an existing local branch, set `DEMO_MENU_BRANCH_SLUGS=your-branch-slug`. The script refuses nonlocal DB or S3 hosts and production Mix environments. It creates or updates the fixture records by fixed IDs, uploads the WebP assets to the configured local public bucket, and links the menu only to the chosen branches. It removes those branches' other category, product, and banner links without deleting their records. Running it again does not create duplicate records or links. If Phoenix is already running, restart it after applying the preset so its in-memory banner cache reloads the new WebP URLs; the menu itself refreshes through catalog versions.

Before changing the links, each run writes a JSON backup path to stdout. It contains the target branches' previous menu relations, catalog versions, media metadata, and IDs of fixture records that already existed. Keep that file if you need to restore the previous preview. This preset does not provision a franchise, staff account, or branch; the existing generic `make menu` and `make stocks` seeds remain available for legacy examples.
