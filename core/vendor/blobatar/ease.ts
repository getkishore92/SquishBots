/**
 * CSS timing functions, for a substrate that has none.
 *
 * A stylesheet names its curves and the engine solves them. React Native has
 * neither the names nor the solver, so the idle loops and the expression morph
 * both have to evaluate a `cubic-bezier` themselves, and this is the one copy
 * of it. It is a module of its own rather than a helper inside `idle.ts`
 * because the morph needs it without needing the loops, and a shared helper
 * living in the larger file would drag the whole idle layer into a bundle that
 * only ever morphs. `packages/harness/scripts/size.ts` is what would catch that.
 *
 * Nothing here is a new decision. Every curve below is transcribed from
 * `motion.css`, and the two files have to be changed together.
 */

/**
 * A CSS `cubic-bezier(x1, y1, x2, y2)`, as a function of elapsed fraction.
 *
 * The curve is a parametric Bézier, so reading `y` at a given `x` means solving
 * for the parameter first, which is what the Newton loop does, from `x` itself
 * as the starting guess. That guess is exact for `linear` and close for
 * everything with control points inside the unit square, so eight iterations is
 * generous and the loop normally exits on the second or third.
 *
 * Both fallbacks return the current estimate rather than throwing or clamping.
 * A stalled derivative means the curve is flat there, where the estimate is as
 * good as any answer, and this is a frame of an animation rather than a place
 * to be principled at the cost of a visible glitch.
 */
export function bezier(
  [x1, y1, x2, y2]: readonly [number, number, number, number],
): (x: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  return (x: number) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = ((ax * t + bx) * t + cx) * t - x;
      if (Math.abs(err) < 1e-5) break;
      const d = (3 * ax * t + 2 * bx) * t + cx;
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    return ((ay * t + by) * t + cy) * t;
  };
}

/**
 * The three CSS keywords this library actually uses, spelled as the curves the
 * specification says they stand for.
 *
 * `linear` is not here because it needs no solver: it is the identity, and
 * calling a Newton loop to find that out is eight iterations of nothing.
 *
 * Each is annotated `/* @__PURE__ *\/` because it is a *call*, and a bundler
 * will not drop a call it cannot prove side-effect-free. Without the
 * annotation a consumer who only ever draws a still blobatar still links the
 * solver. The size gate is where that shows up.
 */
export const EASE_IN_OUT = /* @__PURE__ */ bezier([0.42, 0, 0.58, 1]);
export const EASE_IN = /* @__PURE__ */ bezier([0.42, 0, 1, 1]);
export const EASE_OUT = /* @__PURE__ */ bezier([0, 0, 0.58, 1]);

/**
 * The morph's two curves, from `.mo-root` and `.mo-root.mo-expr`.
 *
 * The one going *in* is deliberately not the obvious hard ease-out, and
 * `motion.css` carries the measurements behind that at length: the pose
 * channels do not all travel the same distance, so a front-loaded curve
 * finishes the eye's squash before the eye appears to have left, and the morph
 * reads as a cut rather than as a fast transition.
 *
 * The durations ride with them, because a curve and the time it is spread over
 * are one decision. 300ms adopting an expression and 400ms returning to idle:
 * an expression is a message the consumer sent, and yanking it off the face
 * reads as a glitch rather than as a creature settling.
 */
export const MORPH_IN = { ms: 300, ease: /* @__PURE__ */ bezier([0.45, 0.05, 0.5, 1]) };
export const MORPH_OUT = { ms: 400, ease: EASE_IN_OUT };
