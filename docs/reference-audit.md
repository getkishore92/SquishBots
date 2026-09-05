# Blobatar reference audit

This document records the original upstream project. The current SquishBots catalog differs by request: Sun and its four traits are removed, Ghost and Monster are added, leaving eleven shape families and 44 exposed traits. See the root README for current product behavior.
Audited 2026-09-06 against [Alain00/blobatar](https://github.com/Alain00/blobatar), commit `ebb7ea4808b1263629fc8fa65e2398b9cbdb6f6b`, package version **2.7.0**. Source paths below are relative to that repository. The checked-out source is the authority; older ADRs still describe six shapes or a removed character variant.

## Functional contract

A seed string and sparse normalized trait overrides produce a deterministic avatar. Blobatar 2 has **ten silhouettes, two eyes, six tone bands, and fourteen expression values including idle**. It has no mouth, brows, hair, glasses, or arbitrary wearable accessory catalog. Preserve this vocabulary rather than adding a character builder.

`packages/blobatar/src/render.ts` defines the public options: `size`, `background`, `palette`, `hue`, `tone`, `traits`, `normalize`, `contrast`, `title`, `animate`, and `expression`. `palette` can override `bg`, `head`, and `eye` independently. Explicit hue is in degrees; the hue trait is a normalized position. Explicit hue and tone override the matching traits. Explicit palette entries override the derived palette and bypass its contrast guarantee.

The native background defaults to transparent. Supported values are `false`, `true`, `square`, `circle`, and `squircle`. `true` uses the same superellipse as squircle. Background geometry sits outside expression transforms. A 3D studio floor and lighting are renderer additions, separate from this backdrop option.

### Determinism

`hash.ts` normalizes seeds using NFC, trim, then lowercase by default. Normalization can be disabled. It hashes UTF-8 bytes with uint32 mixing, seeded by the JavaScript string length (UTF-16 code units), then derives every trait independently using its string key and a separator. A Python port must preserve UTF-16 length for non-BMP seeds; retaining the original TypeScript resolver avoids this failure.

`traits.ts` accepts `Record<string, number | number[]>`:

- Missing key: derive from the seed.
- Number: pin one normalized position.
- Nonempty array: choose one listed position using that key's own seeded stream.
- Empty array: behave as an omitted key.
- Values clamp to 0 through 0.999999. Exactly 1 becomes 0.999999; NaN becomes 0 in the library, though JSON cannot represent NaN.

`num` maps into a half-open numeric range. `int` maps into an inclusive integer range. `jitter` maps symmetrically around zero. Shape thresholds, numeric ranges, tone bands, and ordered choices are frozen within the upstream major. Reproducibility therefore requires both the input config and a pinned upstream revision plus renderer version.

## Shape vocabulary

Sources: `styles/blob.ts`, `styles/shapes.ts`, `apps/site/src/shapes.ts`.

| Shape | Trait band | Picker position | Geometry |
|---|---|---:|---|
| round | [0, .22) | .11 | Superellipse |
| organic | [.22, .48) | .35 | Closed spline with 6–8 radial points |
| boxy | [.48, .60) | .54 | Squared superellipse, tilted |
| capsule | [.60, .70) | .65 | Rectangle union two semicircular ends |
| nub | [.70, .79) | .745 | Superellipse union 1–2 circular nubs |
| cloud | [.79, .86) | .825 | Organic body union 4–6 upper lobes |
| droplet | [.86, .915) | .888 | Ellipse union tangent tapered apex |
| hexagon | [.915, .95) | .933 | Rounded six-sided polygon |
| sun | [.95, .98) | .965 | Superellipse union 6–9 radial petals |
| triangle | [.98, 1) | .99 | Rounded three-sided polygon |

Decorations belong to the silhouette. They use the body color. For the 3D translation, union their projected outlines before inflation, so clouds/nubs/suns remain continuous bodies with the reference contour. Separate stacked spheres produce a different silhouette and seam treatment.

## Complete trait inventory

Source: `packages/blobatar/test/keys.ts` (48 keys); ranges in `styles/compose.ts` and `styles/shapes.ts`. All positions below are input fractions, not world-space measurements.

| Family | Keys and resolved meaning |
|---|---|
| Selection/color | `shape`; `hue` → 0–360°; `tone` → one of six palettes |
| Body | `body.r` → 31–38 times shape core scale; `body.ratio` → .92–1.08; `body.x`, `body.y` → ±1.5 around (50,50); `body.n` → 1.9–2.5, or 3.4–6 for boxy; `body.rot` → ±20° boxy, ±12° hexagon, ±5° triangle |
| Organic contour | `body.pts` → 6–8; `body.r0` through `body.r7` → radial multiplier 1 ± .16; only selected point count is used |
| Eyes | `eye.rx` → .075–.105 times body radius; `eye.ratio` → 1.9–3.2; `eye.n` → 3.5–6; `eye.gap` → .10–.24 times body radius |
| Eye asymmetry | `eye.scale` → .78–1.24; `eye.stretch` → .85–1.18; `eye.dy` → ±.04 face radius; `eye.lean2` → ±3.5° relative to first lean, clamped to ±12° |
| Face direction | `gaze.x` → ±.09 face horizontal radius; `gaze.y` → -.20–.08 face vertical radius; `eye.lean` → -1–1 times containment-derived angle bound |
| Sun | `sun.n` → 6–9; `sun.dist` → 1–1.08 body radius; `sun.r` → .20–.26 body radius; `sun.rot` → 0–2π |
| Cloud | `cloud.n` → 4–6; `cloud.r0` through `cloud.r5` → .44–.62 body radius |
| Nub | `nub.n` → 1–2; `nub.a0`, `nub.a1` → 0–2π; `nub.r0`, `nub.r1` → .24–.40 body radius |
| Other shape controls | `poly.round` → .24–.50; `capsule.squat` → .55–.68; `droplet.tip` → 1.40–1.65 |

Eyes fit as a group inside each shape's authored face region. Extreme sliders can resolve below their requested dimensions. Preserve the existing fit calculation instead of independently placing eyes on a generic sphere.

Tone picker positions: pastel .10, pale .28, mid .49, deep .71, bright .865, ink .965. Actual upper band edges are .20, .36, .62, .80, .93, 1.0. Palettes use authored OKLCh lightness/chroma and derived sRGB hex values. The library enforces eye/body contrast of 4.5 and body/background contrast of 1.25 before explicit overrides. These are flat-color guarantees; specular lighting can change perceived rendered contrast.

## Expressions and motion

Source: `expression.ts`, `morph.ts`, `animate.ts`, `gaze.ts`.

Supported expression values: **idle, happy, sad, mad, surprised, wink, sleepy, smug, unsure, scared, love, shy, sick, thinking**. Upstream passes imported expression objects rather than strings; a JSON adapter may name these objects using a fixed allowlist. Expressions deform the existing eyes, move the body, and sometimes tint its colors. They add no mouth or extra face marks. Static geometry includes the expression's initial pose. The body wrapper translation returned by `_marks` must be applied separately; `_layout` alone omits that wrapper.

Animation is opt-in `hover` or `always` for framework adapters and is independent of expression selection. The string SVG renderer is static. Idle motion includes breathing, bobbing, and blinking; some expressions add shake or rocking. Gaze tracking is also a separate interactive capability. None of these requires random changes to the saved config. A final still render freezes a defined pose/time; animation export is outside the current editor's export behavior.

## Existing editor behavior

Sources: `apps/site/src/Editor.tsx`, `editor/axes.ts`, `editor/resolved.ts`, `editor/snippet.ts`, `components/editor/export.tsx`.

The editor exposes a curated subset of the full trait keyspace. Each slider writes one key, rounded to three decimals at the point of pinning. Sliders show seeded values while unpinned. A lock pins the current rounded value; unlock removes the key. Shape and tone support multi-selection, represented as trait arrays in picker order. No selection removes the key; one selection becomes a scalar. Conditional controls appear only for currently relevant shapes, or the union of explicitly narrowed shapes. Integer controls have meaningful detents.

Shuffle changes the seed and preserves pinned traits. It chooses from example names with optional two-digit suffixes; it does not roll each unpinned key independently. Reset/unpin removes constraints. Seven additional seeded avatars preview the same constraints alongside the main avatar. Snippet generation supports framework/string/HTTP integration; the exported settings reproduce the preview.

Exports are static SVG with a scalable viewBox or PNG at **512 × 512**. Native exports are transparent by default, ignore preview motion, and contain no recoverable seed/config metadata. A JSON download in the rebuild improves reproducibility without replacing the native config model. A Blender result is raster output, so keep any SVG export clearly labeled as the exact 2D reference rather than implying a vector 3D render.

## Presence composition from the visual reference

Source: `apps/site/registry/presence-avatar.tsx`.

This component wraps the generator with `state: online | away | offline | thinking` and optional `unread`. Online/away/offline use green/amber/gray dots. Thinking uses three dots and the thinking expression, with no presence dot. Unread zero or missing is hidden; counts over 99 display `99+` while accessible text keeps the actual count. Presence and unread can coexist, including thinking plus unread. These are product decorations outside the seeded shape, and belong in a separate optional config object. The supplied image asks for their 3D treatment; it does not introduce a general accessories inventory.

## Recommended JSON boundary

Keep the upstream options together and add renderer-specific options separately. Names below are a proposed boundary; the implementation's validated schema is authoritative.

```json
{
  "schemaVersion": 1,
  "seed": "alain00",
  "traits": {"shape": [0.11, 0.99], "eye.gap": 0.5},
  "options": {"normalize": true, "contrast": true, "background": false},
  "expression": "idle",
  "presence": {"state": "online", "unread": 3},
  "render": {"transparent": true, "resolution": 512, "samples": 64}
}
```

The resolver should call the pinned original TypeScript `_marks` and `_layout`, supply JSON-safe expression values, and produce exact paths, circles, eye geometry, palette, backdrop, and body transform for Blender. Keep original config in the resolved document. The headless Python renderer owns tessellation/inflation, thickness, materials, lighting, camera, output alpha, and render settings. Hash canonical config plus source/renderer versions for cache identity. Do not hash transient UI state.

## Representative visual review matrix

This is the required comparison matrix, not a claim that these renders have passed review.

| Coverage | Config cases | Review criterion |
|---|---|---|
| All silhouettes | All ten shape midpoint pins, common seed | Front outline agrees with exact upstream SVG; decorations remain part of the body |
| Main visual direction | Cyan round, purple organic, green triangle, coral round, lavender triangle | Glossy resin, broad studio highlights, soft shadows; personality retained |
| Eye extremes | Eye size/gap/ratio at 0 and .999; asymmetric eye scale/stretch/dy extremes | Correct reference proportions, eyes stay attached and inside silhouette |
| Expression set | All fourteen expressions on round and triangle | Exact baked eye pose and tint; no invented mouth or brows |
| Contour extremes | Organic radial/point controls, polygon roundness, capsule squat, droplet apex | Smooth inflated surfaces without outline flattening or mesh holes |
| Decorations | Nub 1/2, cloud 4/6, sun 6/9 | Fused body joins; no accidental detached parts |
| Palette | Six tones, head/eye overrides | Faithful base color, visible eyes, highlights do not wash out expression |
| Presence | Online, away, offline, thinking, unread 0/3/128 | Correct sphere/three-dot composition; badge uses 99+ for 128 |
| Export | Transparent PNG, studio PNG, 512 and larger resolution | Actual alpha channel, no clipped accessories, deterministic rerender from saved JSON |
| Deterministic inputs | Whitespace/case/NFC equivalents, normalize false, emoji seeds, array traits | Equivalent inputs resolve identically; pinned traits survive shuffle |

## License and attribution

The repository uses **MIT**, copyright © 2026 Alain. Copying and adapting source is permitted. Include the full copyright and permission notice with copied or substantial portions, including vendored generator code. Record the upstream URL and pinned commit. Preserve third-party license attribution in the delivered project. This audit does not claim trademark clearance or imply upstream endorsement.
