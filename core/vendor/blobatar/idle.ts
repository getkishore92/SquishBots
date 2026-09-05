/**
 * The idle layer, evaluated rather than declared. See `docs/motion-spec.md`.
 *
 * `motion.css` is the original and stays the original: on the web the browser
 * runs these loops off a stylesheet and nothing in TypeScript is involved. This
 * file is the same seven animations written as arithmetic, for React Native,
 * which has no stylesheet, no custom properties and no `@keyframes`.
 *
 * ## The whole idle layer is a pure function of time
 *
 * That is the property everything here rests on, and it is worth stating
 * because it is not obvious from the CSS. Every loop is `infinite`, none of
 * them has a start event, none reacts to anything, and the only inputs are the
 * seeded timings, the amplitude, and two pose channels. So there is no state to
 * keep, nothing to start or stop, and no drift to correct: given a clock,
 * `idleAt` says what the blobatar looks like, and two blobatars that agree
 * about the clock agree about everything.
 *
 * It is also what makes this testable without a device. `scripts/probe-idle.ts`
 * runs the real stylesheet in headless Chrome, freezes it at sampled times, and
 * compares the matrices the browser computed against what this returns. That is
 * the only honest oracle for a port of a stylesheet, and it is the same
 * instrument `probe-compose.ts` already uses for the pose.
 *
 * ## What amplitude means here
 *
 * On the web `--mo-amp` ramps 0 to 1 on hover, and is pinned to 1 by
 * `animate="always"`. There is no hover on a touch screen, and `motion.css`
 * already says so itself: under `@media not ((hover: hover) and (pointer:
 * fine))` every loop is paused and amplitude forced to 0 unless the blobatar is
 * `mo-always`. So the only mode this platform has is the always one, and
 * amplitude is a plain 0-to-1 the caller ramps rather than a hover state.
 *
 * ## What is not here
 *
 * The hover lift, which is `.mo-root:hover`'s `translateY(-1.5px) scale(1.04)`,
 * because it is a pointer response and there is no pointer. `--mo-rate`, the
 * slow-motion debugging dial, because it is a stylesheet class for a person
 * looking at a page. Both are the web's, and neither has a meaning to port.
 */

import { motionSeeds, type IdleSeeds } from "./animate.ts";
import { EASE_IN, EASE_IN_OUT, EASE_OUT } from "./ease.ts";
import { poseTransforms, r3, type Posable, type Pose } from "./morph.ts";
import { traits, type TraitOverrides } from "./traits.ts";

export type { IdleSeeds };

/**
 * This blobatar's idle timings, from its name.
 *
 * The sibling of the `--mo-*` custom properties `_parts` emits, for a renderer
 * with no stylesheet to read them. Same traits, same draws, same crowd: a
 * blobatar breathes on the same offset on both platforms, which is the only
 * thing that makes the two the same creature in motion rather than two
 * creatures that look alike.
 *
 * It reads `traits` directly rather than going through the renderer's
 * `resolve`, and the two option names below are the whole of what `resolve`
 * does before the palette work this has no use for. Reaching through the
 * renderer would put a copy of it in `dist/idle.js`, since core's entries are
 * standalone bundles.
 */
export function idleSeeds(
  name: string,
  opts: { normalize?: boolean; traits?: TraitOverrides } = {},
): IdleSeeds {
  return motionSeeds(traits(name, opts.normalize ?? true, opts.traits));
}

/**
 * One frame of the idle layer, as the numbers each nesting level needs.
 *
 * The shape mirrors `motion.css`'s element structure rather than its list of
 * `@keyframes`, because that is what a renderer has to build: root, breathe,
 * bob, the eye pair, each eye, each eye's own path. A field here is one level
 * there, and `idleTransforms` is the mapping.
 */
export interface IdleFrame {
  /** `mo-shake`, the tremor, in viewBox units. Rides `shake`, not amplitude. */
  shake: [number, number];
  /** `mo-breathe`, a non-uniform scale about the viewBox centre. */
  breathe: [number, number];
  /** `mo-bob`, vertical, in viewBox units. Negative is up. */
  bob: number;
  /** `mo-saccade`, the eye pair's glance, in viewBox units. */
  saccade: [number, number];
  /**
   * `mo-rock`'s phase, +1 to -1, which is the seesaw `thinking` rides.
   *
   * A phase and not a position: it is read by the pose composition, where
   * `rock` decides how much of `edy2` it is allowed to move. At +1 the pair
   * sits exactly where `bakePose` puts it, which is why the static render of
   * `thinking` is frame zero of this loop rather than an approximation of it.
   */
  rockp: number;
  /** `mo-blink`, a scaleY on each eye's own path, in its own leaned frame. */
  blink: number;
  /**
   * `mo-wrap`, the saccade's foreshortening, as coefficients rather than as a
   * finished scale.
   *
   * The horizontal term and the rotation both depend on which eye they are
   * being applied to, exactly as the pose's differentials do, so they are
   * returned unresolved and the composition multiplies in the per-eye sign.
   * `sx` is `1 + mx + side * (which eye this is)`.
   */
  wrap: { mx: number; side: number; sy: number; rot: number };
}

/**
 * Progress through one iteration of a looping animation, in [0, 1).
 *
 * `phase` is how far into the cycle this blobatar starts, which is a positive
 * number here and a negative `animation-delay` in the stylesheet. See
 * `motionSeeds`.
 */
const cycle = (t: number, phase: number, period: number) => {
  const u = (t + phase) / period;
  return u - Math.floor(u);
};

/**
 * The same, for `animation-direction: alternate`, where every other iteration
 * runs backwards.
 *
 * The reversal happens *before* the timing function, which is what the CSS
 * specification says and what makes an alternating ease-in-out symmetric. Doing
 * it after would ease into one end of the travel and snap out of the other.
 */
const alternate = (t: number, phase: number, period: number) => {
  const u = (t + phase) / period;
  const n = Math.floor(u);
  const f = u - n;
  return n % 2 ? 1 - f : f;
};

/**
 * A value read off a list of keyframe stops, linearly between them.
 *
 * Stops are `[position, value]` with position in [0, 1], in order, and the list
 * must span the whole cycle. That is how every stepped loop in `motion.css` is
 * written: a value held across a range, then moved to the next, which is what
 * gives the saccade its hold-and-flick quality rather than a continuous drift.
 *
 * Linear between stops, which is what every stepped loop here declares.
 * `mo-blink` is the one animation that eases inside its own keyframes, and it
 * is short enough to be written longhand below rather than to make this take a
 * curve it would otherwise never use.
 *
 * `col` selects a column so one wide table serves several channels without a
 * `map` per channel per frame. This runs sixty times a second per blobatar, and
 * a grid of them is the case the whole driver argument was about.
 */
function stops(
  u: number,
  table: readonly (readonly number[])[],
  col: number,
): number {
  for (let i = table.length - 1; i >= 0; i--) {
    const row = table[i]!;
    if (u < row[0]!) continue;
    const next = table[i + 1];
    if (!next) return row[col]!;
    const span = next[0]! - row[0]!;
    return span <= 0
      ? row[col]!
      : row[col]! + (next[col]! - row[col]!) * ((u - row[0]!) / span);
  }
  return table[0]![col]!;
}

/**
 * The saccade's six fixations, as fractions of the cycle and unit offsets.
 *
 * Transcribed from `@keyframes mo-saccade`, and the pairs of positions are the
 * point: each fixation is *held* from one stop to the next and then moved to in
 * a single 1.5% flick. Eyes do not drift, they jump and settle, and a loop that
 * interpolated smoothly between these would read as something swimming.
 *
 * The stops carry the unit vector; `lookX` and `lookY` scale it per seed. One
 * shared sequence visited in a per-seed direction is what keeps a grid from
 * looking left, then up, then right in unison.
 */
const SACCADE: readonly (readonly number[])[] = [
  [0, 0, 0],
  [0.15, 0, 0],
  [0.165, -0.8, -0.9],
  [0.31, -0.8, -0.9],
  [0.325, 1, 0.1],
  [0.47, 1, 0.1],
  [0.485, -0.15, 0.85],
  [0.63, -0.15, 0.85],
  [0.645, 0.75, -0.8],
  [0.79, 0.75, -0.8],
  [0.805, -1, -0.15],
  [0.985, -1, -0.15],
  [1, 0, 0],
];

/**
 * `@keyframes mo-wrap`, on the same clock as the saccade and for the same
 * reason: it is what the glance does to the *shape* of an eye.
 *
 * Four coefficients per stop, in the order the CSS multiplies them:
 * the unsigned horizontal squash, the signed horizontal term, the vertical
 * squash, and the rotation. An eye turning away from the viewer narrows, and
 * the two eyes narrow by different amounts because one of them is turning
 * further away than the other, which is what the signed term carries.
 */
const WRAP: readonly (readonly number[])[] = [
  [0, 0, 0, 0, 0],
  [0.15, 0, 0, 0, 0],
  [0.165, -0.0176, 0.008, -0.027, 0.648],
  [0.31, -0.0176, 0.008, -0.027, 0.648],
  [0.325, -0.022, -0.01, -0.003, 0.09],
  [0.47, -0.022, -0.01, -0.003, 0.09],
  [0.485, -0.0033, 0.0015, -0.0255, -0.115],
  [0.63, -0.0033, 0.0015, -0.0255, -0.115],
  [0.645, -0.0165, -0.0075, -0.024, -0.54],
  [0.79, -0.0165, -0.0075, -0.024, -0.54],
  [0.805, -0.022, 0.01, -0.0045, 0.135],
  [0.985, -0.022, 0.01, -0.0045, 0.135],
  [1, 0, 0, 0, 0],
];

/** `@keyframes mo-shake`, four offsets on a 112ms linear loop. */
const SHAKE: readonly (readonly number[])[] = [
  [0, 0.62, -0.34],
  [0.25, -0.7, 0.22],
  [0.5, 0.38, 0.66],
  [0.75, -0.44, -0.6],
  [1, 0.62, -0.34],
];

/** Periods that are the same for every blobatar, from `motion.css`. */
const BREATHE_MS = 2800;
const BOB_MS = 3400;
const ROCK_MS = 900;
const SHAKE_MS = 112;

/**
 * What the blobatar looks like at time `t`, in milliseconds since whenever the
 * caller started counting.
 *
 * The origin does not matter and deliberately so. Every loop here is infinite
 * and phase-offset per seed, so there is no moment that is the beginning of
 * anything, and a blobatar mounted late is not out of step with one mounted
 * early. That is the same property the stylesheet has, where a blobatar
 * appearing mid-scroll joins loops that were already running.
 *
 * `amp` is the amplitude, 0 to 1, and it scales the ambient layers only.
 * `shake` and `rock` are pose channels rather than ambient ones, so they ride
 * the pose's own amount: a `mad` blobatar trembles because `mad` says so, not
 * because it is being animated. See the header on what amplitude means here.
 */
export function idleAt(
  s: IdleSeeds,
  t: number,
  amp: number,
  shake = 0,
): IdleFrame {
  const breathe = EASE_IN_OUT(alternate(t, s.phase, BREATHE_MS));
  const bob = EASE_IN_OUT(alternate(t, s.bob, BOB_MS));

  const sac = cycle(t, s.saccadePhase, s.saccade);
  const sh = cycle(t, 0, SHAKE_MS);

  // Two segments with a shared curve rather than one alternating loop, because
  // `mo-rock` is written as 1 at both ends and -1 in the middle. It is the same
  // shape and it is spelled the way the stylesheet spells it, so the two can be
  // read against each other.
  const r = cycle(t, 0, ROCK_MS);
  const rockp = r < 0.5 ? 1 - 2 * EASE_IN_OUT(r * 2) : -1 + 2 * EASE_IN_OUT(r * 2 - 1);

  // The blink is one 2.8% flicker at the very end of a multi-second cycle, shut
  // with `ease-in` and opened with `ease-out`. Nothing at all happens for the
  // other 97.2%, which is why it is cheap to run on every blobatar forever.
  const b = cycle(t, s.blinkPhase, s.blink);
  const blink =
    b < 0.972
      ? 1
      : b < 0.986
        ? 1 - 0.92 * amp * EASE_IN((b - 0.972) / 0.014)
        : 1 - 0.92 * amp * (1 - EASE_OUT((b - 0.986) / 0.014));

  return {
    shake: [stops(sh, SHAKE, 1) * shake, stops(sh, SHAKE, 2) * shake],
    breathe: [1 + 0.022 * amp * breathe, 1 - 0.018 * amp * breathe],
    bob: -1.1 * amp * bob,
    saccade: [
      stops(sac, SACCADE, 1) * s.lookX * amp,
      stops(sac, SACCADE, 2) * s.lookY * amp,
    ],
    rockp,
    blink,
    wrap: {
      mx: stops(sac, WRAP, 1) * s.lookMX * amp,
      side: stops(sac, WRAP, 2) * s.lookX * amp,
      sy: stops(sac, WRAP, 3) * s.lookMY * amp,
      rot: stops(sac, WRAP, 4) * s.lookX * s.lookY * amp,
    },
  };
}

/**
 * One frame of the whole animated blobatar, as a transform per nesting level.
 *
 * The mapping from `motion.css`'s elements to this object is one to one, and
 * deliberately so: a renderer builds six levels of group and puts one of these
 * on each, which is the same tree the stylesheet decorates. Nothing here is a
 * simplification of that tree, because every level of it earns its place by
 * having a different origin or a different clock, and collapsing two of them is
 * how the eye-scale bug in `motion.css`'s own history happened.
 *
 * The order inside each string is the order CSS resolves the individual
 * transform properties: `translate`, then `rotate`, then `scale`, then
 * `transform`. That is stated in `motion.css` beside `.mo-eye` and it is the
 * rule the whole composition turns on. Following the comment there is correct;
 * re-deriving it is how the two stop agreeing.
 */
export function idleTransforms<L extends Posable>(
  l: L,
  p: Pose,
  f: IdleFrame,
): {
  root: string;
  breathe: string;
  bob: string;
  eyes: string;
  eye: string[];
  glance: string[];
} {
  return {
    // `.mo-root`. The tremor and nothing else: the hover lift that shares this
    // element on the web has no trigger here.
    root: `translate(${r3(f.shake[0])} ${r3(f.shake[1])})`,
    // `.mo-breathe`, about the viewBox centre rather than the body's own,
    // which `layout()` jitters by up to 1.5 units. At a 2.2% scale that is a
    // 0.03 unit error and not worth a per-element box calculation, which is
    // the trade `motion.css` states at this rule.
    breathe: `translate(50 50) scale(${r3(f.breathe[0])} ${r3(f.breathe[1])}) translate(-50 -50)`,
    // `.mo-bob`, carrying the pose's own `bdy` as well. Both are rigid
    // vertical translates on the same element, so they add.
    bob: `translate(0 ${r3(p.bdy + f.bob)})`,
    // `.mo-eyes`, the glance. It belongs to the pair rather than to each eye,
    // which is why the pose's `edy` lives one level in: two eyes moving by the
    // same amount is the pair moving, and this element is the pair.
    eyes: `translate(${r3(f.saccade[0])} ${r3(f.saccade[1])})`,
    // `.mo-eye`, the pose, with the seesaw's phase folded into it. The same
    // function the still renderer calls, at a phase other than the extreme.
    eye: poseTransforms(l, p, f.rockp).eyes,
    // `.mo-eye > *`, the blink and the glance's foreshortening, both about the
    // eye's own drawn centre.
    //
    // Two scales bracketed by two different rotations, and neither bracket is
    // optional. The blink closes the capsule across its own width, so it is
    // bracketed by the seeded lean, exactly as the pose's scale is. The
    // foreshortening is a screen-space effect, so it is not.
    glance: l.eyes.map((e, i) => {
      const side = i ? 1 : -1;
      const lean = e.rot;
      return (
        `translate(${r3(e.cx)} ${r3(e.cy)})` +
        ` rotate(${r3(f.wrap.rot * side)})` +
        ` scale(${r3(1 + f.wrap.mx + f.wrap.side * side)} ${r3(1 + f.wrap.sy)})` +
        ` rotate(${r3(lean)})` +
        ` scale(1 ${r3(f.blink)})` +
        ` rotate(${r3(-lean)})` +
        ` translate(${r3(-e.cx)} ${r3(-e.cy)})`
      );
    }),
  };
}
