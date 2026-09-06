# SquishBots

An interactive 3D avatar studio built on [Blobatar by Alain](https://github.com/Alain00/blobatar), with interaction inspiration from [Bloub by Jérémy Perret](https://github.com/jeremy-prt/bloub).

Blobatar supplies seeded shapes, traits, palettes, expressions and motion mathematics. SquishBots translates that system into rounded 3D objects, with a fast browser preview and headless Blender renders. It keeps nine original shape families and adds Ghost and Monster; Sun and its four controls are omitted.

## Features

- Thirteen shape families, including Claude and Codex, with fourteen expressions and fine-tuning controls.
- Resin, clay, fur and glass finishes, applied to the body, eyes and presence decorations.
- Name-based generation, pinned traits, shape selection and tone pools, and locks for shuffling.
- Body and eye colors, automatic eye contrast, a transparent background.
- Pointer-following eyes, blinking, expression reactions, full rotation and a separate drag-to-play mode.
- Responsive React editor with shadcn/ui, Tailwind CSS, Phosphor icons and Satoshi typography. Neutral light and dark themes; dark is the default.
- Transparent or opaque PNG exports through Blender Cycles.
- Four-second GIF, MP4 and WebM recordings of the live preview.

## Run locally

Use Node.js 22.18 or later and npm.

```sh
npm install
npm run setup:fonts
npm run build
npm run dev
```

The font setup command downloads Satoshi directly from Fontshare for local use under its [ITF Free Font License](frontend/src/assets/fonts/FFL.txt). Font binaries are excluded from this repository.

Open [127.0.0.1:8879](http://127.0.0.1:8879). The server listens only on your computer. Set `PORT` to change its port.

For frontend development, run `npm run dev:ui` in another terminal while the API server runs. Vite proxies API and preview-module requests to port 8879. Rebuild with `npm run build` to update the editor served by the Node server.

Install [Blender](https://www.blender.org/download/) to render PNGs. Blender 4.5.9 LTS was used during development. The app searches PATH and the standard macOS installation; use `BLENDER_BIN` for another executable location. Install [FFmpeg](https://ffmpeg.org/download.html) for GIF and MP4 conversion, or set `FFMPEG_BIN`. WebM recording needs browser support for MediaRecorder.

```sh
BLENDER_BIN="/path/to/blender" FFMPEG_BIN="/path/to/ffmpeg" npm run dev
```

## Render from JSON

The CLI uses the same configuration and resolver as the editor:

```sh
npm run render -- configs/material-resin.json renders/avatar.png
npm run render -- configs/material-clay.json renders/clay.png
npm run render -- configs/material-fur.json renders/fur.png
```

Set `material.preset` to `glass` in a copied config to render glass. Each run saves a PNG, an editable Blender scene, resolved JSON, render metadata and the original 2D SVG reference. Append `--studio` for an opaque floor with reflections and a contact shadow. See [renderer/README.md](renderer/README.md) for the configuration contract.

The web editor stores settings for the current browser session. It exposes visual controls and export actions; JSON configuration is available through the CLI and local API. Animated exports record the browser renderer. PNG exports use Blender, with web requests capped at 2048 pixels and 256 samples.

## Development

```sh
npm run typecheck
npm run build
npm test
npm run test:api
```

Core tests cover upstream geometry and motion parity, deterministic configuration, material validation and eye contrast. The API suite requires Blender and performs a real headless render.

- `frontend/`: React configurator, shared shadcn components and styles.
- `core/`: configuration validation, catalog and pinned Blobatar source.
- `web/`: Three.js preview, geometry, motion and animation recording modules.
- `server/`: local HTTP API, Blender queue and FFmpeg conversion.
- `renderer/`: procedural Blender Python scene construction.
- `configs/`: reproducible sample inputs.

See [architecture](docs/web-architecture.md), [upstream feature audit](docs/reference-audit.md) and [reaction behavior](docs/reactions.md).

## Rendering limits

Bodies are closed volumetric inflations of the original silhouettes, with full backs and size-dependent depth. When a composite outline cannot be inflated as one radial volume, the renderer inflates its parts separately to preserve gaps. Overlapping parts can show seams. The preview and Blender use different rendering engines and fiber implementations, so their pixels differ. Reproduce a final render with the same config, Blender version, device and render settings.

The server is designed for local use. Its job queue lives in memory, and generated artifacts live on disk. Public multi-user hosting would need a separate deployment design.

## License and credits

SquishBots code is available under the [MIT license](LICENSE), copyright © 2026 Kishore Sundarajan. Third-party contributions retain their licenses. Blobatar's vendored source remains copyright © 2026 Alain. Satoshi uses Indian Type Foundry's separate font license.

Read [CREDITS.md](CREDITS.md) for source versions, attribution and retained notices. The upstream authors do not endorse this project.

## Deploy on Vercel

Import this repository with the Vite preset and repository root `./`. `vercel.json` sets the build command and `web-dist` output directory automatically. No environment variables are required.

The hosted build ships the Three.js assets and uses stateless Node functions for the catalog and configuration resolver. PNGs come from the browser's 3D renderer, including transparent export at the selected resolution. GIFs are encoded in the browser. WebM and MP4 use MediaRecorder; MP4 appears only in browsers that support it. Blender PNG rendering and server-side FFmpeg conversion remain available in local mode.

To reproduce the hosted build locally, run `npm run setup:fonts` followed by `node tools/build-hosted.mjs`. The API functions are in `api/`; the normal local server can also serve this build for browser verification.
