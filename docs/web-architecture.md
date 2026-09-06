# Application architecture

SquishBots has one configuration resolver, a React configurator, a Three.js preview and a local headless Blender render queue. The resolver vendors Blobatar 2.7.0 at commit `ebb7ea4808b1263629fc8fa65e2398b9cbdb6f6b`; upstream trait and motion semantics remain separate from the 3D material and interaction extensions. Local shape additions are in `core/vendor/blobatar/styles/shapes.ts`, with selection bands in `styles/blob.ts`. The pinned commit identifies the upstream baseline; these files contain documented local changes. The current shape catalog has thirteen families, including Ghost, Monster, Claude and Codex. Sun and its four trait controls are removed.

## Configuration

```json
{
  "seed": "Milo Clover",
  "options": {
    "traits": {"shape": 0.11, "eye.gap": 0.7},
    "palette": {"head": "#06C5D8"},
    "background": false,
    "expression": "idle"
  },
  "material": {"preset": "resin", "roughness": 0.22},
  "status": "none",
  "badge": 0,
  "render": {"transparent": true, "resolution": 768, "samples": 64}
}
```

`seed` maps to Blobatar's name. `options` retains source trait, palette, hue, tone, normalization, contrast and expression settings. JSON stores expressions by name; the resolver maps each name to the source expression object. `status` and `badge` control presence decorations. Renderer-specific settings live under `material` and `render`.

A missing trait uses the seed, a number pins its normalized value, and an array narrows it to seed-selected alternatives. An empty array behaves as missing. The catalog exposes trait keys through curated and advanced controls. Shape and tone pools preserve ordered alternatives. Slider edits use three decimal places.

Shuffle chooses another name and preserves pinned traits. Unlocked material, color, expression and presence settings also change; their locks preserve them. Explicit eye colors remain manual. Without an eye override, custom body colors receive a contrasting light or dark eye color. Material presets are resin, clay, fur and glass; their current defaults come from the resolver catalog rather than a separate geometry vocabulary.

## Resolver and renderers

`core/resolve.mjs` validates configuration, calls the pinned source `_layout` and `_marks`, and returns resolved geometry, colors, expression transforms, material defaults and a hash. The final two source marks represent eyes. The source body wrapper transform is retained.

The `motion` payload supplies unposed base geometry, colors, seeded timing and numeric expression channels. `web/motion.js` ports the original pure numerical functions. The browser composes expression, idle and gaze changes using those base values, avoiding a second application of the static expression pose.

`web/geometry.js` creates closed volumes from source contours. `web/preview.js` builds the Three.js scene, materials, eyes, fibers and presence decorations. It also handles pointer tracking, rotation and Play-mode drag reactions. These interactions affect the live scene; static Blender export resolves the saved config.

`renderer/render.py` builds the final scene from resolved JSON. Blender Cycles is the final PNG renderer. Browser and Blender materials share configuration, while their rendering engines and fiber construction differ.

Configuration hashes identify resolved input, including material settings and the pinned upstream version. Repeated configuration produces the same resolved geometry. Exact image identity also depends on Blender version, device and render settings.

## React editor

`frontend/src/App.jsx` contains the configurator. `studio.js` handles session state and shuffle helpers; `use-studio-preview.js` coordinates resolution, preview controllers, logo generation. shadcn/ui components use Tailwind CSS, Phosphor icons and a neutral light/dark theme. Satoshi is downloaded directly from Fontshare during local setup and bundled into the user's build.

The frontend debounces configuration requests and discards stale responses. Picker thumbnails are bundled static PNGs: neutral spheres for materials, neutral faces for expressions, and fixed silhouettes for shapes. Avatar edits update selection highlights without regenerating these images.

Session storage retains configuration, locks, pools, interaction mode, motion and gaze. Local storage retains the theme. Mobile uses a large preview, four customization tabs, collapsed fine-tuning and an export bottom sheet; desktop shows a scrollable inspector alongside the stage. The header links to GitHub for starring the project. Legacy backdrop settings are normalized to false. Cloud uses a continuous eight-lobe outline. Happy uses open eyes with separate raised brow marks in both renderers. The browser schedules occasional blinks independently of hover motion, with reduced-motion and static-capture suppression. JSON panels, an iframe widget and a crowd view are not part of the current editor.

## Local server and export

`server/server.mjs` serves the Vite production build plus separately loaded preview modules, Three.js dependencies and generated artifacts. `npm run dev:ui` runs Vite with local API proxies during development.

The API exposes `/api/catalog`, `/api/resolve`, `/api/render` and `/api/jobs/:id`. A final render snapshots configuration and enters a serial Blender queue. The server starts Blender with an argument array, validates requests and limits web image size and sample counts. Completed jobs expose PNG, Blender scene and reproduction-input URLs. Queue state lives in memory; artifacts remain on disk.

`web/animation-export.js` records four seconds of the live canvas. WebM downloads directly. GIF and MP4 send the recording to `server/animation.mjs` for bounded FFmpeg conversion. Animated exports use an opaque background and browser rendering.

The server binds to 127.0.0.1 and is intended for local use. A public multi-user service would need durable workers, storage, authentication, quotas and a deployment-specific review.

## Checks

`npm test` checks source geometry, sparse traits, narrowing, expressions, motion math, hashing, material bounds and eye contrast. `npm run typecheck` and `npm run build` check the frontend. `npm run test:api` performs API checks and a real Blender render. Browser interaction and visual review remain separate from these code checks.

Fur uses dense, tapered strand ribbons in the browser, with root-to-tip shading and downward combing. Blender uses tapered curves with the same longer, curved grooming direction. New sessions start in Play mode. Press R outside text fields and popups to shuffle all unlocked settings.

Claude and Codex use shallow bevelled component meshes, preserving separate arms and feet. Codex has a raised dark screen with terminal-shaped eyes. Fur uses raised round black eyes; the coat is continuous behind them and eye squashing preserves blinks and expressions. `web/fur-eyes.js` is bundled into hosted deployments alongside the preview module.
