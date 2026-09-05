# Reaction behavior

Source: pinned Blobatar 2.7.0 `src/animate.ts`, `idle.ts`, `motion.css`, `gaze.ts`, `morph.ts`, and `apps/site/src/components/Hero.tsx`.

## Pointer and click behavior

The original hero uses `animate="always"` and pointer gaze with travel **12 SVG units**. Clicking the face chooses a non-idle expression different from the one showing, holds it for **1500 ms from the click**, then restores the selected expression. Another click restarts the hold timer. Picking an expression cancels the temporary reaction. Core expressions themselves remain latched; the application owns this timer.

Hover lifts the avatar **1.5 SVG units** and scales it **1.04**. Entry takes **220 ms**, exit **160 ms**, with cubic-bezier(.23,1,.32,1). Ambient amplitude ramps over **400 ms ease-out**. Always mode pins amplitude to one while retaining the hover lift. Hover mode has ambient amplitude zero outside the target. Fine-pointer/hover capability gates pointer behavior; reduced motion retains the chosen static pose and removes movement and morphs.

Expression morphs take **300 ms** toward a non-idle pose, with cubic-bezier(.45,.05,.5,1); returning to idle takes **400 ms ease-in-out**. Interpolate pose channels and colors from the currently displayed frame. Applying expression transforms to already posed eye geometry applies the pose twice.

## Seeded idle motion

`web/motion.js` contains the upstream pure numerical motion functions with TypeScript annotations removed. These remain in SVG viewBox units; divide distances by 32 for this project's 3D coordinates and invert vertical direction.

- Breathe: **2800 ms alternate**, independently seeded phase. Peak x scale **1.022**, y scale **.982**.
- Bob: **3400 ms alternate**, independently seeded phase. Peak upward offset **1.1 units**.
- Blink: seeded period **3500–6500 ms**, seeded phase. Open for 97.2% of the cycle, close to **.08 eye-height scale** at 98.6%, reopen by 100%, using ease-in then ease-out.
- Saccades: seeded **4200–7600 ms** cycle and direction. Horizontal excursion magnitude **1–2.2 units**, vertical **.8–1.7 units**. Six held fixations joined by 1.5%-cycle flicks. Foreshortening accompanies the glances.
- Expression shake: **112 ms** linear loop, scaled by the expression's `shake` channel.
- Thinking rock: **900 ms** loop alternating the eye-height differential, scaled by the expression's `rock` channel.

Gaze suppresses idle saccades and their foreshortening while preserving breathing, bobbing, and blinking. Movement of the whole body alone does not reproduce this behavior.

## Gaze math

`project(mark,yaw,pitch)` projects each eye separately from its resting position on a sphere. Marks use fractions of the face's x/y radii. It clamps at radius **.97**, computes independent foreshortening, and preserves the authored eye lean. `yaw = travel / face.rx`; `pitch = travel / face.ry`. This is preferable to translating the eyes across a flat plane, which can detach them from the silhouette.

`pursuit(dt)` uses **110 ms** exponential settling. `step` snaps if target movement exceeds **1.6 excursion units**, otherwise smooths. The near-center deadzone uses smoothstep over **.55 times the rendered avatar radius**. In the browser driver, leaving the window returns the eyes to their resting state. Track pointer coordinates outside the avatar as well as inside it; the upstream hero follows the pointer across the page.

## Resolver contract

Resolved scenes retain their existing static `marks`, `layout`, and `transform`. New `motion` contains:

- `seeds`: exact upstream seeded timing values.
- `pose`: numeric expression channels.
- `baseLayout`: unposed body, face, and eye geometry.
- `baseMarks`: unposed drawing primitives.
- `baseColors`: unposed palette, before expression tint.

Build animated eyes from the base geometry, then compose pose, idle frame, and gaze. Material/shape/seed changes may rebuild geometry; an animation frame should transform existing objects rather than regenerate the scene.

## Verification

`core/motion.test.mjs` compares browser math against the vendored canonical upstream implementations across multiple seeds, times, amplitudes, gaze turns, and all fourteen expressions. It verifies blink boundaries and that adding the motion contract preserves static marks. These math checks do not replace browser verification of visible reactions and pointer tracking.

## Additional interaction reference: Bloub

Inspected [jeremy-prt/bloub](https://github.com/jeremy-prt/bloub) at `b4bb3c1b5f93c7b87a2e8d620f667c4093d97749` (MIT, copyright 2026 Jérémy Perret). Its engine separates gaze direction from expression eye shape, interpolates from the current gaze during interruptions, and suppresses autonomous wandering while tracking a pointer. Those patterns informed the interaction review; the avatar silhouettes, expression parameters and timing math remain Blobatar's.

The inspected revision has explicit drag handlers for timeline blocks. A direct avatar drag handler was not found in that checkout. The draggable 3D stage interaction is an addition requested by the user, with bounded movement and spring return; it does not change the saved avatar configuration or static Blender export.
