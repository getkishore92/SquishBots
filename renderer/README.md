# Blender renderer

The renderer builds meshes, materials, fibers, lighting and a camera through Blender's Python API. Cycles renders the final PNG. It needs Blender's bundled Python and no additional Python packages.

From the repository root:

```sh
npm run render -- configs/material-resin.json renders/avatar.png
```

Set `BLENDER_BIN` to the Blender executable if it is outside PATH or the standard macOS application location. Blender 4.5.9 LTS was used during development.

The CLI resolves the source configuration, writes an original 2D SVG reference, then invokes Blender without a shell. The default output is an orthographic transparent RGBA portrait. Append `--studio` for an opaque charcoal floor and contact shadow. Outputs include `.png`, `.blend`, `.resolved.json`, `.reference.svg` and `.metadata.json`.

To call the resolver and Blender separately:

```sh
mkdir -p renders
node core/resolve.mjs configs/material-resin.json renders/avatar.resolved.json
blender --background --python-exit-code 2 --python renderer/render.py -- renders/avatar.resolved.json renders/avatar.png
```

## Configuration

`material.preset` accepts exactly `resin`, `clay`, `fur` or `glass`.

| Property | Bounds | Resin | Clay | Fur | Glass |
| --- | --- | --- | --- | --- | --- |
| roughness | 0–1 | 0.22 | 0.78 | 0.75 | 0.06 |
| textureScale | 0.1–100 | 24 | 35 | 30 | 24 |
| textureStrength | 0–1 | 0 | 0.045 | 0.1 | 0 |
| furLength | 0.001–0.3 | — | — | 0.075 | — |
| furDensity | 100–50,000 integer | — | — | 12,000 | — |

Texture controls adjust procedural noise and bump. Fur length is measured in Blender scene units; the body is approximately two units wide. Fur density sets the candidate strand count. Deterministic short fibers cover the eyes and presence decorations, with clearance around the eyes to preserve readability. Badge numerals retain a contrasting solid finish. Glass uses transmission and an IOR of 1.45.

The `render` object supports `transparent`, `resolution`, `samples` and optional `depth`. Default depth follows the smaller source body radius: `0.95 * min(body.rx, body.ry) / 32`. An explicit depth takes precedence. The editor's PNG request limit is 2048 pixels and 256 samples; the CLI supports the resolver's wider validated limits.

## Geometry translation

The JavaScript resolver uses pinned Blobatar 2.7.0 code for hashing, sparse traits, expressions, colors and exact 2D paths. Python samples those paths and inflates their union around the source body center. The face softens angular variation toward its center; the equator preserves the sampled outline. Both sides close to form a volume. Eyes follow the front surface and retain the original shapes, placement, lean and expression asymmetry.

Status spheres, unread badges, thinking dots and source background shapes are separate scene objects. The renderer applies the expression body transform and resolved expression colors.

Radial inflation checks whether the source union is star-shaped around its center. When a composite outline has unsupported gaps, the renderer inflates source parts separately around their own centers. This preserves gaps instead of filling them, but overlapping parts can show seams.

The current catalog has thirteen shape families. Ghost and Monster are SquishBots additions built from continuous source paths with the original eye and expression model. Sun is omitted from the catalog and automatic shape selection.

## Reproducibility

The resolver produces deterministic geometry and a configuration hash. Scene construction and strand placement use deterministic sampling. Render metadata records the Blender version, engine, render seed, configuration hash, material settings and image dimensions.

Use the same Blender version, device and settings when comparing repeat renders. PNG byte hashes can differ because of embedded metadata; compare decoded pixels when checking image identity. Cross-version and cross-device pixel identity is not guaranteed.

Claude and Codex use shallow bevelled parts. Fur eyes are raised black spheres with expression scaling and no shaved coat behind them. Codex uses a dark screen with extruded terminal marks.
