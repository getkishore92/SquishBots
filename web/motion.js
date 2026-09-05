/** Pure motion math from Blobatar 2.7.0, commit ebb7ea4808b1263629fc8fa65e2398b9cbdb6f6b.
 * Copyright (c) 2026 Alain, MIT; see ../core/vendor/blobatar/LICENSE.
 * Type annotations removed; upstream numeric behavior preserved.
 */
// Upstream animate.ts


/**
 * Idle animation for the `blob` variant. See docs/motion-spec.md.
 *
 * `"hover"` animates one blobatar at a time, which is both the aesthetic answer
 * (ambient motion seen constantly is motion worth removing) and the performance
 * one. `"always"` is the escape hatch for the single-blobatar case — a profile
 * header, an onboarding screen — where that frequency argument does not apply.
 */


/**
 * Root class. Amplitude, and therefore everything else, hangs off this.
 *
 * `mo-expr` marks "wearing a non-idle expression" and exists for exactly one
 * reason: a transition takes its duration from the state it is heading *to*, so
 * the class is what lets adopting an expression and returning to idle run on
 * different clocks. It selects no pose of its own — the pose is eight custom
 * properties, and this file never learns which expression is on.
 */
export const rootClass = (mode         , expressive          ) =>
  `mo-root${mode === "always" ? " mo-always" : ""}${expressive ? " mo-expr" : ""}`;

/**
 * The same timings as numbers, which is what a renderer without a stylesheet
 * needs.
 *
 * Extracted from `motionVars` rather than restated beside it, because these are
 * the numbers a blobatar's whole idle layer is built on and two derivations of
 * them would be two crowds moving differently. `motionVars` is now a
 * serializer over this, and `src/idle.ts` evaluates the loops from it directly.
 *
 * **Phases are positive here and negated on the way out.** A CSS
 * `animation-delay` has to be negative to offset a phase rather than postpone a
 * start, which is a property of that property and not of the number: a loop
 * evaluated in JavaScript wants "how far into the cycle this blobatar begins",
 * which is what this says. The negation stays where the quirk is.
 *
 * Magnitude and sign of the look vector are drawn separately for the reason
 * `motionVars` gives, and both survive here: the foreshortening layer needs
 * *how far* the eyes travel, which is sign-independent.
 */



















export function motionSeeds(t        )            {
  const blink = Math.round(t.num("motion.blink", 3500, 6500));
  const saccade = Math.round(t.num("motion.saccade", 4200, 7600));
  const lookX = t.num("motion.lookX", 1, 2.2);
  const lookY = t.num("motion.lookY", 0.8, 1.7);
  const r2 = (v        ) => Math.round(v * 100) / 100;
  return {
    phase: Math.round(t.num("motion.phase", 0, 2800)),
    bob: Math.round(t.num("motion.bob", 0, 3400)),
    blink,
    blinkPhase: Math.round(t.num("motion.blinkPhase", 0, blink)),
    saccade,
    saccadePhase: Math.round(t.num("motion.saccadePhase", 0, saccade)),
    lookX: r2(lookX) * (t.bool("motion.lookXFlip") ? -1 : 1),
    lookY: r2(lookY) * (t.bool("motion.lookYFlip") ? -1 : 1),
    lookMX: r2(lookX),
    lookMY: r2(lookY),
  };
}

/**
 * Per-blobatar timing, as custom properties for the stylesheet to read.
 *
 * A grid where every blobatar breathes in unison does not read as a crowd of
 * creatures; it reads as a heartbeat. Seeded offsets are what make it a crowd,
 * and they are the single most load-bearing 40 bytes in the motion layer.
 *
 * Delays are negated **here**, at the source. A positive `animation-delay`
 * postpones the start rather than offsetting the phase, so the whole grid would
 * still open in unison — after an awkward pause. Same keystroke, opposite
 * behavior, and it only shows on first paint.
 *
 * Breathe and bob get independent offsets. Sharing one preserves the drift
 * between their two periods but locks every blobatar into the *same* drift, which
 * is the unison problem again, one level up.
 *
 * These keys cost nothing in compatibility: traits are string-addressed, so
 * adding `motion.*` cannot perturb any existing blobatar.
 */
export function motionVars(t        )                         {
  const ms = (v        ) => `${-v}ms`;
  const s = motionSeeds(t);
  return {
    "--mo-phase": ms(s.phase),
    "--mo-bob-phase": ms(s.bob),
    "--mo-blink": `${s.blink}ms`,
    "--mo-blink-phase": ms(s.blinkPhase),

    // Where this blobatar looks when it glances. One shared `@keyframes` visits
    // the same *sequence* of fixations on every blobatar, so without a per-seed
    // direction the whole grid would look left, then up, then right together —
    // the unison problem again, and more legible than the original because a
    // sequence is easier to spot than a phase.
    //
    // Magnitude and sign are drawn separately so the value cannot land near
    // zero: a seed that draws 0.02 would simply never appear to look anywhere.
    //
    // Magnitude ships as its own variable alongside the signed one. The wrap
    // layer (§4.7) foreshortens by *how far* the eyes travel, which is
    // sign-independent, and CSS has no portable `abs()` to recover it — Safari
    // only got one in 17.2. Emitting both is four bytes against a fallback.
    "--mo-look-x": String(s.lookX),
    "--mo-look-mx": String(s.lookMX),
    // Still short of horizontal — eyes rove side to side more than up and down
    // — but not by much, because the fixations are now real compass directions
    // rather than scaled copies of one vector, and a squashed vertical range
    // would collapse "up" and "up-left" into the same look.
    "--mo-look-y": String(s.lookY),
    "--mo-look-my": String(s.lookMY),
    "--mo-saccade": `${s.saccade}ms`,
    "--mo-saccade-phase": ms(s.saccadePhase),
  };
}

/** `--a:1;--b:2` — for the string API, which has no style object to hand. */
export const serializeVars = (vars                        ) =>
  Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");

// Upstream ease.ts
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
  [x1, y1, x2, y2]                                           ,
)                        {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  return (x        ) => {
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

// Upstream morph.ts
/**
 * The pose composition: how a `Pose` becomes geometry, in the two forms a
 * renderer can use it.
 *
 * Split out of `expression.ts` rather than living beside the roster, and the
 * reason is measured rather than aesthetic. The roster is fourteen exported
 * object literals, and a bundler will not drop an object literal the way it
 * drops an unreferenced function: pulling `poseTransforms` into
 * `blobatar/internal` from that module dragged all fourteen poses along with
 * it and put 3.7 kB of expressions nobody imported into every React Native
 * consumer's bundle. `packages/harness/scripts/size.ts` is what caught it.
 *
 * So the line here is between the *machinery*, which several entry points need
 * and which is all function declarations, and the *roster*, which is data and
 * belongs only to a consumer who names one of them. `expression.ts` imports
 * from this file; nothing imports the other way.
 *
 * That leaves `bakePose` and `poseTransforms` in one file, which is the part
 * that actually matters to read. They are two renderings of one composition,
 * they have to agree exactly, and every bug this pair has had was the two
 * drifting apart while sitting in different places. `test/morph.test.ts`
 * asserts they agree at every pose; `scripts/probe-compose.ts` asserts the CSS
 * third rendering agrees with them in a real browser.
 */

/**
 * The channels a pose may touch, and nothing else.
 *
 * Petals are excluded on purpose: a sun's nine petals are silhouette, and moving
 * them independently reads as wind or as the creature coming apart. Path data is
 * excluded because interpolating it puts geometry on the main thread every frame.
 *
 * **The body deforms for nothing, so it no longer deforms.** `bsx`, `bsy` and
 * `skew` used to scale and lean the whole creature and have been removed. Three
 * things settled it. They rank fourth of five for legibility in the first place;
 * they are the only channels with no headroom, since frame containment binds at
 * roughly `bsx: 1.08` and a 3° lean puts a body outside the viewBox — so they
 * break the frame before they get loud enough to read; and in this variant the
 * silhouette *is* the identity. Six shapes, a seeded lopsidedness and a seeded
 * lean are what make a grid read as a crowd, and squashing that per-expression
 * is the one move that makes a blobatar stop looking like itself.
 *
 * `bdy` survives because it is a rigid translate. It moves the creature without
 * distorting it, which is what `happy`'s lift and `sad`'s sink actually needed.
 *
 * Units: scales are factors, `tilt` is degrees, offsets are viewBox units, and
 * `heat`, `shake` and `rock` are 0–1 amounts. `tilt` and `edx` are mirrored per
 * side.
 *
 * The `*2` channels are the **second eye's differential**, not its value: they
 * add to the shared channel on the right eye only, so an identity of 0 is a
 * symmetric face and every existing pose keeps emitting exactly what it did.
 * Expressed as deltas rather than as a second endpoint for precisely that
 * reason — a pair of endpoints would force every symmetric pose to state both.
 */











































































































/**
 * The identity pose, and the key list — every channel's custom property is its
 * own name prefixed, so no lookup table is needed. Iterating this is what lets
 * `poseVars` skip channels a pose leaves alone, which is why `idle` emits
 * nothing at all.
 */
export const IDENT       = {
  esx: 1,
  esy: 1,
  tilt: 0,
  edy: 0,
  edx: 0,
  esx2: 0,
  esy2: 0,
  tilt2: 0,
  edy2: 0,
  lock: 0,
  heat: 0,
  shake: 0,
  rock: 0,
  bdy: 0,
};

/** What `bakePose` needs of a layout. Structural, so this module imports no variant. */




/** Three decimals, which is what every emitted number here rounds to. */
export const r3 = (v        ) => String(Math.round(v * 1000) / 1000);

/**
 * The static path: eye channels baked into geometry, body channels handed back
 * as one `transform` attribute for the caller to wrap.
 *
 * Baking is exact rather than approximate, because the CSS composes in the same
 * order the geometry does. `superellipse` scales by `rx`/`ry` and *then* rotates,
 * and `.mo-eye` applies the pose scale innermost (in `@keyframes mo-blink`) and
 * the tilt outside it (in `mo-wrap`'s `rotate`). The offsets commute with both,
 * since the rotation and scale are about each eye's own center —
 * `transform-box: fill-box` on the animated side, the eye's own `cx`/`cy` here.
 *
 * The body half of that attribute used to be a three-transform chain derived
 * from the CSS — a scale about (50, 50), an offset, and a lean — and needed a
 * `translate(50 50) … translate(-50 -50)` sandwich to put the origin in the
 * right place. With the deforming channels gone it is one rigid translate, which
 * commutes with everything and needs no origin at all. The whole apparatus that
 * kept it honest, including the divergence the composition gate measured, was in
 * service of the two channels that are no longer here.
 *
 * The eye channels stay out of that attribute: baking them costs nothing, where
 * a per-eye transform would need its own origin round-trip and ~85 B per eye.
 */
export function bakePose                   (
  l   ,
  p      ,
)                         {
  return {
    l: {
      ...l,
      eyes: l.eyes.map((e, i) => ({
        ...e,
        // `--mo-wrap`'s sign, spelled out: -1 on the left eye, +1 on the right,
        // so a positive tilt leans both tops outward and brings the inner edges
        // down. That asymmetry is the entire brow vocabulary available here.
        cx: e.cx + p.edx * (i ? 1 : -1),
        // `edy2` lands on the right eye only, like every other differential —
        // and unlike them it has a moving counterpart, which is what decides the
        // shape of `--mo-ph` on the animated side rather than the other way
        // round. The seesaw swings the pair symmetrically about its own centre,
        // so its share of the differential is `(1 + wrap·phase) / 2`; that
        // expression *is* `--mo-sel` at phase +1, on both eyes, because `wrap`
        // is ±1. So the stagger baked here is exactly the loop's own extreme,
        // with no compensating term anywhere and nothing to keep in step by
        // hand. `probe-compose.ts` check A measures the two against each other.
        cy: e.cy + p.edy + (i ? p.edy2 : 0),
        // The `*2` differential lands on the right eye only, which is
        // `--mo-sel`'s job on the animated side. It is added *before* the
        // mirroring on `tilt`, matching `calc(var(--mo-t) * var(--mo-wrap))` —
        // adding it after would flip its sign on the left eye and turn a
        // one-sided brow into a symmetric one.
        rx: e.rx * (p.esx + (i ? p.esx2 : 0)),
        ry: e.ry * (p.esy + (i ? p.esy2 : 0)),
        // `lock` fades the seeded lean out rather than switching it off, which
        // is what lets it interpolate on the animated side. At 0 this is the
        // plain sum it always was.
        //
        // The animated path cannot bake it away — the lean is already in the
        // path's coordinates — so it subtracts the same amount on `.mo-eye`'s
        // `rotate` instead. Both resolve to R(tilt·wrap) · scale about the eye's
        // own centre; `probe-compose.ts` check A measures that they agree.
        rot: e.rot * (1 - p.lock) + (p.tilt + (i ? p.tilt2 : 0)) * (i ? 1 : -1),
      })),
    },
    wrap: p.bdy !== 0 ? `translate(0 ${r3(p.bdy)})` : "",
  };
}

/**
 * The morphing path: the same composition as `bakePose`, expressed as a
 * transform per eye instead of as geometry.
 *
 * **Read this next to `bakePose`, never on its own.** They are two renderings
 * of one composition, and every bug this pair has ever had was the two drifting
 * apart. `test/morph.test.ts` asserts they agree at every pose, which is the
 * cheap version of what `scripts/probe-compose.ts` does against real CSS.
 *
 * ## Why a transform rather than a bake
 *
 * `bakePose` welds the pose into the eye's `rx`/`ry`/`rot`, so drawing a posed
 * eye means running `superellipse` again. That is free once and wrong sixty
 * times a second: a morph that re-bakes puts path generation on the main thread
 * every frame, which is the cost the web side avoids by never regenerating path
 * data at all. A transform on a group moves an already-drawn path instead, so a
 * frame of the morph is thirteen numbers and a string.
 *
 * ## What the string is
 *
 * The web composes this out of `.mo-eye`'s `translate`, `rotate`, `scale` and
 * `transform`, which CSS resolves in that fixed order, about an origin pinned in
 * view-box units to the eye's own centre. Written as one SVG transform list:
 *
 *   translate(posed centre) rotate(tilt·wrap + lean·(1 − lock))
 *     scale(x y) rotate(−lean) translate(−drawn centre)
 *
 * The `rotate(−lean)` … `scale` … `rotate(+lean)` bracket is the load-bearing
 * part and it is the same one `motion.css` explains at length: `superellipse`
 * bakes the seeded lean into the emitted coordinates, so the drawn capsule
 * arrives already tilted and a bare `scale` would shear it instead of closing
 * it across its own width. The outer rotation carries `tilt·wrap` and cancels
 * `lock`'s share of the lean, so the two rotations collapse to exactly the
 * `rot` `bakePose` emits.
 *
 * That collapse is an identity rather than an approximation, and it is why this
 * is exact: a drawn eye is `centre + R(lean)·S(rx, ry)·u`, and applying the
 * list above gives `centre' + R(tilt·wrap + lean·(1 − lock))·S(rx·x, ry·y)·u`,
 * which is `bakePose`'s eye term for term. Scales are diagonal, so they commute
 * past each other; the offsets commute with both because every rotation and
 * scale here is about the eye's own centre.
 *
 * `wrap` is emitted unconditionally, unlike `bakePose`'s, because `bdy` passes
 * through nonzero during a morph even when both endpoints are zero, and a group
 * that appears mid-transition is a reparent rather than a translate.
 *
 * ## The three channels this does not read
 *
 * `shake`, `rock` and `heat` reach no transform here, and `bakePose` does not
 * read them either, which is the point: these two functions are the *pose*, and
 * those three are not positions.
 *
 * `shake` is the amplitude of `mad`'s tremor and `rock` is the amplitude of
 * `thinking`'s seesaw. Both are read by loops rather than by a composition, so
 * they are carried through the interpolation here and land nowhere. What
 * survives is what survives in the static renderer: `thinking`'s `edy2` still
 * staggers the pair, which is frame zero of the seesaw rather than an
 * approximation of it, and `mad` is still a tinted head over flat tilted bars
 * with no tremor on it.
 *
 * A caller who wants the loops wants `src/idle.ts`, which evaluates them and
 * feeds `rockp` back into this function. `poseTransforms` is the still frame of
 * a moving picture; `idleTransforms` is the picture.
 *
 * `heat` is spent before a frame is drawn: colour is resolved in TypeScript and
 * travels as a fill between two finished values.
 */
export function poseTransforms                   (
  l   ,
  p      ,
  rockp = 1,
)                                   {
  return {
    eyes: l.eyes.map((e, i) => {
      // `--mo-wrap` and `--mo-sel`, by their CSS names: the mirror for the
      // channels that flip per side, and the 0/1 selector for the `*2`
      // differentials that land on the right eye only.
      const wrap = i ? 1 : -1;
      const sel = i ? 1 : 0;
      const lean = e.rot;
      // `--mo-ph`, and the whole of how a static differential and a symmetric
      // seesaw are the same term. The static share is `sel`: all of the offset
      // on the right eye, none on the left. The moving share is
      // `(1 + wrap · rockp) / 2`, a swing about the pair's own centre, and at
      // `rockp: 1` the second expression *is* the first, which is why the
      // default here reproduces `bakePose` exactly and why a still `thinking`
      // blobatar wears frame zero of the loop rather than an approximation.
      const ph = sel * (1 - p.rock) + p.rock * ((1 + wrap * rockp) / 2);
      return (
        `translate(${r3(e.cx + p.edx * wrap)} ${r3(e.cy + p.edy + ph * p.edy2)})` +
        ` rotate(${r3((p.tilt + sel * p.tilt2) * wrap + lean * (1 - p.lock))})` +
        ` scale(${r3(p.esx + sel * p.esx2)} ${r3(p.esy + sel * p.esy2)})` +
        ` rotate(${r3(-lean)})` +
        ` translate(${r3(-e.cx)} ${r3(-e.cy)})`
      );
    }),
    wrap: `translate(0 ${r3(p.bdy)})`,
  };
}

/**
 * A pose part-way between two others, which is the whole of what a morph is.
 *
 * The web never needs this: `poseVars` hands the browser two endpoints and a
 * `transition`, and the interpolation happens in the compositor. A substrate
 * with no transitions has to walk the channels itself, and this is that walk.
 * Every channel is a plain number in a linear space by construction, which is
 * what makes one loop correct for all thirteen. `heat` rides along with them
 * and is the one that does not reach a transform: it is the fill's mix, applied
 * by whatever draws the marks.
 *
 * **`undefined` is `idle`**, on either end, for the same reason `poseVars`
 * emits nothing for it: idle *is* the identity, so clearing an expression is a
 * morph toward these initials rather than a special case. A caller that has no
 * expression to name on one side would otherwise have to import one to say so.
 *
 * `heat` is walked with the rest and read by nothing, which is the same place
 * `poseVars` leaves it: colour is resolved in TypeScript and travels as a fill
 * between two finished hex values over the morph's own progress, not as a
 * channel. It is interpolated anyway rather than held at the target, because a
 * `Pose` with one channel quietly not meaning what it says is worse than one
 * spare number, and a caller that wants the mix part-way has it.
 *
 * Written `from·(1 − t) + to·t` rather than `from + (to − from)·t` so that
 * `t = 1` returns the target's numbers *exactly*. The two forms differ by a
 * float ulp, and an ulp is the difference between a settled morph being the
 * static pose and merely resembling it, which is the equality the whole
 * safety net in `test/morph.test.ts` is built on.
 */
export function lerpPose(a                  , b                  , t        )       {
  const from = a ?? IDENT;
  const to = b ?? IDENT;
  const out = {}        ;
  for (const k in IDENT) {
    const c = k              ;
    out[c] = from[c] * (1 - t) + to[c] * t;
  }
  return out;
}

// Upstream idle.ts
const cycle = (t        , phase        , period        ) => {
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
const alternate = (t        , phase        , period        ) => {
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
  u        ,
  table                                ,
  col        ,
)         {
  for (let i = table.length - 1; i >= 0; i--) {
    const row = table[i] ;
    if (u < row[0] ) continue;
    const next = table[i + 1];
    if (!next) return row[col] ;
    const span = next[0]  - row[0] ;
    return span <= 0
      ? row[col]
      : row[col]  + (next[col]  - row[col] ) * ((u - row[0] ) / span);
  }
  return table[0] [col] ;
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
const SACCADE                                 = [
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
const WRAP                                 = [
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
const SHAKE                                 = [
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
  s           ,
  t        ,
  amp        ,
  shake = 0,
)            {
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
export function idleTransforms                   (
  l   ,
  p      ,
  f           ,
)






  {
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

// Upstream gaze.ts
/**
 * Gaze follow: the eyes track a point. §4.5 of `docs/motion-spec.md`, and the
 * layer `motion.css` twice reserves `.mo-eyes`'s `transform` for.
 *
 * This is the one motion layer that needs JavaScript. Everything else in the
 * library is a stylesheet the browser runs on its own, because everything else
 * is a function of the clock alone. A gaze is a function of where the pointer
 * is, which no keyframe can know, so it ships as an entry point rather than as
 * more CSS.
 *
 * ## Two layers, and the seam between them is a frame clock
 *
 * `step` is the pursuit as pure arithmetic: no DOM, no time source, no state it
 * owns. `gaze` is the browser driver around it: measure a box, listen to a
 * pointer, park when nothing moves, write two custom properties.
 *
 * The split is not tidiness. The filter is recursive, so frame 200 depends on
 * frame 199, and anything that renders frames out of order cannot run a driver
 * at all. `apps/video` renders a Remotion film across several workers in
 * arbitrary order, and integrating as it went would silently produce a
 * different film per worker. It solves the whole track forwards at module load
 * instead and reads rows back, which it can only do because the arithmetic is
 * separable from the clock. Keeping the two apart here is what lets the film be
 * the shipped behaviour rather than a flattering imitation of it.
 *
 * ## It writes custom properties and nothing else
 *
 * Not a class, and that is a finding rather than a preference. `.mo-root`'s
 * `className` is composed by the adapters from `animate` and the expression, so
 * a framework rewrites that attribute wholesale whenever either changes, taking
 * any imperatively added class with it. The failure is the quiet kind: the
 * driver keeps running and the eyes simply stop moving.
 *
 * So a driver that writes a class into a framework's DOM is racing the
 * framework for that attribute, and it loses without saying so. Custom
 * properties are uncontested, so this only ever sets `--mo-track-x` and
 * `--mo-track-y`, and the host stylesheet decides where the layer applies.
 *
 * ## Why this is smoothed when the saccade is not
 *
 * `motion.css` is emphatic that easing the idle saccade gives floating
 * eyeballs, and it is right: a saccade is ballistic, so anything but a snap
 * between holds reads wrong. This is not a saccade. Eyes following a moving
 * target run *smooth pursuit*, a different oculomotor system that is continuous
 * by construction, so the filter here is the correct shape for the thing being
 * modelled rather than a softened saccade.
 *
 * That only holds while the target moves at pursuit speeds. A pointer that
 * jumps across the screen is not something an eye pursues, it is something an
 * eye saccades to, which is what `SNAP` is.
 */

/**
 * Pursuit time constant in ms: how long the eyes take to cover ~63% of the way
 * to a new target.
 */
export const SETTLE = 110;

/**
 * Target movement in one frame, as a fraction of the excursion, past which the
 * eyes stop pursuing and jump.
 *
 * A full reversal is 2, so this is four fifths of one: enough that ordinary
 * sweeping never trips it, and little enough that a teleport always does. Above
 * it the target has not moved, it has been replaced (a scroll, a tab return, a
 * pointer re-entering the window), and an eye answers that with a saccade.
 *
 * **Expressed against the normalised direction, not in CSS pixels.** The
 * excursion is the stylesheet's to set, so a threshold in pixels would be a
 * second place to change whenever `--mo-track-travel` is retuned, and the two
 * would drift apart without either looking wrong on its own. `apps/demo` used
 * to compare in pixels and now does not; this is the form that survived.
 */
export const SNAP = 1.6;

/**
 * The near field, as a fraction of the blobatar's own radius: inside this the
 * excursion eases to zero.
 *
 * `dx / d` is a unit vector, so its direction is undefined at the centre and
 * violently sensitive just outside it. A pointer crossing a blobatar's own
 * footprint sweeps that direction through 180 degrees in the handful of frames
 * it takes to get across, at full excursion the whole way: the eyes snap about
 * wildly as the cursor passes over rather than tracking it, and it is worse
 * than it sounds because `SNAP` reads those flips as target jumps and takes the
 * smoothing off exactly when it is most needed.
 *
 * Easing the *amplitude* to zero over the near field kills the singularity at
 * its source. The direction is still noisy in there, but it is multiplied by
 * almost nothing, so nothing moves. Physically it is also the honest answer:
 * there is no direction to look in at something you are already on. Pointing
 * straight at a face makes it look straight back at you.
 *
 * Scaled by the blobatar rather than fixed, because this fraction of a 24px
 * cell and of a 200px hero are different distances and both are "just about to
 * be on top of it". It was once filed as the one thing a large blobatar needs
 * that a grid does not, and that was wrong: a grid needs it at any cell size a
 * pointer can get inside, which `apps/demo` reaches by 100px.
 */
export const DEADZONE = 0.55;

/**
 * How far the eyes must move, in CSS pixels, for a frame to be worth writing.
 *
 * A flat threshold on the direction is the wrong shape, and expensively so:
 * 0.002 of a unit vector is a different amount of movement on a 24px avatar
 * and on a 200px one, and on the small one it is a fraction of a pixel nobody
 * can resolve. The exponential never actually arrives, so this number is the
 * only thing deciding when the writes stop, and set below what a display can
 * show it keeps handing the style engine work for tens of frames after the
 * motion is over. Measured in `apps/demo`, that tail was most of what the layer
 * cost: a forty-frame convergence per blobatar became three or four writes.
 *
 * A sixth of a pixel is under the threshold on any display. Nothing about the
 * motion changes: the smoothing still runs every frame at full precision, and
 * the last value written is still within one step of the target. Only how often
 * the result is handed on.
 */
export const VISIBLE_PX = 0.15;

/**
 * Floor and ceiling on the derived threshold.
 *
 * The ceiling matters more. A 24px cell at a travel of 2.5 puts the whole
 * excursion inside two thirds of a pixel, and a threshold derived honestly from
 * that would quantise the direction into about four positions: correct by the
 * arithmetic and visibly steppy the moment anyone raises the travel. The floor
 * is the sane limit for a blobatar large enough that anything finer is the
 * driver's own noise.
 */
const EPS_MIN = 0.002;
const EPS_MAX = 0.06;

/**
 * How much the stand-down has to move before it is worth a write.
 *
 * Coarser than the excursion's threshold by an order of magnitude, and
 * deliberately: this scales the idle rove's *seeds*, and a 1% change in the
 * amplitude of a glance nobody is watching for is not a thing anyone can see.
 * It is also the channel that has to be written above `.mo-eyes` to be seen at
 * all, so each write costs a wider invalidation than the excursion's does.
 */
export const HOLD_EPS = 0.01;

/** Cubic smoothstep, so every ramp here is flat at both ends. */
export const smoothstep = (t        ) => t * t * (3 - 2 * t);

const clamp = (v        , lo        , hi        ) => Math.min(hi, Math.max(lo, v));

/**
 * The smoothing factor for one frame.
 *
 * Frame-rate independent, so the pursuit is not visibly quicker on a 120Hz
 * display than on a 60Hz one. That is the bug where an animation "feels
 * different on my laptop" and nobody can say why.
 *
 * A `settle` of 0 removes the smoothing entirely, which is worth looking at
 * once to see the floating-eyeball argument from the other side.
 */
export const pursuit = (dt        , settle         = SETTLE) =>
  settle <= 0 ? 1 : 1 - Math.exp(-dt / settle);

/**
 * `VISIBLE_PX` converted into units of the direction, for a blobatar this wide
 * on screen at this excursion.
 *
 * A viewBox unit is `width / 100` CSS pixels and the direction is scaled by the
 * travel, so this is the only space the comparisons in a driver can be made in.
 * Per blobatar rather than per field, because a field does not have one answer:
 * the same grid at 24px and at 200px wants thresholds an order of magnitude
 * apart.
 */
export function threshold(width        , travel        )         {
  const perUnit = travel * (width / 100);
  return perUnit > 0 ? clamp(VISIBLE_PX / perUnit, EPS_MIN, EPS_MAX) : EPS_MAX;
}

/**
 * How near the edge of the disc a mark is allowed to park, 0 to 1.
 *
 * A rotation large enough carries a mark round the back of the head, where
 * there is nothing to draw — which is true of a real head and wrong here. The
 * excursion is a stylesheet's to set and nothing stops it being set to more
 * head than there is: `triangle`'s fitted head is 9 units tall, so an excursion
 * of 24 is a pitch of 159°, and the eyes do not turn away, they *vanish*. A
 * face that blinks out of existence because someone typed a large number is not
 * a failure anyone can read.
 *
 * So the mark stops at the edge instead of passing it. At 0.97 the depth is
 * still 0.24, which is an eye down to about a quarter of its width: thin enough
 * to read as turned almost fully away, wide enough to be a face. Raising this
 * toward 1 buys a little more turn and takes away the guarantee that there is
 * always something on screen.
 */
export const LIMB = 0.97;

/**
 * The convergence tilt at the corners, in degrees.
 *
 * Under §4.7 this was a tuned coefficient per saccade stop, and the
 * differential between the eyes had to be asserted by a test. Here it is the
 * shear the projection already produces, so the opposite signs per eye and the
 * vanishing on the pure axes fall out rather than being arranged.
 *
 * 4° against the static per-blobatar lean capped at 12° in `layout()`, and
 * against §4.7's own 2.4° peak. `test/gaze.test.ts` pins the measured peak, so
 * retuning this fails there and has to be written down rather than drifting.
 */
export const TILT = 4;

/** One eye's rest position, as a fraction of the face's radius on each axis. */





/** Where a mark has gone, and what shape it is when it gets there. */











/**
 * How a small patch of the sphere's surface at `(x, y, z)` projects.
 *
 * Orthographic projection compresses a patch purely *radially* — by the depth
 * `z`, toward the middle of the disc — and leaves it alone tangentially. That
 * single fact is all three of §4.7's cues. Resolving the radial compression
 * onto the x and y axes gives the two scales, and what is left over is a shear,
 * which is the convergence: a mark off both centre lines has its frame rotated,
 * and one on either axis does not.
 */
const patch = (x        , y        , z        ) => {
  const r2 = x * x + y * y;
  /* Dead centre has no radial direction to compress along, and no tilt. */
  if (r2 < 1e-9) return { sx: 1, sy: 1, sh: 0 };
  const d = Math.max(0, z);
  return {
    sx: (d * x * x + y * y) / r2,
    sy: (d * y * y + x * x) / r2,
    sh: ((d - 1) * x * y) / r2,
  };
};

/**
 * A mark on a sphere, turned and projected — the gaze's answer to §4.7's wrap.
 *
 * ## Why this is a projection and not the idle wrap with a different clock
 *
 * §4.7 is six tuned stops of `@keyframes mo-wrap`, locked frame-for-frame to
 * the saccade's six fixations. It cannot be pointed at an arbitrary direction,
 * because it has no arbitrary direction to be pointed at: its input is which
 * stop the saccade is in. The gaze's input is a continuous unit vector, so the
 * cues have to be a continuous function of it, and once they are a function
 * there is no reason for it to be a fitted one. This is the sphere.
 *
 * ## Why it is a rotation and not two angles
 *
 * It was two angles, one per axis, each clamped at the limb — and that is not a
 * sphere, it is a square. A diagonal aim drove both to their limits at once and
 * put the mark at the *corner*, which is `√2` from the centre of a disc of
 * radius 1, so the eye left the head on every diagonal while behaving perfectly
 * on the axes. That is the failure this shape cannot have: the mark is lifted
 * onto the unit sphere, rotated as a vector, and projected, so `x² + y² ≤ 1`
 * holds by construction in every direction rather than on two of them.
 *
 * A mark carried onto the far side is hidden rather than drawn, which is what
 * "the eye went round the back of the head" has to mean.
 *
 * ## Why the excursion stops being a translation
 *
 * A translation is what lets an eye leave the head. `travel` is still a
 * distance in viewBox units and still means what the README says, but it is
 * read as an arc along the surface rather than a slide across it: the turn is
 * `travel / radius` radians, and the mark lands where the rotation puts it. For
 * a small turn `sin θ ≈ θ`, so a face at the documented 1.5 to 4 units moves
 * exactly as far as it did when this was a translate, which is the whole reason
 * the excursion did not have to become an angle to get this.
 *
 * For a large one the two part company, and that is the point. The projection
 * saturates: a mark cannot pass the limb, and it arrives there at no width. So
 * an eye asked for more excursion than the head has goes to the edge and
 * vanishes, where the translate sent it out over the page. Nothing clips it.
 * There is no `clipPath`, no id, and the guarantee in `test/blobatar.test.ts`
 * that many blobatars on one page cannot collide is untouched.
 *
 * `m` is the mark's rest position as a fraction of the face's radius *on each
 * axis*, and `yaw`/`pitch` are the turn in radians. Per axis, because the face
 * is not round: `capsule` is 37 units wide and 20 tall, and one mean radius put
 * its limb 44% below the eyes it was supposed to contain, which is an eye
 * sitting well under the chin. Normalising each axis by its own radius makes
 * the head an ellipsoid, and the ellipse inscribed in a superellipse is inside
 * it everywhere.
 */
export function project(m      , yaw        , pitch        )             {
  /* Lifted onto the sphere. A mark drawn outside the disc — a decoration that
     widened the body's box without widening the face — is pulled back to the
     limb rather than producing an imaginary depth. */
  const r2 = m.x * m.x + m.y * m.y;
  const k = r2 > 1 ? 1 / Math.sqrt(r2) : 1;
  const x0 = m.x * k;
  const y0 = m.y * k;
  const z0 = Math.sqrt(Math.max(0, 1 - x0 * x0 - y0 * y0));

  /* Yaw about the vertical, then pitch about the horizontal. */
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const x1 = x0 * cy + z0 * sy;
  const z1 = z0 * cy - x0 * sy;

  /* Pitch's sign is against the screen's y, not against a right-handed frame:
     SVG's y grows downward, so a positive aim is a look *down* and has to move
     the mark down. Written the textbook way round it inverts the vertical: a
     pointer below the face makes it look up. */
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const y1 = y0 * cp + z1 * sp;
  const z2 = z1 * cp - y0 * sp;

  /* Parked at the edge rather than carried over it. See `LIMB`: past this the
     mark is either round the back or so near the limb that it has no width
     left, and both of those are an eye that has disappeared. */
  const rho = Math.hypot(x1, y1);
  const over = z2 <= 0 || rho > LIMB;
  const back = over ? LIMB / (rho || 1) : 1;
  const px = x1 * back;
  const py = y1 * back;
  const pz = over ? Math.sqrt(1 - LIMB * LIMB) : z2;

  const rest = patch(x0, y0, z0);
  const now = patch(px, py, pz);

  return {
    dx: px - m.x,
    dy: py - m.y,
    /*
     * Relative to the mark's own resting foreshortening, not to 1. An eye off
     * the middle of the face is already turned away from you at rest, and the
     * renderer drew it at the width it has *there*, so dividing that out is
     * what makes a turn of zero the identity on every mark rather than only on
     * one at the centre.
     *
     * Capped at 1, and the cap is not a rounding guard. Un-dividing is
     * symmetric: an eye turning *toward* the middle un-foreshortens, and the
     * geometry says it should widen, by up to 11% on a face with the hero's eye
     * spacing. That is true of a real head and it is the one thing §4.7 says
     * breaks the illusion outright — "an eye growing on a glance is the tell
     * that kills the sphere read instantly" — and watching it, §4.7 is right.
     * So the drawn width is taken as the mark's widest and this only ever
     * removes width, the same bargain the idle wrap makes one layer over.
     */
    sx: Math.min(1, now.sx / (rest.sx || 1)),
    sy: Math.min(1, now.sy / (rest.sy || 1)),
    /* As a change from rest, the same shape as the offset and for the same
       reason: a mark off both centre lines has a real shear at rest, and an eye
       that arrives already rotated is the renderer's `lean` being overwritten
       by a layer that is meant to compose with it. */
    t: TILT * (now.sh - rest.sh),
  };
}

/** One blobatar's smoothed gaze direction, as the caller keeps it. */













































/**
 * One pursuit step, with the saccade branch. Pure: no clock, no DOM, no state.
 *
 * The target is returned alongside the new position because arrival has to be
 * decided against it and not inferred from whether a write happened. The write
 * threshold measures distance from the *last written value*, not from the
 * target, so a frame whose increment lands under it is silent while the eyes
 * are still travelling, and one silent frame parks a driver's loop and strands
 * them. The residual that strands is up to `eps / k`, which at a 90ms settle is
 * around six times `eps`: not a rounding error, a visibly wrong direction held
 * until the pointer moves again. A driver snaps to `tx`/`ty` once inside its
 * threshold of them, and convergence then terminates on the value.
 */
export function step(i           )             {
  const d = Math.hypot(i.dx, i.dy);
  const near = i.radius > 0 ? smoothstep(Math.min(1, d / (i.radius * DEADZONE))) : 1;
  const amp = (i.gain ?? 1) * near;

  const tx = d > 0 ? (i.dx / d) * amp : 0;
  const ty = d > 0 ? (i.dy / d) * amp : 0;

  /* Measured on the target, not on the pointer, so a cursor crossing the page
     fast still pursues while one that is replaced jumps. */
  const f = Math.hypot(tx - i.x, ty - i.y) > (i.snap ?? SNAP) ? 1 : i.k;

  return { x: i.x + (tx - i.x) * f, y: i.y + (ty - i.y) * f, tx, ty, f };
}

/**
 * A blobatar's face, as the projection needs it: where the eyes rest, and how
 * big the head they turn on is.
 *
 * The radii are semi-axes in viewBox units and the marks are fractions of them,
 * so a `Mark` is already normalised for `project` and neither number changes
 * when the page scrolls or the blobatar is drawn at a different size.
 */
