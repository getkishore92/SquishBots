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
export const smoothstep = (t: number) => t * t * (3 - 2 * t);

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

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
export const pursuit = (dt: number, settle: number = SETTLE) =>
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
export function threshold(width: number, travel: number): number {
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
export interface Mark {
  x: number;
  y: number;
}

/** Where a mark has gone, and what shape it is when it gets there. */
export interface Projection {
  /** Offset from rest, in the same fractions the mark came in as. */
  dx: number;
  dy: number;
  /** Foreshortening, 0 to 1, relative to the mark's own resting width. */
  sx: number;
  sy: number;
  /** Convergence tilt, in degrees. */
  t: number;
}

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
const patch = (x: number, y: number, z: number) => {
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
export function project(m: Mark, yaw: number, pitch: number): Projection {
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
export interface Aim {
  /** Signed direction, each component in -1..1 and scaled by the excursion. */
  x: number;
  y: number;
}

export interface StepInput extends Aim {
  /** Vector from the blobatar's centre to the target, in CSS pixels. */
  dx: number;
  dy: number;
  /** The blobatar's drawn radius in CSS pixels: what `DEADZONE` is a fraction of. */
  radius: number;
  /** This frame's smoothing factor, from `pursuit`. */
  k: number;
  /**
   * External amplitude multiplier, 0 to 1.
   *
   * The seam for anything that decides *whether* this blobatar is looking, as
   * opposed to where: a distance falloff across a field, an engagement ramp at
   * the head of a film. Kept out of the near-field ease below because the two
   * answer different questions, and a host that cross-fades the idle rove
   * against the gaze wants this value rather than the combined amplitude. Feed
   * it the eased one and a blobatar starts roving idly the moment the pointer
   * lands on top of it, which is stranger to watch than the flick it replaced.
   */
  gain?: number;
  /** Saccade threshold in units of the excursion. Defaults to `SNAP`. */
  snap?: number;
}

export interface StepResult extends Aim {
  /** Where the eyes are aimed *now*, before smoothing: the pursuit's target. */
  tx: number;
  ty: number;
  /**
   * The interpolation factor this step actually used: `k`, or 1 if the saccade
   * branch fired.
   *
   * Returned because a host cross-fading a second channel on the same clock (a
   * stand-down, a per-blobatar gain) wants that channel to jump when the eyes
   * jump rather than to glide on serenely through a teleport.
   */
  f: number;
}

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
export function step(i: StepInput): StepResult {
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
export interface Face {
  marks: Mark[];
  /** The face's radius on each axis, in viewBox units. */
  rx: number;
  ry: number;
}

/**
 * Measure one blobatar's face off its own rendered geometry.
 *
 * Exported because the driver is not the only thing that has to know where an
 * eye rests. `apps/video` solves its pursuit forwards at module load and cannot
 * run a driver at all, but it still has to land the same eye in the same place,
 * and the fitted head is the one input it cannot derive from a name. A second
 * copy of the bisection below would keep rendering plausibly while the two
 * quietly disagreed about where the limb is, which is the failure this file
 * spends its whole length trying not to have.
 *
 * `el` is the `<svg>`. Returns `null` for a subtree with no layout box: a
 * blobatar that is `display: none` or detached, and so cannot be looked at
 * anyway. A caller holding a previous measurement should keep the one it has.
 *
 * `getBBox` is the element's own geometry and ignores every transform on it and
 * above it, so this is the *rest* position however far the gaze, the saccade or
 * the expression have currently moved things. That is what makes it safe to
 * call at any time rather than only before anything starts.
 */
export function survey(el: Element): Face | null {
  const head = el.querySelector<SVGGraphicsElement>(".mo-bob > g:not(.mo-eyes)");
  const eyes = [...el.querySelectorAll<SVGGraphicsElement>(".mo-eye")];
  if (!head || !eyes.length) return null;
  try {
    const b = head.getBBox();
    /*
     * The largest ellipse of the body's own proportions that fits inside the
     * silhouette, found by bisection along sixteen rays from the centre.
     *
     * The box on its own is not the head. `capsule` is a stadium whose box
     * an ellipse overflows at the ends, `triangle`'s box is mostly not
     * triangle, and `round`'s per-point radii dip 15% below its widest.
     * Fitted rather than assumed because the roster does not agree on one
     * number: it lands at 0.98 on `round` and 0.39 on `triangle`, and a
     * constant safe for the second would have halved the excursion on the
     * first for no reason.
     *
     * Shrinking the head rather than clamping the eye afterwards is what
     * keeps this a projection. The turn is `travel / radius`, so a smaller
     * head turns proportionally further for the same excursion and a small
     * glance moves exactly as far as it did — only the saturation comes
     * sooner, which is correct: there is less head to turn.
     */
    const fill = [...head.querySelectorAll<SVGGeometryElement>("path,circle")];
    const cx0 = b.x + b.width / 2;
    const cy0 = b.y + b.height / 2;
    const hit = (t: number, c: number, s2: number) =>
      fill.some((f) =>
        f.isPointInFill(
          new DOMPoint(cx0 + ((t * b.width) / 2) * c, cy0 + ((t * b.height) / 2) * s2),
        ),
      );
    let fit = 1;
    for (let a = 0; a < 16; a++) {
      const r = (a / 16) * Math.PI * 2;
      const c = Math.cos(r);
      const s2 = Math.sin(r);
      if (hit(1, c, s2)) continue;
      let lo = 0;
      let hi = 1;
      for (let i = 0; i < 12; i++) {
        const mid = (lo + hi) / 2;
        if (hit(mid, c, s2)) lo = mid;
        else hi = mid;
      }
      fit = Math.min(fit, lo);
    }

    /*
     * Inset by the eyes' own half-extent, because a centre inside the
     * silhouette is not an eye inside it. These are capsules up to 22 units
     * tall on a face 77 across, so an eye whose middle sits exactly on the
     * boundary has a third of itself outside.
     */
    let ix = 0;
    let iy = 0;
    const centres = eyes.map((e) => {
      const g = e.getBBox();
      ix = Math.max(ix, g.width / 2);
      iy = Math.max(iy, g.height / 2);
      return { x: g.x + g.width / 2 - cx0, y: g.y + g.height / 2 - cy0 };
    });
    let rx = Math.max(1, (b.width / 2) * fit - ix);
    let ry = Math.max(1, (b.height / 2) * fit - iy);

    /*
     * …opened back up if the eyes do not fit in what that leaves, which
     * `triangle` manages: its fitted ellipse is 0.39 of its box and its eyes
     * sit wider than that. A head that does not contain its own eyes starts
     * them at the limb, fully foreshortened and unable to move.
     */
    let need = 0;
    for (const c of centres) need = Math.max(need, Math.hypot(c.x / rx, c.y / ry));
    if (need > 0.85) {
      rx *= need / 0.85;
      ry *= need / 0.85;
    }
    return { marks: centres.map((c) => ({ x: c.x / rx, y: c.y / ry })), rx, ry };
  } catch {
    /* Not laid out yet. */
    return null;
  }
}

/* ------------------------------------------------------------------ driver */

/**
 * What a pair of eyes can be pointed at.
 *
 * One vocabulary, used by `lookAt` and by `GazeOptions.target` alike, because
 * "where it starts out looking" and "where it looks now" are the same question
 * asked at two moments and answering them differently is how a caller ends up
 * with two mental models of one driver.
 *
 * The union is four things and they are not four modes. Everything below the
 * aim is arithmetic on a single point: the members differ only in where that
 * point comes from and, for the last two, in whether the idle glance is allowed
 * back afterwards. Nothing here reimplements the pursuit, the near field or the
 * saccade branch, and a target swapped for another is a substitution rather
 * than a switch — the eyes glide from wherever they are, and `SNAP` decides
 * which of those is a glide and which is a jump.
 *
 * - `{ x, y }` — a point in **client** coordinates. A caret, a drop shadow, a
 *   spot in the viewport. The caller owns re-aiming it when the page moves,
 *   which is the honest split: a point is a point and the driver cannot know
 *   what produced it.
 * - `Element` — that element's box centre, re-read whenever the driver
 *   re-measures its own, so it survives scrolling and reflow without the caller
 *   listening for either. This is the common case and the reason it is not left
 *   to `{ x, y }`: a caller doing it by hand writes the two listeners this
 *   already runs, and usually forgets the second.
 * - `"pointer"` — the cursor. The pointer is one *source* of a target and not
 *   the target itself, which is why it is a word here rather than the absence
 *   of one.
 * - `"rest"` — the blobatar's own centre, held. The near-field ease takes the
 *   excursion to zero because there is no direction to look in at something you
 *   are already on, so the eyes glide to the middle over the same curve as
 *   everything else and stay. The idle glance stays stood down: this is a face
 *   deliberately not looking, which is a pose and not an absence.
 * - `null` — nothing. The eyes ease home *and* the idle saccade comes back, so
 *   the blobatar goes on living its own life with the driver attached and
 *   watching. This is where a driver starts: constructing one arms the layer
 *   and aims it at nothing, and it costs nothing until it is aimed — the eyes
 *   are already home, the stand-down is already zero, and the loop parks on its
 *   first frame. `null` is the empty target and it means the empty thing.
 *
 * `null` and `"rest"` are the pair worth reading twice, because "stop looking
 * at that" is genuinely two requests. A password field revealing its contents
 * wants `"rest"` — the joke is a face pointedly not reading your screen, and a
 * face that went back to glancing idly around the room would be telling the
 * truth about nothing. A tour that has finished pointing at things wants
 * `null`, because the creature should go back to being a creature.
 *
 * Neither is `stop()`, which is teardown: it removes every listener and both
 * properties, and the eyes snap rather than glide.
 */
export type GazeTarget =
  | { x: number; y: number }
  | Element
  | "pointer"
  | "rest"
  | null;

export interface GazeOptions {
  /** Pursuit time constant in ms. Defaults to `SETTLE`. */
  settle?: number;
  /** Saccade threshold in units of the excursion. Defaults to `SNAP`. */
  snap?: number;
  /**
   * What to watch. Defaults to `null`, which is nothing.
   *
   * Sugar for constructing the driver already aimed, and `lookAt` is the same
   * seam afterwards taking the same union. `gaze(svg, { target: "pointer" })`
   * is the cursor-following blobatar most pages want, and it is spelled out
   * rather than assumed: constructing a driver arms the layer, and what it
   * looks at is the caller's to say. A default that started following the
   * pointer would make the one member of the union nobody had to ask for the
   * one that moves the eyes.
   *
   * **The likeliest way to end up with a face that never moves is now two
   * things rather than one.** `--mo-track-travel` is registered at `0px`, so a
   * page that loads `gaze.css` and sets the excursion nowhere has a driver
   * running and no eyes moving; a driver that was never aimed is the same
   * symptom from the other side. Both are visible from the call site, which is
   * the trade: nothing happens implicitly, so nothing happens by accident
   * either.
   */
  target?: GazeTarget;
}

/** A running gaze. */
export interface Gaze {
  /**
   * Point the eyes at something. See `GazeTarget` for the five things that
   * something can be.
   *
   * The pointer is one *source* of a target and not the target itself, which is
   * the whole shape of this seam: it takes a point, an element, or one of the
   * two words, and everything downstream is the same arithmetic either way.
   *
   * It also settles what the pointer leaving the window means while something
   * else is being watched: nothing. A target that is present because the caller
   * says so does not stop being present because the cursor went to another
   * window.
   */
  lookAt: (t: GazeTarget) => void;
  /**
   * Re-measure the box.
   *
   * Scroll, resize and the element's own resizes are already watched. This is
   * for the host that moved it some other way, and for a caller who knows the
   * layout settled before any observer will say so.
   */
  remeasure: () => void;
  /** Teardown. Removes every listener and both properties. */
  stop: () => void;
}

/**
 * Start the gaze on one blobatar.
 *
 * `el` is the element whose box is measured, normally the `<svg>`. The
 * properties are written to `.mo-eyes` inside it when there is one, because
 * that is the element the stylesheet reads them on and writing higher is an
 * invalidation of the blobatar's whole subtree every frame for a value three of
 * its elements use. `apps/demo` measured that at n=200: 31fps writing to
 * `.mo-root`, 40fps writing to the eyes. The JS was never the bill, at 0.2ms
 * against frames of 40ms and up. It is what the writes provoke afterwards.
 */
export function gaze(el: SVGSVGElement, opts: GazeOptions = {}): Gaze {
  /*
   * Both guards are the ones `motion.css` already applies to the idle layer,
   * and they are guards rather than degradations because there is nothing to
   * degrade to: gaze with no pointer is not a reduced gaze, it is nothing.
   *
   * `prefers-reduced-motion` is the stronger of the two. Continuous motion that
   * chases the cursor is close to the top of the list of things that setting
   * exists to turn off.
   *
   * Watched rather than sampled once. Reading `.matches` at construction and
   * never again means a person turning the setting on mid-session keeps the
   * motion they just asked to be rid of until they reload, which is not what
   * the setting promises. Both queries are live, so the driver attaches and
   * detaches as they change.
   */
  const fine = matchMedia("(hover: hover) and (pointer: fine)");
  const still = matchMedia("(prefers-reduced-motion: reduce)");

  const settle = opts.settle ?? SETTLE;
  const snap = opts.snap ?? SNAP;

  let cx = 0;
  let cy = 0;
  let radius = 1;
  /** Rendered width, for turning the threshold into something actually seen. */
  let width = 1;
  /** The excursion, read back off the stylesheet rather than restated here. */
  let travelPx = 0;

  let px = -1e6;
  let py = -1e6;
  let x = 0;
  let y = 0;
  let wx = 0;
  let wy = 0;
  /**
   * How far the idle glance has stood down for the gaze, 0 to 1.
   *
   * Two systems aim one pair of eyes at different things: the saccade roves on
   * its own clock and this points at the pointer, and with both live the eyes
   * read as unable to decide. `gaze.css` damps the rove's seeds by this, so it
   * is at full amplitude before the driver attaches and gone once it has, with
   * a cross-fade in between rather than a switch.
   *
   * A single-blobatar driver has no gate, so this is simply "is the driver
   * running", ramped on the same exponential the excursion uses because a
   * blobatar handing its eyes over should do it at the speed it takes them. A
   * host driving a field computes its own from its falloff and writes the
   * channel itself.
   */
  let h = 0;
  let wh = 0;
  let last = 0;
  let raf = 0;
  let dirty = false;
  let on = false;

  /**
   * What the eyes are pointed at, split into the two questions a frame asks.
   *
   * `at` is a resolved client coordinate or `null` for "the pointer", and
   * `resting` overrides both with this blobatar's own centre. Between them that
   * is the only thing the aim arithmetic below needs to know. `hold` carries
   * the rest: whether the idle glance stays stood down, which is the only thing
   * `"rest"` and `null` disagree about. Every member of `GazeTarget` is one of
   * those combinations, and holding them as state rather than as a mode enum is
   * what stops the frame loop growing a branch per member.
   *
   * `watched` is the element behind `at` when the target was one, kept because
   * its box has to be read again every time this driver re-reads its own.
   */
  let at: { x: number; y: number } | null = null;
  let watched: Element | null = null;
  /** Whether the target is this blobatar's own centre, which is `"rest"` and
      `null` both. Held as a flag rather than as a resolved point, so a resting
      blobatar that scrolls goes on resting instead of drifting off the centre
      it was measured at. */
  let resting = false;
  /** Where the stand-down is heading: 1 while the driver owns the eyes, 0 once
      it has let go. See `h`. */
  let hold = 1;

  /**
   * Where the excursion goes. Resolved once rather than per frame: a
   * `querySelector` inside the loop would put a DOM traversal per frame back in
   * exactly the place this is trying to take work out of.
   */
  let target: SVGElement | SVGSVGElement = el;

  /**
   * The two eyes, and where they rest on the sphere.
   *
   * Measured off the DOM rather than emitted by the renderer, which is the
   * whole reason this layer costs no markup: `getBBox` on each eye and on the
   * body group is the geometry `layout()` already put there, read back in the
   * one place that needs it. A per-eye custom property in `parts.inner` would
   * be two more declarations on every animated blobatar on the page, gazing or
   * not, to tell the driver something it can see.
   */
  let eyes: SVGGraphicsElement[] = [];
  let marks: Mark[] = [];
  /** The face's radius on each axis, in viewBox units. */
  let frx = 50;
  let fry = 50;
  /** And the turn one unit of aim produces about each, in radians. */
  let yaw = 0;
  let pitch = 0;

  /**
   * Where each eye sits on the sphere, and the head they turn on.
   *
   * The measurement is `survey()`, shared with anything else that has to agree
   * with this driver about where an eye rests, so there is one bisection and
   * one answer. A blobatar with no layout box yet leaves the marks as they
   * were, and the next measure picks them up.
   */
  const face = () => {
    const f = survey(el);
    if (!f) return;
    marks = f.marks;
    frx = f.rx;
    fry = f.ry;
  };

  const resolve = () => {
    target = el.querySelector<SVGElement>(".mo-eyes") ?? el;
    eyes = [...el.querySelectorAll<SVGGraphicsElement>(".mo-eye")];
    face();
  };

  /**
   * Re-read the watched element's centre.
   *
   * Called from `measure`, so it rides on exactly the events that already move
   * this driver's own box: scroll, resize, and the `ResizeObserver` — which
   * `start` points at the watched element too, so an element that changes size
   * without the page moving is caught as well. That is the whole argument for
   * `Element` being in the union: it is this call and one `observe`, against
   * every caller otherwise writing the same two listeners by hand.
   *
   * What it does not catch is an element moved by something none of those fire
   * for, a sibling collapsing above it inside a stable box being the usual one.
   * `remeasure()` is the seam for that, and it is the same seam the driver
   * already documents for its own box.
   */
  const follow = () => {
    if (!watched) return;
    const r = watched.getBoundingClientRect();
    at = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };

  const measure = () => {
    follow();
    const r = el.getBoundingClientRect();
    cx = r.left + r.width / 2;
    cy = r.top + r.height / 2;
    /* `min`, not the width: a non-square box's near field is set by the
       smaller axis, which is the one the pointer can be inside on. */
    radius = Math.max(1, Math.min(r.width, r.height) / 2);
    width = Math.max(1, r.width);
    travelPx =
      parseFloat(getComputedStyle(target).getPropertyValue("--mo-track-travel")) || 0;
    /* The silhouette is in viewBox units, so it does not move when the page
       does: it is surveyed once, on attach, and this is only the retry for a
       blobatar that had no layout box yet when the driver reached it. */
    if (!marks.length) face();
    /* The excursion as an angle: `travel` is the arc a mark at the centre of
       the face sweeps, so the turn is that arc over the radius — one per axis,
       because the radii differ. An eye off the middle covers less than that,
       which is the differential rather than a shortfall. */
    yaw = travelPx / frx;
    pitch = travelPx / fry;
  };

  const frame = (t: number) => {
    raf = 0;
    /* Clamped, so a tab returning from the background resolves in one step
       rather than with a `dt` measured in seconds. */
    const dt = last ? Math.min(t - last, 64) : 16;
    last = t;

    /*
     * The subtree may have been replaced since the last frame, and nothing
     * tells the driver so. The adapters hand `parts.inner` to
     * `dangerouslySetInnerHTML`, which React rewrites wholesale whenever it
     * changes — and it changes with the *name*, because the geometry does. The
     * `<svg>` survives, so the callback ref never fires, and the driver is left
     * holding `.mo-eyes` and both `.mo-eye`s from the blobatar that used to be
     * there. It goes on writing to them perfectly, into a detached tree nobody
     * is rendering, and the eyes on screen never move again.
     *
     * That is the hero of `blobatar.dev` after one keystroke, which is the
     * whole interaction the page exists for. A boolean read per frame buys
     * back the geometry the moment it is replaced, and the re-survey is paid
     * only on the frames where the blobatar actually changed.
     */
    if (!target.isConnected) {
      resolve();
      measure();
      /*
       * And the write cache has to go with it. `wx`/`wy` are what was last
       * written *to the old element*, so a pointer that has not moved since
       * leaves every difference under the threshold and the new eyes are never
       * written to at all — the same dead face, arrived at one step later.
       */
      wx = wy = Infinity;
    }

    const k = pursuit(dt, settle);
    /*
     * The one place the pointer is privileged, and only as a default.
     *
     * `"rest"` and `null` are the centre, and they are not a third branch here:
     * aiming at your own centre is `dx = dy = 0`, which the near-field ease
     * already resolves to an excursion of zero because there is no direction to
     * look in at something you are already on. The two words differ in `hold`,
     * below, and in nothing else.
     */
    const s = step({
      x,
      y,
      dx: resting ? 0 : (at ? at.x : px) - cx,
      dy: resting ? 0 : (at ? at.y : py) - cy,
      radius,
      k,
      snap,
    });
    x = s.x;
    y = s.y;

    const eps = threshold(width, travelPx);

    let moved = false;
    if (Math.abs(s.tx - x) <= eps && Math.abs(s.ty - y) <= eps) {
      x = s.tx;
      y = s.ty;
    } else {
      moved = true;
    }

    /* On the same exponential and the same arrival rule. `HOLD_EPS` is coarser
       than `eps` by an order of magnitude and deliberately so: this scales the
       rove's seeds, and a 1% change in the amplitude of a glance nobody is
       watching for is not a thing anyone can see.

       It runs toward `hold` rather than toward 1, which is what makes letting
       go a motion instead of an edit: `lookAt(null)` walks this back down the
       same curve it came up, so the idle saccade fades in over the time it
       takes the eyes to reach the middle rather than snapping on the moment
       they are released. */
    h += (hold - h) * k;
    if (Math.abs(hold - h) <= HOLD_EPS) h = hold;
    else moved = true;

    if (Math.abs(h - wh) > HOLD_EPS) {
      wh = h;
      /*
       * On `el` and not on `target`, and the nesting is the whole reason.
       * `.mo-eyes` is a descendant of `.mo-root`, custom properties inherit
       * downward only, and the rule this feeds damps `--mo-look-*` on
       * `.mo-root`: written to the eyes it would be invisible to the only
       * element that reads it, and the stand-down would silently never happen.
       * The excursion above has no such constraint because it is read on the
       * eyes themselves.
       *
       * It is also the cheap channel to put higher up. `HOLD_EPS` is an order
       * of magnitude coarser than `eps`, and the ramp runs once when the driver
       * attaches and then never again, so this is a handful of writes in total
       * against the excursion's every frame. The invalidation argument that
       * keeps the excursion off the root is an argument about per-frame writes.
       */
      el.style.setProperty("--mo-track-hold", h.toFixed(3));
      moved = true;
    }

    if (Math.abs(x - wx) > eps || Math.abs(y - wy) > eps) {
      wx = x;
      wy = y;
      /* Still written, and still the layer's public channel: a host hanging
         anything of its own on where the eyes are pointing reads these, and
         they are the two the entry point documents. The geometry below is the
         library's own use of them, already projected. */
      target.style.setProperty("--mo-track-x", x.toFixed(3));
      target.style.setProperty("--mo-track-y", y.toFixed(3));
      for (let i = 0; i < marks.length && i < eyes.length; i++) {
        const p = project(marks[i]!, x * yaw, y * pitch);
        const n = i + 1;
        /* Back into viewBox units from fractions of each radius, because that
           is what the stylesheet adds them to. */
        target.style.setProperty(`--mo-gz-dx${n}`, (p.dx * frx).toFixed(3));
        target.style.setProperty(`--mo-gz-dy${n}`, (p.dy * fry).toFixed(3));
        target.style.setProperty(`--mo-gz-sx${n}`, p.sx.toFixed(4));
        target.style.setProperty(`--mo-gz-sy${n}`, p.sy.toFixed(4));
        target.style.setProperty(`--mo-gz-t${n}`, p.t.toFixed(3));
      }
      moved = true;
    }

    /*
     * Park once the eyes have settled. A still pointer over a settled blobatar
     * schedules no frames at all, so leaving this on costs nothing while nobody
     * is moving, which is most of the time a page is open.
     */
    if (moved || dirty) {
      dirty = false;
      raf = requestAnimationFrame(frame);
    } else {
      last = 0;
    }
  };

  const wake = () => {
    if (!on) return;
    dirty = true;
    if (!raf) raf = requestAnimationFrame(frame);
  };

  const onMove = (e: PointerEvent) => {
    px = e.clientX;
    py = e.clientY;
    wake();
  };

  /*
   * The pointer leaving the window is a state and not just an absence: the eyes
   * return to centre rather than holding their last glance at an edge. Parking
   * it far outside gives that for free, because the near-field ease is what
   * brings them home and it does not care which direction "away" is.
   */
  const onLeave = () => {
    px = -1e6;
    py = -1e6;
    wake();
  };

  /*
   * Scroll and resize are most of what moves the face under a still pointer,
   * and they are the reason the centre is cached rather than measured per
   * frame: one `getBoundingClientRect` per scroll event beats one per pointer
   * move, and the pointer moves far more often.
   */
  const onGeom = () => {
    measure();
    wake();
  };

  /*
   * The rest of what moves it, and the reason this is not left to those two.
   * Neither fires for a reflow inside a stable window: a webfont swapping in
   * above the blobatar, an image resolving its intrinsic size, a layout
   * settling after hydration. A driver holding a stale centre through one of
   * those aims at where the face used to be. That failure hides at a distance,
   * where the direction to a centre 40px off is nearly the right one, and only
   * shows up close, which is the worst way for it to show up.
   */
  const resized = new ResizeObserver(onGeom);

  const start = () => {
    if (on) return;
    on = true;
    resolve();
    measure();
    resized.observe(el);
    if (watched) resized.observe(watched);
    addEventListener("pointermove", onMove, { passive: true });
    addEventListener("pointerleave", onLeave, { passive: true });
    addEventListener("scroll", onGeom, { passive: true, capture: true });
    addEventListener("resize", onGeom, { passive: true });
    wake();
  };

  const halt = () => {
    if (!on) return;
    on = false;
    resized.disconnect();
    removeEventListener("pointermove", onMove);
    removeEventListener("pointerleave", onLeave);
    removeEventListener("scroll", onGeom, { capture: true });
    removeEventListener("resize", onGeom);
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
    /* Released rather than left at the last glance: the initial value is 0, so
       the stylesheet puts the eyes back where it would have without a driver. */
    x = y = wx = wy = h = wh = 0;
    target.style.removeProperty("--mo-track-x");
    target.style.removeProperty("--mo-track-y");
    /* The projection has no registered initial value to fall back to — these
       are substituted, not interpolated — so removing them is what hands the
       eyes back to the fallbacks in `gaze.css`, which are the identity. Left
       behind, a detached driver would freeze a turned, foreshortened pair in
       as a constant offset on a blobatar that is no longer looking at
       anything. */
    for (let i = 1; i <= eyes.length; i++)
      for (const k of ["dx", "dy", "sx", "sy", "t"])
        target.style.removeProperty(`--mo-gz-${k}${i}`);
    el.style.removeProperty("--mo-track-hold");
  };

  /** Whichever way the queries moved, this is the state they imply. */
  const sync = () => (fine.matches && !still.matches ? start() : halt());

  fine.addEventListener("change", sync);
  still.addEventListener("change", sync);
  sync();

  /**
   * The one place a `GazeTarget` is turned into the state the frame loop reads.
   *
   * A setter rather than a value read per frame. A settled blobatar runs no
   * frames, so a driver that only *read* its target would never notice one
   * being set. The pointer moving is what keeps the loop alive for every other
   * input, and this one is set by code rather than by a hand.
   *
   * The element is duck-typed rather than `instanceof Element`, which is not
   * pedantry: an element from another document — an `<iframe>`, a template
   * cloned across realms — is a real element and fails that test, and the
   * failure would be silent, since it falls through to the point branch and
   * reads `undefined` coordinates as `NaN`.
   *
   * It is the *element* that is sniffed for and not the point, which looks
   * backwards and is the way round that survives this library's own domain:
   * `"x" in t` would be shorter and would take an `<svg><rect>` — a perfectly
   * ordinary thing to want the eyes to watch — down the point branch, where its
   * `x` is an `SVGAnimatedLength` rather than a number and every frame after
   * that is `NaN`.
   */
  const aim = (t: GazeTarget) => {
    if (watched && on) resized.unobserve(watched);
    watched = at = null;
    resting = t === null || t === "rest";
    /* The whole difference between a face deliberately not looking and a face
       handed back to its own idle life. Everything else about the two is
       identical, down to the curve they travel home on. */
    hold = t === null ? 0 : 1;
    /* The two lines above have already handled every word and `null`, so what
       survives this is an object, and an object is an element or a point. */
    if (typeof t !== "object" || !t) return;

    if ("getBoundingClientRect" in t) {
      watched = t;
      if (on) resized.observe(t);
      follow();
      return;
    }

    /* Copied rather than held. A caller keeping one object and mutating it
       would otherwise be re-aiming the driver without a `lookAt`, on whichever
       frame happened to read it, which is a target that moves without anyone
       saying so. */
    at = { x: t.x, y: t.y };
  };

  aim(opts.target ?? null);

  return {
    lookAt: (t) => {
      aim(t);
      wake();
    },
    remeasure: onGeom,
    stop: () => {
      halt();
      fine.removeEventListener("change", sync);
      still.removeEventListener("change", sync);
    },
  };
}
