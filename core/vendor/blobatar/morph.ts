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
export interface Pose {
  /** Eye width, about each eye's own center. */
  esx: number;
  /** Eye height, about each eye's own center. */
  esy: number;
  /**
   * Eye tilt, mirrored per side: the left eye rotates by `-tilt`, the right by
   * `+tilt`.
   *
   * **What that reads as depends on the eye's orientation, and the sign flips
   * when it changes.** On a *portrait* capsule — the natural shape here, median
   * aspect 2.55:1 — a positive tilt leans both tops outward and brings the inner
   * edges down, which is the angry direction. Flatten the capsule past square
   * with `esy` and the same rotation raises the inner ends instead: on a
   * *landscape* bar, **negative** tilt is the angry `\ /` and positive is the
   * sad `/ \`.
   *
   * This is not a quirk of the implementation, it is what rotating a bar does,
   * and it is invisible to every test in the suite — clearance, containment and
   * the composition gate are all sign-blind. It cost a full roster of poses
   * wearing each other's brows to notice. **Look at the render.**
   */
  tilt: number;
  /** Eye pair offset, positive = down. */
  edy: number;
  /** Eye convergence, positive = apart. */
  edx: number;
  /** Extra width on the right eye only. */
  esx2: number;
  /** Extra height on the right eye only. */
  esy2: number;
  /** Extra tilt on the right eye only, before the per-side mirroring. */
  tilt2: number;
  /**
   * Extra vertical offset on the right eye only, positive = down.
   *
   * The differential the first three rosters never needed. There is one for
   * width, one for height and one for tilt, and none for *position*, because
   * every pose up to `thinking` said its asymmetry with shape — `wink` closes an
   * eye, `unsure` shrinks one. A pair of eyes at two **heights** is a sentence
   * none of those can make, and it is the one that reads as attention pointed
   * somewhere other than at you.
   *
   * It is also the static half of `rock`, and the reason a `thinking` blobatar
   * still reads with the stylesheet missing or the loop stopped for reduced
   * motion: what is left on the face is one frame of the seesaw rather than
   * nothing at all.
   */
  edy2: number;
  /**
   * How much of the **seeded** eye lean the pose overrides, 0–1. At 0 the pose's
   * `tilt` adds to whatever lean the seed drew; at 1 the seeded lean is cancelled
   * and the eyes sit at exactly the angle the pose names.
   *
   * It exists because `tilt` is a *brow*, and a brow is an absolute direction.
   * `styles/blob.ts` leans each eye by up to 12° in a single seeded direction —
   * identity, and good identity, on an idle face. Added to a pose it is not
   * identity, it is noise on the one channel that carries the meaning: `mad`'s
   * `\ /` at −33° meets a +12° seed and comes out `\ \`, a pair of parallel bars
   * that read as bored rather than angry, while the seed 12° the other way gets
   * an unusually furious `mad`. The reference renders are unambiguous about which
   * of those is wanted.
   *
   * So the loud poses take their tilt absolute and the seeded lean returns intact
   * the moment the expression clears — the identity is in the idle face, not in a
   * per-seed discount on the expression. This is the same rule `esx`/`esy` already
   * follow by being factors on a shape the pose flattens nearly out of existence:
   * every blobatar wears the same strength of a given expression.
   *
   * Interpolates like every other channel, so the lean eases out over the morph
   * rather than snapping.
   */
  lock: number;
  /** How far the palette shifts toward its hot pair, 0–1. */
  heat: number;
  /** Tremor amplitude, 0–1. Held, not fired — see `@keyframes mo-shake`. */
  shake: number;
  /**
   * Seesaw amplitude, 0–1. Held, not fired — see `@keyframes mo-rock`.
   *
   * The second channel whose content is a *duration* rather than a shape, and
   * built the way `shake` is for the same reason: an expression is set and held,
   * with no timers, no self-termination and no notion of firing again, so a
   * repeating motion has to be an amplitude on a loop that always runs and
   * resolves to the identity at 0. `shake` made that argument once; this is the
   * evidence it generalises past a tremor.
   *
   * What it drives is **antiphase**: the left eye rises as the right one falls,
   * on `--mo-wrap`'s sign, so the pair trades heights and the mean stays put. A
   * bounce — both eyes dipping together — would be `mo-bob` at a second period
   * and would beat against it. A trade cannot.
   *
   * The swing is `edy2` wide, which is what makes the static bake exactly frame
   * zero of the loop rather than an approximation of it. See `bakePose`.
   *
   * What the number means, precisely: it is how much of the stagger *takes part*
   * in the swing. At 1 the pair fully inverts every half cycle; at 0.7 it swings
   * through level and comes back out 40% inverted, about the same mean. So the
   * two extremes are not mirror images, and that is the intent — the pose the
   * consumer set stays the one the face spends most of its time near, and the
   * loop breathes around it rather than replacing it half the time.
   */
  rock: number;
  /** Whole-creature offset, positive = down. */
  bdy: number;
}

/**
 * The identity pose, and the key list — every channel's custom property is its
 * own name prefixed, so no lookup table is needed. Iterating this is what lets
 * `poseVars` skip channels a pose leaves alone, which is why `idle` emits
 * nothing at all.
 */
export const IDENT: Pose = {
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
export interface Posable {
  eyes: { cx: number; cy: number; rx: number; ry: number; rot: number }[];
}

/** Three decimals, which is what every emitted number here rounds to. */
export const r3 = (v: number) => String(Math.round(v * 1000) / 1000);

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
export function bakePose<L extends Posable>(
  l: L,
  p: Pose,
): { l: L; wrap: string } {
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
export function poseTransforms<L extends Posable>(
  l: L,
  p: Pose,
  rockp = 1,
): { eyes: string[]; wrap: string } {
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
export function lerpPose(a: Pose | undefined, b: Pose | undefined, t: number): Pose {
  const from = a ?? IDENT;
  const to = b ?? IDENT;
  const out = {} as Pose;
  for (const k in IDENT) {
    const c = k as keyof Pose;
    out[c] = from[c] * (1 - t) + to[c] * t;
  }
  return out;
}
