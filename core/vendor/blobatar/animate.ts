import type { Traits } from "./traits.ts";

/**
 * Idle animation for the `blob` variant. See docs/motion-spec.md.
 *
 * `"hover"` animates one blobatar at a time, which is both the aesthetic answer
 * (ambient motion seen constantly is motion worth removing) and the performance
 * one. `"always"` is the escape hatch for the single-blobatar case — a profile
 * header, an onboarding screen — where that frequency argument does not apply.
 */
export type Animate = "hover" | "always";

/**
 * Root class. Amplitude, and therefore everything else, hangs off this.
 *
 * `mo-expr` marks "wearing a non-idle expression" and exists for exactly one
 * reason: a transition takes its duration from the state it is heading *to*, so
 * the class is what lets adopting an expression and returning to idle run on
 * different clocks. It selects no pose of its own — the pose is eight custom
 * properties, and this file never learns which expression is on.
 */
export const rootClass = (mode: Animate, expressive?: boolean) =>
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
export interface IdleSeeds {
  /** How far into the breathe cycle this blobatar starts, in ms. */
  phase: number;
  /** The same for the bob, drawn independently so the drift is not shared. */
  bob: number;
  /** Blink period and offset, in ms. */
  blink: number;
  blinkPhase: number;
  /** Saccade period and offset, in ms. */
  saccade: number;
  saccadePhase: number;
  /** Where this blobatar looks when it glances, signed. */
  lookX: number;
  lookY: number;
  /** The same, unsigned, for the foreshortening. */
  lookMX: number;
  lookMY: number;
}

export function motionSeeds(t: Traits): IdleSeeds {
  const blink = Math.round(t.num("motion.blink", 3500, 6500));
  const saccade = Math.round(t.num("motion.saccade", 4200, 7600));
  const lookX = t.num("motion.lookX", 1, 2.2);
  const lookY = t.num("motion.lookY", 0.8, 1.7);
  const r2 = (v: number) => Math.round(v * 100) / 100;
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
export function motionVars(t: Traits): Record<string, string> {
  const ms = (v: number) => `${-v}ms`;
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
export const serializeVars = (vars: Record<string, string>) =>
  Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
