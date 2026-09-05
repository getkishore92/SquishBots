var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// core/resolve.mjs
import { createHash, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// core/vendor/blobatar/animate.ts
function motionSeeds(t) {
  const blink = Math.round(t.num("motion.blink", 3500, 6500));
  const saccade = Math.round(t.num("motion.saccade", 4200, 7600));
  const lookX = t.num("motion.lookX", 1, 2.2);
  const lookY = t.num("motion.lookY", 0.8, 1.7);
  const r22 = (v) => Math.round(v * 100) / 100;
  return {
    phase: Math.round(t.num("motion.phase", 0, 2800)),
    bob: Math.round(t.num("motion.bob", 0, 3400)),
    blink,
    blinkPhase: Math.round(t.num("motion.blinkPhase", 0, blink)),
    saccade,
    saccadePhase: Math.round(t.num("motion.saccadePhase", 0, saccade)),
    lookX: r22(lookX) * (t.bool("motion.lookXFlip") ? -1 : 1),
    lookY: r22(lookY) * (t.bool("motion.lookYFlip") ? -1 : 1),
    lookMX: r22(lookX),
    lookMY: r22(lookY)
  };
}

// core/vendor/blobatar/color.ts
function toLinear({ l, c, h }) {
  const r = h * Math.PI / 180;
  const a = c * Math.cos(r);
  const b = c * Math.sin(r);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const L = l_ * l_ * l_;
  const M = m_ * m_ * m_;
  const S = s_ * s_ * s_;
  return [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S
  ];
}
var inGamut = (rgb) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);
function resolve(color) {
  let rgb = toLinear(color);
  if (!inGamut(rgb)) {
    let lo = 0;
    let hi = color.c;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(toLinear({ ...color, c: mid }))) lo = mid;
      else hi = mid;
    }
    rgb = toLinear({ ...color, c: lo });
  }
  return rgb.map((v) => Math.min(1, Math.max(0, v)));
}
function luminance(color) {
  const [r, g, b] = resolve(color);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
function ensureContrast(fg, bg, min) {
  if (contrast(fg, bg) >= min) return fg;
  const lean = fg.l >= bg.l ? 1 : -1;
  for (const dir of [lean, -lean]) {
    const probe = { ...fg };
    for (let i = 0; i < 60; i++) {
      probe.l = Math.min(1, Math.max(0, probe.l + dir * 0.02));
      if (contrast(probe, bg) >= min) return probe;
      if (probe.l === 0 || probe.l === 1) break;
    }
  }
  const black = { ...fg, l: 0, c: 0 };
  const white = { ...fg, l: 1, c: 0 };
  return contrast(black, bg) >= contrast(white, bg) ? black : white;
}
function toHex(color) {
  return "#" + resolve(color).map((v) => {
    const s = v <= 31308e-7 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    return Math.round(s * 255).toString(16).padStart(2, "0");
  }).join("");
}
function fromHex(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [n >> 16 & 255, n >> 8 & 255, n & 255].map((v) => {
    const s2 = v / 255;
    return s2 <= 0.04045 ? s2 / 12.92 : Math.pow((s2 + 0.055) / 1.055, 2.4);
  });
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return {
    l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    c: Math.hypot(A, B),
    h: Math.atan2(B, A) * 180 / Math.PI
  };
}
function mix(a, b, t) {
  const rad = (v) => v * Math.PI / 180;
  const ax = a.c * Math.cos(rad(a.h));
  const ay = a.c * Math.sin(rad(a.h));
  const bx = b.c * Math.cos(rad(b.h));
  const by = b.c * Math.sin(rad(b.h));
  const x = ax + (bx - ax) * t;
  const y = ay + (by - ay) * t;
  return {
    l: a.l + (b.l - a.l) * t,
    c: Math.hypot(x, y),
    h: Math.atan2(y, x) * 180 / Math.PI
  };
}
var mixHex = (a, b, t) => toHex(mix(fromHex(a), fromHex(b), t));
var HOT = { h: 27, l: 0.58, pull: 0.6, c: 0.18 };
var ROSE = { h: 358, l: 0.72, pull: 0.55, c: 0.16 };
var BLUSH = { h: 12, l: 0.84, pull: 0.4, c: 0.1 };
var BILE = { h: 142, l: 0.66, pull: 0.6, c: 0.13 };
var TINT_FLOOR = 4.55;
function tinted(head, eye, t) {
  const base = fromHex(head);
  const baseEye = fromHex(eye);
  let hotHead = {
    l: base.l + (t.l - base.l) * t.pull,
    c: Math.max(base.c, t.c),
    h: t.h
  };
  hotHead = ensureContrast(hotHead, DARK_SURFACE, SURFACE_FLOOR);
  let hotEye = ensureContrast(baseEye, hotHead, TINT_FLOOR);
  const dir = hotEye.l >= hotHead.l ? 1 : -1;
  const headHex = toHex(hotHead);
  for (let pass = 0; pass < 40; pass++) {
    const eyeHex = toHex(hotEye);
    let worst = Infinity;
    for (let i = 0; i <= 10; i++) {
      const t2 = i / 10;
      worst = Math.min(
        worst,
        contrast(
          fromHex(mixHex(eye, eyeHex, t2)),
          fromHex(mixHex(head, headHex, t2))
        )
      );
    }
    if (worst >= TINT_FLOOR) return [headHex, eyeHex];
    const l = Math.min(1, Math.max(0, hotEye.l + dir * 0.02));
    if (l === hotEye.l) return [headHex, eyeHex];
    hotEye = { ...hotEye, l };
  }
  return [headHex, toHex(hotEye)];
}
var TONES = [
  [0.2, { l: 0.86, c: 0.085 }],
  // pastel
  [0.36, { l: 0.9, c: 0.028 }],
  // pale neutral
  [0.62, { l: 0.73, c: 0.135 }],
  // mid
  [0.8, { l: 0.62, c: 0.165 }],
  // deep
  [0.93, { l: 0.87, c: 0.16 }],
  // bright
  // Dark, but not darker than a dark host surface. At l 0.17 this swatch scored
  // 1.03:1 against a near-black page and the body simply vanished, leaving two
  // floating eyes. l 0.34 still reads as the ink tone and clears both ends.
  [1, { l: 0.34, c: 0.035 }]
  // ink
];
var toneAt = (v) => TONES.find(([edge]) => v < edge)?.[1] ?? TONES[0][1];
var DARK_SURFACE = { l: 0.145, c: 0, h: 0 };
var SURFACE_FLOOR = 1.5;
var RAMP = (h, tone) => {
  const t = toneAt(tone);
  const head = ensureContrast({ l: t.l, c: t.c, h }, DARK_SURFACE, SURFACE_FLOOR);
  return {
    bg: { l: 0.965, c: 0.01, h },
    head,
    // Polarity follows the body: dark eyes on a light body, light eyes on a
    // dark one. Without this the ink tone would render an invisible face.
    eye: head.l >= 0.5 ? { l: 0.17, c: 0.02, h } : { l: 0.97, c: 0.012, h }
  };
};
var FLOORS = [
  ["head", "bg", 1.25],
  ["eye", "head", 4.5]
];
function ramp(hue, enforce = true, tone = 0) {
  const r = RAMP(hue, tone);
  if (enforce) {
    for (const [fg, bg, min] of FLOORS) {
      r[fg] = ensureContrast(r[fg], r[bg], min);
    }
  }
  return r;
}
function palette(hue, enforce = true, tone = 0) {
  const r = ramp(hue, enforce, tone);
  const out = {};
  for (const k in r) out[k] = toHex(r[k]);
  return out;
}

// core/vendor/blobatar/shape.ts
var r2 = (v) => {
  const s = Math.round(v * 100) / 100;
  return Object.is(s, -0) ? "0" : String(s);
};
function superellipse({ cx, cy, rx, ry, n = 4, rot = 0 }) {
  const k = Math.min(1, (8 * Math.pow(2, -1 / n) - 4) / 3);
  const a = rx;
  const b = ry;
  const ak = a * k;
  const bk = b * k;
  const pts = [
    [a, 0],
    [a, bk],
    [ak, b],
    [0, b],
    [-ak, b],
    [-a, bk],
    [-a, 0],
    [-a, -bk],
    [-ak, -b],
    [0, -b],
    [ak, -b],
    [a, -bk],
    [a, 0]
  ];
  const t = rot * Math.PI / 180;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  const at = (i) => {
    const [x, y] = pts[i];
    return `${r2(cx + x * cos - y * sin)} ${r2(cy + x * sin + y * cos)}`;
  };
  let d = `M${at(0)}`;
  for (let i = 1; i < 13; i += 3) d += `C${at(i)} ${at(i + 1)} ${at(i + 2)}`;
  return d + "Z";
}
function blobPath(cx, cy, rx, ry, radii, rot = 0) {
  const n = radii.length;
  const t0 = rot * Math.PI / 180;
  const p = radii.map((m, i) => {
    const a = t0 + 2 * Math.PI * i / n;
    return [cx + rx * m * Math.cos(a), cy + ry * m * Math.sin(a)];
  });
  const at = (i) => p[(i % n + n) % n];
  let d = `M${r2(at(0)[0])} ${r2(at(0)[1])}`;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = at(i - 1);
    const [x1, y1] = at(i);
    const [x2, y2] = at(i + 1);
    const [x3, y3] = at(i + 2);
    d += `C${r2(x1 + (x2 - x0) / 6)} ${r2(y1 + (y2 - y0) / 6)} ${r2(x2 - (x3 - x1) / 6)} ${r2(y2 - (y3 - y1) / 6)} ${r2(x2)} ${r2(y2)}`;
  }
  return d + "Z";
}
function polygon({ cx, cy, rx, ry, sides, round: round2 = 0.3, rot = 0 }) {
  const k = round2 > 0 ? round2 < 1 ? round2 / 2 : 0.5 : 0;
  const t0 = rot * Math.PI / 180 - Math.PI / 2;
  const v = Array.from({ length: sides }, (_, i) => {
    const a = t0 + 2 * Math.PI * i / sides;
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
  });
  const at = (i) => v[(i % sides + sides) % sides];
  const cut = (i, j) => {
    const [x0, y0] = at(i);
    const [x1, y1] = at(j);
    return `${r2(x0 + (x1 - x0) * k)} ${r2(y0 + (y1 - y0) * k)}`;
  };
  let d = `M${cut(0, -1)}`;
  for (let i = 0; i < sides; i++) {
    const [x, y] = at(i);
    d += `Q${r2(x)} ${r2(y)} ${cut(i, i + 1)}`;
    if (k < 0.5) d += `L${cut(i + 1, i)}`;
  }
  return d + "Z";
}
function box(cx, cy, rx, ry) {
  const l = r2(cx - rx);
  const r = r2(cx + rx);
  return `M${l} ${r2(cy - ry)}H${r}V${r2(cy + ry)}H${l}Z`;
}
function taper(cx, cy, rx, ry, tip) {
  const t = Math.max(1.05, tip);
  const tx = rx * Math.sqrt(1 - 1 / (t * t));
  const ty = cy - ry / t;
  const apex = cy - t * ry;
  const px = tx * 0.14;
  const py = ty + 0.86 * (apex - ty);
  return `M${r2(cx - tx)} ${r2(ty)}L${r2(cx - px)} ${r2(py)}Q${r2(cx)} ${r2(apex)} ${r2(cx + px)} ${r2(py)}L${r2(cx + tx)} ${r2(ty)}Z`;
}

// core/vendor/blobatar/hash.ts
var SEP = 255;
function feed(h, bytes) {
  for (let i = 0; i < bytes.length; i++) {
    h = Math.imul(h ^ bytes[i], 3432918353);
    h = h << 13 | h >>> 19;
  }
  return h;
}
function finalize(h) {
  h = Math.imul(h ^ h >>> 16, 2246822507);
  h = Math.imul(h ^ h >>> 13, 3266489909);
  return (h ^ h >>> 16) >>> 0;
}
var utf8 = new TextEncoder();
function normalizeSeed(seed) {
  return seed.normalize("NFC").trim().toLowerCase();
}
function seedState(seed, normalize = true) {
  const s = normalize ? normalizeSeed(seed) : seed;
  return feed(1779033703 ^ s.length, utf8.encode(s));
}
function stream(state, key) {
  return finalize(feed(feed(state, Uint8Array.of(SEP)), utf8.encode(key))) / 4294967296;
}

// core/vendor/blobatar/traits.ts
function traits(seed, normalize = true, overrides) {
  const state = seedState(seed, normalize);
  const t = ((key) => {
    const v = overrides?.[key];
    const o = Array.isArray(v) ? v[Math.floor(stream(state, key) * v.length)] : v;
    return o === void 0 ? stream(state, key) : o > 0 ? o < 1 ? o : 0.999999 : 0;
  });
  t.num = (key, min, max) => min + t(key) * (max - min);
  t.int = (key, min, max) => min + Math.floor(t(key) * (max - min + 1));
  t.pick = (key, options) => options[Math.floor(t(key) * options.length)];
  t.bool = (key, p = 0.5) => t(key) < p;
  t.jitter = (key, amount) => (t(key) * 2 - 1) * amount;
  return t;
}

// core/vendor/blobatar/render.ts
function posed(l, opts, animate) {
  const e = opts.expression;
  if (animate || !e) return { l, wrap: "" };
  return e.bake(l, e.p);
}
var tinted2 = (p, e) => e?.tint ? e.tint(p, e.p) : p;
var wrap = (body, t) => t ? `<g transform="${t}">${body}</g>` : body;
var escape = (s) => s.replace(
  /[&<>]/g,
  (c) => c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;"
);
function resolve2(seed, opts) {
  const t = traits(seed, opts.normalize ?? true, opts.traits);
  return {
    t,
    palette: {
      ...palette(
        opts.hue ?? t.num("hue", 0, 360),
        opts.contrast ?? true,
        opts.tone ?? t("tone")
      ),
      ...opts.palette
    }
  };
}
var label = (opts) => opts.title ? `<title>${escape(opts.title)}</title>` : "";
function backdrop(style2, opts, p) {
  const bg = opts.background ?? style2.background;
  if (bg === false) return void 0;
  return {
    d: bg === "square" ? "M0 0H100V100H0Z" : superellipse({
      cx: 50,
      cy: 50,
      rx: 50,
      ry: 50,
      n: bg === "circle" ? 2 : 6
    }),
    // `Palette` is partial because each style fills only the slots it needs,
    // but every ramp in `color.ts` fills `bg` — and a backdrop with no colour
    // is not a thing this can be asked to draw.
    fill: p.bg
  };
}
var plate = (b) => b ? `<path d="${b.d}" fill="${b.fill}"/>` : "";
function makeBlobatar(style2) {
  return (name, opts = {}) => {
    const { t, palette: palette2 } = resolve2(name, opts);
    const p = tinted2(palette2, opts.expression);
    const dim = opts.size ? ` width="${opts.size}" height="${opts.size}"` : "";
    const pose = posed(style2.layout(t), opts);
    const body = label(opts) + plate(backdrop(style2, opts, p)) + wrap(style2.render(pose.l, p), pose.wrap);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"${dim}>${body}</svg>`;
  };
}

// core/vendor/blobatar/styles/compose.ts
var faceFit = (t, b, face) => {
  const rx = b.rx;
  const er0 = t.num("eye.rx", 0.075, 0.105) * rx;
  const ratio = t.num("eye.ratio", 1.9, 3.2);
  const scale = t.num("eye.scale", 0.78, 1.24);
  const stretch = t.num("eye.stretch", 0.85, 1.18);
  const clearance = t.num("eye.gap", 0.1, 0.24) * rx;
  const wide = er0 * Math.max(1, scale);
  const tall = er0 * ratio * Math.max(1, scale * stretch);
  const gap0 = wide + rx * 0.03 + clearance;
  const gx = t.jitter("gaze.x", 0.09) * face.rx;
  const gy = t.num("gaze.y", -0.2, 0.08) * face.ry;
  const dy = t.jitter("eye.dy", 0.04) * face.ry;
  const reach = Math.hypot(wide, tall);
  const need = Math.hypot(
    (Math.abs(gx) + gap0 + reach) / face.rx,
    (Math.abs(gy) + Math.abs(dy) + reach) / face.ry
  );
  const fit = need > 0.9 ? 0.9 / need : 1;
  const er = er0 * fit;
  const eyeRy = er * ratio;
  const gap = gap0 * fit;
  const room = Math.max(0, Math.min(1, clearance / tall));
  const bound = Math.min(12, Math.asin(room) * 180 / Math.PI);
  const lean = t.num("eye.lean", -1, 1) * bound;
  const lean2 = Math.max(-12, Math.min(12, lean + t.jitter("eye.lean2", 3.5)));
  const cx = face.cx + gx * fit;
  const cy = face.cy + gy * fit;
  return [
    { cx: cx - gap, cy, rx: er, ry: eyeRy, n: t.num("eye.n", 3.5, 6), rot: lean },
    {
      cx: cx + gap,
      cy: cy + dy * fit,
      rx: er * scale,
      ry: eyeRy * scale * stretch,
      n: t.num("eye.n", 3.5, 6),
      rot: lean2
    }
  ];
};
function compose(bands, fit) {
  const pick = (v) => (bands.find(([, upTo]) => v < upTo) ?? bands[bands.length - 1])[0];
  function layout(t) {
    const shape = pick(t("shape"));
    const r = t.num("body.r", 31, 38) * shape.core;
    const body = {
      cx: 50 + t.jitter("body.x", 1.5),
      cy: 50 + t.jitter("body.y", 1.5),
      rx: r,
      ry: r * t.num("body.ratio", 0.92, 1.08),
      n: t.num("body.n", 1.9, 2.5),
      rot: 0,
      radii: Array.from({ length: t.int("body.pts", 6, 8) }, (_, i) => 1 + t.jitter(`body.r${i}`, 0.16))
    };
    shape.body?.(t, body);
    const face = shape.face?.(body) ?? body;
    const deco = { petals: [], extra: [] };
    shape.decorate?.(t, body, deco);
    return {
      shape: shape.name,
      draw: shape.path,
      body,
      face,
      petals: deco.petals,
      extra: deco.extra,
      eyes: fit(t, body, face)
    };
  }
  function render(l, p, mo) {
    const r22 = (v) => Math.round(v * 100) / 100;
    const eye = (e, i) => {
      const path = `<path d="${superellipse(e)}"/>`;
      return mo ? `<g class="mo-eye" style="--mo-wrap:${i ? 1 : -1};--mo-lean:${r22(e.rot)};transform-origin:${r22(e.cx)}px ${r22(e.cy)}px">${path}</g>` : path;
    };
    const body = `<g fill="${p.head}">` + l.petals.map((d) => `<circle cx="${r22(d.cx)}" cy="${r22(d.cy)}" r="${r22(d.r)}"/>`).join("") + l.extra.map((d) => `<path d="${d}"/>`).join("") + `<path d="${l.draw ? l.draw(l.body) : superellipse(l.body)}"/></g><g fill="${p.eye}"${mo ? ` class="mo-eyes"` : ""}>` + l.eyes.map(eye).join("") + `</g>`;
    return mo ? `<g class="mo-breathe"><g class="mo-bob">${body}</g></g>` : body;
  }
  return { layout, render, background: false };
}
function marks(l, p) {
  const r22 = (v) => Math.round(v * 100) / 100;
  const head = p.head;
  return [
    ...l.petals.map((d) => ({ kind: "circle", cx: r22(d.cx), cy: r22(d.cy), r: r22(d.r), fill: head })),
    ...l.extra.map((d) => ({ kind: "path", d, fill: head })),
    { kind: "path", d: l.draw ? l.draw(l.body) : superellipse(l.body), fill: head },
    ...l.eyes.map((e) => ({ kind: "path", d: superellipse(e), fill: p.eye }))
  ];
}

// core/vendor/blobatar/styles/shapes.ts
var poly = (b) => polygon(b);
var spline = (b) => blobPath(b.cx, b.cy, b.rx, b.ry, b.radii, b.rot);
var shrunk = (k) => (b) => ({
  cx: b.cx,
  cy: b.cy,
  rx: b.rx * k,
  ry: b.ry * k
});
var splineFace = (b) => shrunk(Math.min(...b.radii) * 0.95)(b);
var polyFace = (b) => shrunk(0.84)(b);
var round = { name: "round", core: 1 };
var organic = {
  name: "organic",
  core: 0.98,
  path: spline,
  face: splineFace
};
var boxy = {
  name: "boxy",
  core: 0.86,
  body: (t, b) => {
    b.n = t.num("body.n", 3.4, 6);
    b.rot = t.num("body.rot", -20, 20);
  }
};
var capsule = {
  name: "capsule",
  core: 1.02,
  body: (t, b) => {
    b.ry *= t.num("capsule.squat", 0.55, 0.68);
  },
  face: shrunk(0.94),
  decorate: (_t, b, out) => {
    for (const s of [-1, 1]) out.petals.push({ cx: b.cx + s * (b.rx - b.ry), cy: b.cy, r: b.ry });
  },
  path: (b) => box(b.cx, b.cy, b.rx - b.ry, b.ry)
};
var nub = {
  name: "nub",
  core: 0.88,
  decorate: (t, b, out) => {
    const count = t.int("nub.n", 1, 2);
    for (let i = 0; i < count; i++) {
      const a = t.num(`nub.a${i}`, 0, 2 * Math.PI);
      out.petals.push({
        cx: b.cx + Math.cos(a) * b.rx * 0.88,
        cy: b.cy + Math.sin(a) * b.rx * 0.88,
        r: b.rx * t.num(`nub.r${i}`, 0.24, 0.4)
      });
    }
  }
};
var cloud = {
  name: "cloud",
  core: 0.78,
  face: splineFace,
  path: spline,
  decorate: (t, b, out) => {
    const count = t.int("cloud.n", 4, 6);
    for (let i = 0; i < count; i++) {
      const a = Math.PI + Math.PI * (i + 0.5) / count;
      out.petals.push({
        cx: b.cx + Math.cos(a) * b.rx * 0.8,
        cy: b.cy + Math.sin(a) * b.rx * 0.5,
        r: b.rx * t.num(`cloud.r${i}`, 0.44, 0.62)
      });
    }
  }
};
var droplet = {
  name: "droplet",
  core: 0.78,
  // Shifted down by what the taper adds above, so the whole silhouette — head
  // and point together — sits centred in the frame rather than the head alone.
  // `n` is pinned to a true ellipse, which is the curve the taper is tangent to.
  body: (_t, b) => {
    b.cy += 0.22 * b.ry;
    b.n = 2;
  },
  face: (b) => ({ cx: b.cx, cy: b.cy + b.ry * 0.05, rx: b.rx * 0.88, ry: b.ry * 0.88 }),
  decorate: (t, b, out) => {
    out.extra.push(taper(b.cx, b.cy, b.rx, b.ry, t.num("droplet.tip", 1.4, 1.65)));
  }
};
var hexagon = {
  name: "hexagon",
  core: 1.05,
  path: poly,
  face: polyFace,
  body: (t, b) => {
    b.sides = 6;
    b.rot = t.num("body.rot", -12, 12);
    b.round = t.num("poly.round", 0.24, 0.5);
  }
};
function localPath(b, commands) {
  let axis = 0;
  return commands.map((v) => {
    if (typeof v === "string") {
      axis = 0;
      return v;
    }
    return String((axis++ % 2 ? b.cy + v * b.ry : b.cx + v * b.rx).toFixed(3));
  }).join(" ");
}
var ghost = { name: "ghost", core: 0.88, face: shrunk(0.7), body: (_t, b) => {
  b.n = 2;
  b.rot = 0;
}, path: (b) => localPath(b, [
  "M",
  -1,
  0.72,
  "C",
  -0.96,
  0.2,
  -1,
  -0.38,
  -0.68,
  -0.77,
  "C",
  -0.36,
  -1.14,
  0.36,
  -1.14,
  0.68,
  -0.77,
  "C",
  1,
  -0.38,
  0.96,
  0.2,
  1,
  0.72,
  "Q",
  0.96,
  1.02,
  0.71,
  0.79,
  "Q",
  0.47,
  0.58,
  0.25,
  0.87,
  "Q",
  0,
  1.1,
  -0.25,
  0.87,
  "Q",
  -0.47,
  0.58,
  -0.71,
  0.79,
  "Q",
  -0.96,
  1.02,
  -1,
  0.72,
  "Z"
]) };
var monster = { name: "monster", core: 0.86, face: shrunk(0.7), body: (_t, b) => {
  b.n = 2;
  b.rot = 0;
}, path: (b) => {
  const p = [[-0.96, -0.3], [-0.84, -1.28], [-0.39, -0.73], [0, -0.86], [0.39, -0.73], [0.84, -1.28], [0.96, -0.3], [1, 0.35], [0.65, 0.88], [0, 1], [-0.65, 0.88], [-1, 0.35]];
  const mid = (a, c) => [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
  const out = ["M", ...mid(p.at(-1), p[0])];
  for (let i = 0; i < p.length; i++) out.push("Q", ...p[i], ...mid(p[i], p[(i + 1) % p.length]));
  out.push("Z");
  return localPath(b, out);
} };
var triangle = {
  name: "triangle",
  core: 1.15,
  path: poly,
  body: (t, b) => {
    b.sides = 3;
    b.rot = t.num("body.rot", -5, 5);
    b.round = t.num("poly.round", 0.24, 0.5);
  },
  face: (b) => ({ cx: b.cx, cy: b.cy + b.ry * 0.1, rx: b.rx * 0.54, ry: b.ry * 0.36 })
};

// core/vendor/blobatar/styles/blob.ts
var BANDS = [
  [round, 0.22],
  [organic, 0.48],
  [boxy, 0.6],
  [capsule, 0.7],
  [nub, 0.79],
  [cloud, 0.86],
  [droplet, 0.915],
  [hexagon, 0.95],
  [ghost, 0.97],
  [monster, 0.985],
  [triangle, 1]
];
var style = compose(BANDS, faceFit);

// core/vendor/blobatar/blobatar.ts
var blobatar = makeBlobatar(style);
function _marks(name, opts = {}) {
  const { t, palette: palette2 } = resolve2(name, opts);
  const p = tinted2(palette2, opts.expression);
  const pose = posed(style.layout(t), opts);
  return {
    // Outside the pose wrap, matching `makeBlobatar`. A plate that leans and
    // scales with the creature stops being a plate.
    bg: backdrop(style, opts, p),
    transform: pose.wrap,
    marks: marks(pose.l, p)
  };
}
function _layout(name, opts = {}) {
  const { t, palette: palette2 } = resolve2(name, opts);
  const l = style.layout(t);
  const e = opts.expression;
  const posed2 = e ? e.bake(l, e.p).l : l;
  return {
    // Tinted here too, so a colour assertion can read the same numbers the
    // static renderer paints rather than the ramp they came from.
    palette: e?.tint ? e.tint(palette2, e.p) : palette2,
    ...posed2
  };
}

// core/vendor/blobatar/expression.ts
var expression_exports = {};
__export(expression_exports, {
  bakePose: () => bakePose,
  happy: () => happy,
  heatTint: () => heatTint,
  idle: () => idle,
  love: () => love,
  mad: () => mad,
  poseVars: () => poseVars,
  sad: () => sad,
  scared: () => scared,
  shy: () => shy,
  sick: () => sick,
  sleepy: () => sleepy,
  smug: () => smug,
  surprised: () => surprised,
  thinking: () => thinking,
  tintWith: () => tintWith,
  unsure: () => unsure,
  wink: () => wink
});

// core/vendor/blobatar/morph.ts
var IDENT = {
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
  bdy: 0
};
var r3 = (v) => String(Math.round(v * 1e3) / 1e3);
function bakePose(l, p) {
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
        rot: e.rot * (1 - p.lock) + (p.tilt + (i ? p.tilt2 : 0)) * (i ? 1 : -1)
      }))
    },
    wrap: p.bdy !== 0 ? `translate(0 ${r3(p.bdy)})` : ""
  };
}

// core/vendor/blobatar/expression.ts
function poseVars(p) {
  const out = {};
  for (const k in IDENT) {
    if (k === "heat") continue;
    const v = p[k];
    if (v !== IDENT[k]) out["--mo-" + k] = r3(v);
  }
  return out;
}
function tintWith(pal, p, t) {
  const [head, eye] = tinted(pal.head, pal.eye, t);
  return {
    ...pal,
    head: mixHex(pal.head, head, p.heat),
    eye: mixHex(pal.eye, eye, p.heat)
  };
}
var heatTint = (pal, p) => tintWith(pal, p, HOT);
var idle = { p: IDENT, vars: poseVars, bake: bakePose };
var happy = {
  p: {
    esx: 1.72,
    esy: 0.3,
    tilt: 8,
    edy: -1.5,
    edx: 1.5,
    // A touch of asymmetry, well short of a wink. The pair reads as *drawn*
    // rather than as stamped twice, which is the whole reason the channel
    // exists — see `docs/references/asymmetric.png` for the loud version.
    esx2: 0.08,
    esy2: 0.05,
    tilt2: -16,
    edy2: 0,
    lock: 1,
    heat: 0,
    shake: 0,
    rock: 0,
    bdy: -2.2
  },
  vars: poseVars,
  bake: bakePose
};
var sad = {
  p: {
    esx: 0.6,
    esy: 0.56,
    tilt: 26,
    edy: 3.6,
    edx: 1.9,
    esx2: -0.05,
    esy2: -0.07,
    tilt2: -7,
    edy2: 0,
    lock: 1,
    heat: 0,
    shake: 0,
    rock: 0,
    bdy: 2.6
  },
  vars: poseVars,
  bake: bakePose
};
var mad = {
  p: {
    esx: 1.85,
    esy: 0.26,
    tilt: -33,
    edy: 0.4,
    edx: 0.6,
    esx2: 0,
    esy2: -0.03,
    tilt2: 5,
    edy2: 0,
    lock: 1,
    heat: 0.62,
    shake: 0.55,
    rock: 0,
    bdy: 0.8
  },
  vars: poseVars,
  bake: bakePose,
  tint: heatTint
};
var surprised = {
  p: {
    esx: 1.34,
    esy: 1.2,
    tilt: -6,
    edy: -1.05,
    edx: 0.5,
    esx2: 0.05,
    esy2: 0.07,
    tilt2: 3,
    edy2: 0,
    lock: 1,
    heat: 0,
    shake: 0,
    rock: 0,
    bdy: -1.4
  },
  vars: poseVars,
  bake: bakePose
};
var wink = {
  p: {
    esx: 1.32,
    esy: 0.76,
    tilt: 5,
    edy: -0.6,
    edx: 0.8,
    esx2: 0.26,
    esy2: -0.56,
    tilt2: -11,
    edy2: 0,
    lock: 1,
    heat: 0,
    shake: 0,
    rock: 0,
    bdy: -1.1
  },
  vars: poseVars,
  bake: bakePose
};
var sleepy = {
  p: {
    esx: 1.14,
    esy: 0.22,
    tilt: 0,
    edy: 2.4,
    edx: 0.3,
    esx2: -0.04,
    esy2: 0.03,
    tilt2: 4,
    edy2: 0,
    lock: 1,
    heat: 0,
    shake: 0,
    rock: 0,
    bdy: 1.2
  },
  vars: poseVars,
  bake: bakePose
};
var smug = {
  p: {
    esx: 1.3,
    esy: 0.42,
    tilt: 18,
    edy: -0.5,
    edx: 0.5,
    esx2: 0.06,
    esy2: -0.06,
    tilt2: -36,
    edy2: 0,
    lock: 1,
    heat: 0,
    shake: 0,
    rock: 0,
    bdy: -1
  },
  vars: poseVars,
  bake: bakePose
};
var unsure = {
  p: {
    esx: 0.95,
    esy: 1.02,
    tilt: 4,
    edy: -0.2,
    edx: 0.3,
    esx2: 0.24,
    esy2: -0.44,
    tilt2: -18,
    edy2: 0,
    lock: 1,
    heat: 0,
    shake: 0,
    rock: 0,
    bdy: 0
  },
  vars: poseVars,
  bake: bakePose
};
var scared = {
  p: {
    esx: 0.78,
    esy: 0.96,
    tilt: -12,
    edy: -1.5,
    edx: -0.8,
    esx2: -0.04,
    esy2: 0.05,
    tilt2: 4,
    edy2: 0,
    lock: 1,
    heat: 0,
    shake: 0.35,
    rock: 0,
    bdy: -0.6
  },
  vars: poseVars,
  bake: bakePose
};
var love = {
  p: {
    esx: 0.86,
    esy: 1.28,
    tilt: -14,
    edy: -0.5,
    edx: -0.35,
    esx2: 0.05,
    esy2: 0.06,
    tilt2: 6,
    edy2: 0,
    lock: 1,
    heat: 0.6,
    shake: 0,
    rock: 0,
    bdy: -1.6
  },
  vars: poseVars,
  bake: bakePose,
  tint: (pal, p) => tintWith(pal, p, ROSE)
};
var shy = {
  p: {
    esx: 0.62,
    esy: 0.5,
    tilt: 10,
    edy: 1.4,
    edx: -0.2,
    esx2: -0.05,
    esy2: -0.04,
    tilt2: -8,
    edy2: 0,
    lock: 1,
    heat: 0.55,
    shake: 0,
    rock: 0,
    bdy: 0.9
  },
  vars: poseVars,
  bake: bakePose,
  tint: (pal, p) => tintWith(pal, p, BLUSH)
};
var sick = {
  p: {
    esx: 1.25,
    esy: 0.34,
    tilt: 20,
    edy: 1.8,
    edx: 0.8,
    esx2: 0.05,
    esy2: -0.05,
    tilt2: -6,
    edy2: 0,
    lock: 1,
    heat: 0.6,
    shake: 0.18,
    rock: 0,
    bdy: 1.4
  },
  vars: poseVars,
  bake: bakePose,
  tint: (pal, p) => tintWith(pal, p, BILE)
};
var thinking = {
  p: {
    esx: 1.15,
    esy: 0.62,
    tilt: 0,
    edy: 4.2,
    edx: 0.4,
    esx2: 0.02,
    esy2: 0.06,
    tilt2: 0,
    edy2: -8.4,
    lock: 1,
    heat: 0,
    shake: 0,
    rock: 0.8,
    bdy: -0.4
  },
  vars: poseVars,
  bake: bakePose
};

// core/resolve.mjs
var SOURCE = { version: "2.7.0", commit: "ebb7ea4808b1263629fc8fa65e2398b9cbdb6f6b" };
var MATERIAL_DEFAULTS = {
  resin: { preset: "resin", roughness: 0.22, textureScale: 24, textureStrength: 0 },
  clay: { preset: "clay", roughness: 0.78, textureScale: 35, textureStrength: 0.045 },
  fur: { preset: "fur", roughness: 0.75, textureScale: 30, textureStrength: 0.1, furLength: 0.075, furDensity: 12e3 },
  glass: { preset: "glass", roughness: 0.06, textureScale: 24, textureStrength: 0 }
};
var MATERIAL_PRESETS = Object.keys(MATERIAL_DEFAULTS);
var EXPRESSION_NAMES = ["idle", "happy", "sad", "mad", "surprised", "wink", "sleepy", "smug", "unsure", "scared", "love", "shy", "sick", "thinking"];
var object = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
var finite = (v) => typeof v === "number" && Number.isFinite(v);
function assert(ok, message) {
  if (!ok) throw new TypeError(message);
}
function validateConfig(input) {
  assert(object(input), "Config must be an object");
  assert(typeof input.seed === "string", "seed must be a string");
  assert(input.seed.length <= 4096, "seed is too long");
  const c = structuredClone(input), o = c.options ??= {};
  assert(object(o), "options must be an object");
  if (o.size !== void 0) assert(Number.isInteger(o.size) && o.size > 0 && o.size <= 4096, "size must be an integer 1..4096");
  if (o.title !== void 0) assert(typeof o.title === "string" && o.title.length <= 4096, "title must be a string up to 4096 characters");
  if (o.animate !== void 0) assert(["hover", "always"].includes(o.animate), "animate must be hover or always");
  if (o.traits !== void 0) {
    assert(object(o.traits), "traits must be an object");
    for (const [k, v] of Object.entries(o.traits)) assert(finite(v) || Array.isArray(v) && v.length <= 256 && v.every(finite), `Invalid trait ${k}`);
  }
  for (const k of ["hue", "tone"]) if (o[k] !== void 0) assert(finite(o[k]), `${k} must be finite`);
  for (const k of ["normalize", "contrast"]) if (o[k] !== void 0) assert(typeof o[k] === "boolean", `${k} must be boolean`);
  if (o.background !== void 0) assert([true, false, "square", "circle", "squircle"].includes(o.background), "Invalid background");
  if (o.palette !== void 0) {
    assert(object(o.palette), "palette must be an object");
    for (const [k, v] of Object.entries(o.palette)) assert(["head", "eye", "bg"].includes(k) && typeof v === "string" && /^#[\da-f]{6}$/i.test(v), "Palette colors must be six-digit hex for Blender");
  }
  if (o.expression !== void 0) assert(EXPRESSION_NAMES.includes(o.expression), "Unknown expression");
  if (c.status !== void 0) assert(["online", "away", "offline", "thinking", "none"].includes(c.status), "Unknown status");
  if (c.badge !== void 0) assert(Number.isInteger(c.badge) && c.badge >= 0, "badge must be a nonnegative integer");
  const m = c.material ??= { preset: "resin" };
  assert(object(m), "material must be an object");
  assert(MATERIAL_PRESETS.includes(m.preset), "Unknown material preset");
  const bounds = { roughness: [0, 1], textureScale: [0.1, 100], textureStrength: [0, 1], furLength: [1e-3, 0.3], furDensity: [100, 5e4] };
  for (const [key, value] of Object.entries(m)) {
    if (key === "preset") continue;
    assert(Object.hasOwn(bounds, key), `Unknown material property ${key}`);
    const [min, max] = bounds[key];
    assert(finite(value) && value >= min && value <= max, `${key} must be ${min}..${max}`);
    if (key === "furDensity") assert(Number.isInteger(value), "furDensity must be an integer");
  }
  c.material = { ...MATERIAL_DEFAULTS[m.preset], ...m };
  const r = c.render ??= {};
  assert(object(r), "render must be an object");
  if (r.transparent !== void 0) assert(typeof r.transparent === "boolean", "transparent must be boolean");
  if (r.resolution !== void 0) assert(Number.isInteger(r.resolution) && r.resolution >= 64 && r.resolution <= 4096, "resolution must be 64..4096");
  if (r.samples !== void 0) assert(Number.isInteger(r.samples) && r.samples >= 1 && r.samples <= 4096, "samples must be 1..4096");
  if (r.depth !== void 0) assert(finite(r.depth) && r.depth > 0 && r.depth <= 2, "Invalid depth");
  if (r.roughness !== void 0) {
    assert(finite(r.roughness) && r.roughness >= 0 && r.roughness <= 1, "Invalid roughness");
    if (!Object.hasOwn(input.material ?? {}, "roughness")) c.material.roughness = r.roughness;
  }
  return c;
}
function canonical(value) {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (object(value)) return "{" + Object.keys(value).sort().map((k) => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
  return JSON.stringify(value);
}
function renderOptions(config) {
  const options = config.options;
  let palette2 = options.palette;
  if (palette2?.head && palette2.eye === void 0) {
    const luminance2 = (hex) => {
      const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    };
    const head = luminance2(palette2.head), softWhite = "#f5f5f2", dark = "#111318";
    const contrast2 = (hex) => {
      const eye = luminance2(hex);
      return (Math.max(head, eye) + 0.05) / (Math.min(head, eye) + 0.05);
    };
    palette2 = { ...palette2, eye: contrast2(softWhite) > contrast2(dark) ? softWhite : dark };
  }
  return { ...options, ...palette2 ? { palette: palette2 } : {}, expression: expression_exports[options.expression ?? "idle"] };
}
function resolveConfig(input) {
  const config = validateConfig(input), opts = renderOptions(config);
  const layout = _layout(config.seed, opts), { marks: marks2, transform, bg } = _marks(config.seed, opts);
  const body = marks2.slice(0, -2), eyes = marks2.slice(-2);
  const baseOpts = { ...opts, expression: idle };
  const baseLayout = _layout(config.seed, baseOpts), baseMarks = _marks(config.seed, baseOpts).marks;
  const motion = { reactionPoses: { press: happy.p, drag: surprised.p, edge: scared.p }, seeds: motionSeeds(traits(config.seed, opts.normalize ?? true, opts.traits)), pose: opts.expression.p, baseLayout, baseMarks, baseColors: { head: baseLayout.palette.head, eye: baseLayout.palette.eye, bg: baseLayout.palette.bg } };
  return {
    schemaVersion: 1,
    source: SOURCE,
    name: config.seed,
    seed: config.seed,
    config,
    configHash: createHash("sha256").update(canonical({ source: SOURCE, config })).digest("hex"),
    shape: layout.shape,
    marks: marks2,
    transform,
    bg,
    layout,
    motion,
    bodyPaths: body.filter((m) => m.kind === "path").map((m) => m.d),
    bodyCircles: body.filter((m) => m.kind === "circle"),
    eyes,
    colors: { head: layout.palette.head, eye: layout.palette.eye, bg: layout.palette.bg },
    status: config.status ?? "none",
    badge: config.badge ?? 0,
    material: config.material,
    render: { ...config.render, depth: config.render.depth ?? 0.95 * Math.min(layout.body.rx, layout.body.ry) / 32 }
  };
}
function referenceSvg(config) {
  const c = validateConfig(config);
  return blobatar(c.seed, renderOptions(c));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [input, output, svg] = process.argv.slice(2);
  if (!input) throw new Error("Usage: node core/resolve.mjs config.json [resolved.json] [reference.svg]");
  const config = JSON.parse(readFileSync(input, "utf8"));
  const result = JSON.stringify(resolveConfig(config), null, 2) + "\n";
  if (output) writeFileSync(output, result);
  else process.stdout.write(result);
  if (svg) writeFileSync(svg, referenceSvg(config));
}

// core/catalog.mjs
var shapeRows = [["round", 0.11], ["organic", 0.35], ["boxy", 0.54], ["capsule", 0.65], ["nub", 0.745], ["cloud", 0.825], ["droplet", 0.888], ["hexagon", 0.933], ["ghost", 0.96], ["monster", 0.978], ["triangle", 0.995]];
var toneRows = [["pastel", 0.1], ["pale", 0.28], ["mid", 0.49], ["deep", 0.71], ["bright", 0.865], ["ink", 0.965]];
var choice = ([id, value]) => ({ id, label: id, value, name: id, at: value });
var control = (key, label2, group, kind = "slider", when, bands) => ({ key, label: label2, group, kind, ...when ? { when } : {}, ...bands ? { bands } : {} });
var controls = [
  control("shape", "Silhouette", "shape", "shape"),
  control("body.r", "Size", "body"),
  control("body.ratio", "Proportion", "body"),
  control("body.n", "Squareness", "body"),
  control("body.rot", "Tilt", "body", "slider", ["boxy", "triangle", "hexagon"]),
  control("eye.rx", "Size", "eyes"),
  control("eye.ratio", "Roundness", "eyes"),
  control("eye.n", "Squareness", "eyes"),
  control("eye.gap", "Separation", "eyes"),
  control("eye.lean", "Lean", "eyes"),
  control("gaze.x", "Gaze x", "eyes"),
  control("gaze.y", "Gaze y", "eyes"),
  control("tone", "Tone", "color", "tone"),
  control("hue", "Hue", "color"),
  control("cloud.n", "Lobes", "decoration", "slider", ["cloud"], 3),
  control("nub.n", "Nubs", "decoration", "slider", ["nub"], 2),
  control("nub.a0", "Nub angle", "decoration", "slider", ["nub"]),
  control("nub.r0", "Nub size", "decoration", "slider", ["nub"]),
  control("capsule.squat", "Squat", "body", "slider", ["capsule"]),
  control("poly.round", "Corner rounding", "body", "slider", ["triangle", "hexagon"]),
  control("droplet.tip", "Tip length", "decoration", "slider", ["droplet"])
];
var allKeys = [
  "shape",
  "hue",
  "tone",
  "body.r",
  "body.ratio",
  "body.x",
  "body.y",
  "body.n",
  "body.rot",
  "body.pts",
  ...Array.from({ length: 8 }, (_, i) => `body.r${i}`),
  "gaze.x",
  "gaze.y",
  "eye.rx",
  "eye.ratio",
  "eye.scale",
  "eye.stretch",
  "eye.gap",
  "eye.n",
  "eye.lean",
  "eye.lean2",
  "eye.dy",
  "cloud.n",
  ...Array.from({ length: 6 }, (_, i) => `cloud.r${i}`),
  "nub.n",
  "nub.a0",
  "nub.a1",
  "nub.r0",
  "nub.r1",
  "poly.round",
  "capsule.squat",
  "droplet.tip"
];
var curated = new Set(controls.map((c) => c.key));
var advancedControls = allKeys.filter((key) => !curated.has(key)).map((key) => {
  let when;
  if (/^body\.(pts|r\d)$/.test(key)) when = ["organic", "cloud"];
  if (key.startsWith("cloud.")) when = ["cloud"];
  if (key.startsWith("nub.")) when = ["nub"];
  return control(key, key, "advanced", "slider", when, key === "body.pts" ? 3 : void 0);
});
var CATALOG = {
  sourceVersion: "2.7.0",
  materialDefaults: MATERIAL_DEFAULTS,
  materialPresets: MATERIAL_PRESETS,
  shapes: shapeRows.map(choice),
  tones: toneRows.map(choice),
  groups: ["shape", "body", "eyes", "color", "decoration"],
  controls,
  axes: controls,
  allKeys,
  traitKeys: allKeys,
  advancedControls,
  expressions: [...EXPRESSION_NAMES],
  traitPosition: { min: 0, max: 0.999, step: 1e-3 },
  background: [false, "square", "circle", "squircle"],
  statuses: ["none", "online", "away", "offline", "thinking"]
};
function getTraitValues(input) {
  const config = validateConfig(input), o = config.options;
  const reader = traits(config.seed, o.normalize ?? true, o.traits);
  const values = Object.fromEntries(allKeys.map((key) => [key, reader(key)]));
  if (o.hue !== void 0) values.hue = (o.hue % 360 + 360) % 360 / 360;
  if (o.tone !== void 0) values.tone = o.tone >= 0 && o.tone < 1 ? o.tone : 0;
  return values;
}
export {
  CATALOG,
  getTraitValues,
  referenceSvg,
  resolveConfig
};
