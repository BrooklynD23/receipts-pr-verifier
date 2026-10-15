// Receipts — proof of checking. A countertop verifier: a printed diff slip
// feeds in, a reader arm sweeps its lines lighting six check lamps; a clean
// slip advances under an interlocked stamp press and out to the accept tray;
// a sabotaged slip trips the flag at its raised red line and is ejected into
// the reject bin. Framework-free: node build.mjs [--light] -> index[-light].html
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../.agents/skills/anatomy/kit/iso-kit.mjs";
import * as G from "../../../.agents/skills/anatomy/kit/lathe.mjs";
import { kitScript } from "../../../.agents/skills/anatomy/scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 660;
const HEIGHT = 420;

// ---- world ---------------------------------------------------------------
const BASE = { x: -140, y: -74, w: 300, d: 148, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

const DECK = { x: -52, y: -20, w: 104, d: 36, r: 2 }; // scan bed, z 0..6
const DECK_TOP = 6;
const PLATEN = { x: 52, y: -16, w: 34, d: 32, r: 2 }; // stamp deck, z 0..6
const BACK_RAIL = { x: -52, y: -20, w: 104, d: 4, r: 1 }; // on deck, z 6..10
const STUB_L = { x: -52, y: 15.5, w: 11, d: 4.5, r: 1 }; // front rail stubs, z 6..10
const STUB_R = { x: 41, y: 15.5, w: 11, d: 4.5, r: 1 };
const GUIDE = { x: -56, y: -26, w: 112, d: 4.5, r: 1 }; // reader guide rail, z 0..5

const SLIP_W = 64,
  SLIP_D = 26,
  SLIP_T = 0.7;
const ROWS = [-28, -21, -14, -7, 0, 7, 14, 21, 28]; // printed diff lines
const TRIP_X = 0; // sabotage line (index 4)
const LAMP_X = [-28, -17.5, -7, 3.5, 14, 24.5]; // where each check lamp fires
const HEAD_MIN = -38,
  HEAD_MAX = 38;

// slip poses: {x, y, z(top face), pitch(rotX), tilt(rotY)}
const SLIP_HOME = { x: -86, y: 0, z: 8.15 };
const SLIP_SCAN = { x: 0, y: 0, z: 6.75 };
const SLIP_STAMP = { x: 42, y: 0, z: 6.75 };
const SLIP_OUT = { x: 116, y: 3, z: 4.2 };
const SLIP_BIN = { x: 0, y: 47, z: 4.2 };

const TRAY = { x: -131, y: -19, w: 75, d: 38 }; // feed magazine, mouth at x -56..-52
const OUTTRAY = { x: 100, y: -16, w: 58, d: 32 }; // accept tray
const BIN = { x: -44, y: 36, w: 88, d: 32 }; // reject bin

const PANEL = { x: -40, y: -42, w: 80, d: 5, r: 1.5 }; // lamp board, z 8..34
const PRINTER = { x: 96, y: -58, w: 44, d: 26, r: 2.5 }; // tape box, z 0..16
const PRESS = { px: 66, py: -32 };
const RAM = { x: 66, y: -1 };
const STROKE = 6.25;

const P = k.fitProjection(
  [
    ...k.boxCorners(BASE, -PLATE_H - FOOT_H, 0),
    [PRESS.px, PRESS.py, 49],
    [118, -55, 47],
    [0, -40, 36],
    [0, 0, 20],
  ],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 50 },
);

const at = (pt) => k.iso(pt, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const slab = (plan, z, h, style, steps = 4, bevel = 0) =>
  S(k.slabOf(plan, z, h, P, steps, bevel), style);
const byDepth = (points) =>
  [...points].sort(
    (a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P),
  );
const deg = (a) => (a * Math.PI) / 180;
const quad = (pts) => k.pathOf(pts.map(at), true);

// slip local point -> world (rotX pitch, then rotY tilt, about the centre)
function slipPt(pose, lx, ly, lz) {
  const a = deg(pose.pitch || 0);
  let y = ly * Math.cos(a) - lz * Math.sin(a);
  let z = ly * Math.sin(a) + lz * Math.cos(a);
  const b = deg(pose.tilt || 0);
  const x = lx * Math.cos(b) + z * Math.sin(b);
  z = -lx * Math.sin(b) + z * Math.cos(b);
  return [pose.x + x, pose.y + y, pose.z + z];
}
const SLIP_TOP = [
  [-32, -13, 0],
  [32, -13, 0],
  [32, 13, 0],
  [-32, 13, 0],
];
const SLIP_EDGE_Y = [
  [-32, 13, 0],
  [32, 13, 0],
  [32, 13, -SLIP_T],
  [-32, 13, -SLIP_T],
];
const SLIP_EDGE_X = [
  [32, -13, 0],
  [32, 13, 0],
  [32, 13, -SLIP_T],
  [32, -13, -SLIP_T],
];
const MARK_Q = [
  [18.5, -8, 0.08],
  [29.5, -8, 0.08],
  [29.5, 8, 0.08],
  [18.5, 8, 0.08],
];
const MARK_T = [21, 3.5, 0.08, 23.4, -3, 0.08, 27.5, 5, 0.08];

const slipPaths = (pose, kind) => {
  const q = (corners) =>
    k.pathOf(
      corners.map((c) => at(slipPt(pose, ...c))),
      true,
    );
  const seg = (m) =>
    k.pathOf([
      at(slipPt(pose, m[0], m[1], m[2])),
      at(slipPt(pose, m[3], m[4], m[5])),
    ]);
  const rows = [],
    red = [];
  for (let i = 0; i < ROWS.length; i++) {
    const x = ROWS[i];
    const l1 = 13 + ((i * 7) % 6);
    const sabot = kind === "sabot" && i === 4;
    const marks = sabot
      ? [
          [0, -10, 0.05, 0, 6, 0.05],
          [0, 7.6, 0.05, 0, 10, 0.05],
        ]
      : [
          [x, -10, 0.05, x, -10 + l1, 0.05],
          [
            x,
            -10 + l1 + 1.6,
            0.05,
            x,
            Math.min(-10 + l1 + 1.6 + 1 + ((i * 5) % 3), 11),
            0.05,
          ],
        ];
    (sabot ? red : rows).push(...marks.map(seg));
  }
  return {
    top: q(SLIP_TOP),
    edge: q(SLIP_EDGE_Y) + q(SLIP_EDGE_X),
    rim: q(SLIP_TOP),
    rows: rows.join(""),
    red: red.join(""),
    perf: k.pathOf([
      at(slipPt(pose, -30.5, -12, 0.05)),
      at(slipPt(pose, -30.5, 12, 0.05)),
    ]),
    bumpF:
      kind === "sabot"
        ? q([
            [-0.7, 11, 0.55],
            [0.7, 11, 0.55],
            [0.7, 11, 0],
            [-0.7, 11, 0],
          ])
        : "",
    bumpO:
      kind === "sabot"
        ? q([
            [-0.7, -11, 0.55],
            [0.7, -11, 0.55],
            [0.7, 11, 0.55],
            [-0.7, 11, 0.55],
          ])
        : "",
    mark: q(MARK_Q) + seg(MARK_T),
  };
};
const slipMarkup = () => `
  <path data-f="edge" class="iso-fill" style="fill:var(--anatomy-shade-2)" d=""/>
  <path data-f="top" class="iso-fill" style="fill:var(--anatomy-lit-top)" d=""/>
  <path data-f="bumpF" class="iso-fill" style="fill:var(--anatomy-shade-1)" d=""/>
  <path data-f="rim" class="iso-line" data-tone="hi" d=""/>
  <path data-f="bumpO" class="iso-line" data-tone="red" d=""/>
  <path data-f="rows" class="iso-line" data-tone="mid" data-free="both" d=""/>
  <path data-f="red" class="iso-line" data-tone="red" data-free="both" d=""/>
  <path data-f="perf" class="iso-line" data-tone="faint" data-dashed data-free="both" d=""/>
  <path data-f="mark" class="iso-line" data-tone="green" data-free="both" d="" style="display:none"/>`;

const STATIC_SLIP = (pose, kind, marked = false) => {
  const p = slipPaths(pose, kind);
  return [
    `<path class="iso-fill" style="fill:var(--anatomy-shade-2)" d="${p.edge}"/>`,
    `<path class="iso-fill" style="fill:var(--anatomy-lit-top)" d="${p.top}"/>`,
    kind === "sabot"
      ? `<path class="iso-fill" style="fill:var(--anatomy-shade-1)" d="${p.bumpF}"/>`
      : "",
    `<path class="iso-line" data-tone="hi" d="${p.rim}"/>`,
    kind === "sabot"
      ? `<path class="iso-line" data-tone="red" d="${p.bumpO}"/>`
      : "",
    `<path class="iso-line" data-tone="mid" data-free="both" d="${p.rows}"/>`,
    kind === "sabot"
      ? `<path class="iso-line" data-tone="red" data-free="both" d="${p.red}"/>`
      : "",
    `<path class="iso-line" data-tone="faint" data-dashed data-free="both" d="${p.perf}"/>`,
    marked
      ? `<path class="iso-line" data-tone="green" data-free="both" d="${p.mark}"/>`
      : "",
  ].join("");
};

// ---- static figure ---------------------------------------------------------
function base() {
  const out = [
    `<path class="iso-halo" d="${k.haloOf(BASE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`,
  ];
  for (const [x, y] of byDepth(k.corners(BASE, 22))) {
    out.push(
      S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }),
    );
    out.push(
      S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), {
        tone: "mid",
      }),
    );
  }
  out.push(slab(BASE, -PLATE_H, PLATE_H, { tone: "mid" }, 8, 1.6));
  out.push(L(k.planOutline(k.insetPlan(BASE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(BASE, 10);
  out.push(
    L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), {
      tone: "lo",
    }),
  );
  out.push(
    D(
      screws.map(([x, y]) => at([x, y, 0])),
      { size: 0.5 },
    ),
  );
  // ruler strip on the base top, right of the reject bin
  const strip = { x: 52, y: 58, w: 96, d: 7, r: 1 };
  out.push(slab(strip, 0, 0.6, { tone: "lo", crease: "none" }, 3));
  const t = k.topTicks(
    strip.x + 4,
    strip.x + strip.w - 4,
    8,
    4,
    strip.y + 0.8,
    0.6,
    [2, 3.4],
    P,
  );
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  out.push(
    D(
      [
        at([strip.x + 2, strip.y + 3.5, 0.6]),
        at([strip.x + strip.w - 2, strip.y + 3.5, 0.6]),
      ],
      { size: 0.45 },
    ),
  );
  // label plate with the one engraved name
  const label = { x: -128, y: 44, w: 32, d: 12, r: 1.5 };
  out.push(slab(label, 0, 0.8, { tone: "mid" }, 4));
  out.push(
    L(k.planOutline(k.insetPlan(label, 1.6), 0.8, P), { tone: "faint" }),
  );
  out.push(
    k.faceTextSvg(
      k.topMatrix([label.x + 4, label.y + 8], 0.8, P, "x"),
      "RECEIPTS",
      { size: 2.6, tone: "mid" },
    ),
  );
  out.push(
    D(
      [
        at([label.x + 3, label.y + 3, 0.8]),
        at([label.x + label.w - 3, label.y + label.d - 3, 0.8]),
      ],
      { size: 0.45 },
    ),
  );
  return out.join("");
}

function inTray() {
  const out = [];
  const back = { x: TRAY.x, y: TRAY.y, w: TRAY.w, d: 5, r: 1.5 };
  const left = { x: TRAY.x, y: TRAY.y, w: 5, d: TRAY.d, r: 1.5 };
  const front = { x: TRAY.x, y: TRAY.y + TRAY.d - 5, w: TRAY.w, d: 5, r: 1.5 };
  const floor = { x: -121, y: -14, w: 69, d: 28, r: 1.5 }; // top z 6, level with the deck
  out.push(slab(floor, 5, 1, { tone: "lo" }, 3));
  out.push(slab(back, 0, 11, { tone: "mid" }, 4, 0.5));
  out.push(slab(left, 0, 11, { tone: "mid" }, 4, 0.5));
  out.push(
    STATIC_SLIP({ x: -88, y: -0.6, z: 6.75, pitch: 0, tilt: 0 }, "clean"),
  );
  out.push(
    STATIC_SLIP({ x: -86.4, y: 0.4, z: 7.45, pitch: 0, tilt: 0 }, "clean"),
  );
  out.push(slab(front, 0, 11, { tone: "mid" }, 4, 0.5));
  out.push(L(k.planOutline(k.insetPlan(floor, 3), 6, P, 3), { tone: "faint" }));
  out.push(
    D(
      [
        at([back.x + 6, back.y + 2.5, 11]),
        at([back.x + back.w - 6, back.y + 2.5, 11]),
        at([left.x + 2.5, left.y + 6, 11]),
        at([left.x + 2.5, left.y + left.d - 6, 11]),
        at([front.x + 8, front.y + 2.5, 11]),
        at([front.x + front.w - 8, front.y + 2.5, 11]),
      ],
      { size: 0.45 },
    ),
  );
  return out.join("");
}

function panel() {
  const out = [];
  for (const bx of [-34, 24]) {
    out.push(
      slab(
        { x: bx, y: -44, w: 10, d: 9, r: 1.5 },
        0,
        8,
        { tone: "mid" },
        4,
        0.4,
      ),
    );
    out.push(
      D([at([bx + 3, -41.5, 8]), at([bx + 7, -41.5, 8])], { size: 0.4 }),
    );
  }
  out.push(slab(PANEL, 8, 26, { tone: "mid" }, 6, 0.8));
  out.push(L(k.sideSeam(PANEL, 30, P, 6), { tone: "faint" }));
  const faceY = PANEL.y + PANEL.d; // -37, faces the viewer
  out.push(
    L(k.segment([-39.5, faceY, 20.5], [39.5, faceY, 20.5], P), {
      tone: "faint",
    }),
  );
  LAMP_X.forEach((lx, i) => {
    const x = -25 + i * 10;
    const [cx, cy] = at([x, faceY + 0.1, 26]);
    out.push(
      `<g data-lamp="${i}"><path class="iso-line" data-tone="lo" d="${k.sideRing([x, faceY + 0.1, 26], 2.8, "y", P)}"/><circle data-bulb cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="1.2" style="fill:var(--anatomy-faint)"/></g>`,
    );
  });
  const [tx, ty] = at([33, faceY + 0.1, 26]);
  out.push(
    `<g data-lamp="trip"><path class="iso-line" data-tone="lo" d="${k.sideRing([33, faceY + 0.1, 26], 2.8, "y", P)}"/><circle data-bulb cx="${tx.toFixed(1)}" cy="${ty.toFixed(1)}" r="1.2" style="fill:var(--anatomy-faint)"/></g>`,
  );
  out.push(D([at([-37, faceY, 12]), at([37, faceY, 12])], { size: 0.45 }));
  return out.join("");
}

function tapeGeom(len, rows) {
  const lean = 0.22,
    x0 = 101,
    x1 = 131,
    y0 = -48.5,
    z0 = 16.2;
  const P2 = (x, s) => at([x, y0 - s * lean, z0 + s]);
  const rim = k.pathOf([P2(x0, 0), P2(x1, 0), P2(x1, len), P2(x0, len)], true);
  const marks = [],
    holes = [];
  for (let s = 3; s < len - 1; s += 3) holes.push(P2(x0 + 4, s), P2(x1 - 4, s));
  for (let r = 0; r < rows; r++) {
    const s = len - 4 - r * 6;
    if (s < 3) break;
    marks.push(
      k.pathOf([P2(x0 + 8, s), P2(x0 + 15, s)]),
      k.pathOf([P2(x0 + 8, s + 1.6), P2(x0 + 20, s + 1.6)]),
      k.pathOf([P2(x0 + 8, s + 3.2), P2(x0 + 13, s + 3.2)]),
    );
    holes.push(P2(x1 - 6, s + 1.4));
  }
  return { rim, marks: marks.join(""), holes };
}
const tapeMarkup = (len, rows) => {
  const g = tapeGeom(len, rows);
  return `<path data-f="fill" class="iso-fill" style="fill:var(--anatomy-face)" d="${g.rim}"/><path data-f="rim" class="iso-line" data-tone="hi" d="${g.rim}"/><path data-f="rows" class="iso-line" data-tone="mid" data-free="both" d="${g.marks}"/><g data-f="holes" class="iso-dots" data-tone="lo">${g.holes.map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="0.5"/>`).join("")}</g>`;
};

function printer() {
  const out = [];
  out.push(slab(PRINTER, 0, 16, { tone: "mid" }, 6, 0.8));
  out.push(L(k.sideSeam(PRINTER, 12, P, 6), { tone: "faint" }));
  const slot = { x: 102, y: -52, w: 30, d: 6, r: 1.5 };
  out.push(L(k.planOutline(slot, 16, P, 4), { tone: "lo" }));
  out.push(
    L(k.planOutline(k.insetPlan(slot, 1.4), 16.01, P, 4), { tone: "faint" }),
  );
  out.push(
    D(
      [
        at([PRINTER.x + 4, PRINTER.y + 4, 16]),
        at([PRINTER.x + PRINTER.w - 4, PRINTER.y + 4, 16]),
        at([PRINTER.x + PRINTER.w - 4, PRINTER.y + PRINTER.d - 4, 16]),
      ],
      { size: 0.45 },
    ),
  );
  out.push(
    S(
      G.disc(
        -1.2,
        1.2,
        3,
        G.frameAlong(
          [PRINTER.x + 10, PRINTER.y + PRINTER.d + 0.6, 8],
          [0, 1, 0],
        ),
        P,
      ),
      { tone: "mid" },
    ),
  );
  out.push(`<g data-part="tape">${tapeMarkup(0, 0)}</g>`);
  return out.join("");
}

function pressPost() {
  const out = [];
  out.push(
    slab(
      { x: PRESS.px - 7, y: PRESS.py - 6, w: 14, d: 13, r: 1.5 },
      0,
      2.5,
      { tone: "mid" },
      4,
      0.4,
    ),
  );
  out.push(
    D(
      [
        at([PRESS.px - 4, PRESS.py - 3, 2.5]),
        at([PRESS.px + 4, PRESS.py - 3, 2.5]),
        at([PRESS.px + 4, PRESS.py + 3, 2.5]),
      ],
      { size: 0.4 },
    ),
  );
  out.push(
    slab(
      { x: PRESS.px - 4, y: PRESS.py - 3.5, w: 8, d: 7, r: 1.5 },
      2.5,
      37.5,
      { tone: "mid" },
      5,
      0.6,
    ),
  );
  out.push(
    L(
      k.segment(
        [PRESS.px - 4, PRESS.py + 3.4, 14],
        [PRESS.px + 4, PRESS.py + 3.4, 14],
        P,
      ),
      { tone: "faint" },
    ),
  );
  return out.join("");
}

function deck() {
  const out = [];
  out.push(slab(DECK, 0, DECK_TOP, { tone: "mid" }, 5, 0.6));
  out.push(slab(PLATEN, 0, DECK_TOP, { tone: "mid" }, 5, 0.6));
  out.push(
    L(k.segment([52, -16, DECK_TOP], [52, 16, DECK_TOP], P), { tone: "faint" }),
  );
  out.push(
    L(k.planOutline(k.insetPlan(DECK, 4), DECK_TOP, P, 4), { tone: "faint" }),
  );
  out.push(slab(BACK_RAIL, DECK_TOP, 4, { tone: "mid" }, 4, 0.4));
  out.push(D([at([-46, -18, 10]), at([46, -18, 10])], { size: 0.45 }));
  // ejector groove in the deck top
  out.push(
    L(k.planOutline({ x: -2, y: -15, w: 4, d: 30.5, r: 1 }, DECK_TOP, P, 4), {
      tone: "lo",
    }),
  );
  out.push(
    D(
      [
        at([DECK.x + 4, 12, DECK_TOP]),
        at([DECK.x + DECK.w - 4, -16, DECK_TOP]),
        at([PLATEN.x + PLATEN.w - 4, PLATEN.y + 4, DECK_TOP]),
        at([PLATEN.x + PLATEN.w - 4, PLATEN.y + PLATEN.d - 4, DECK_TOP]),
      ],
      { size: 0.45 },
    ),
  );
  // guide rail the reader arm rides on, with end stops and ruler ticks
  out.push(slab(GUIDE, 0, 5, { tone: "mid" }, 4, 0.4));
  out.push(
    slab({ x: -61, y: -27, w: 5, d: 6, r: 1.2 }, 0, 8, { tone: "mid" }, 3, 0.4),
  );
  out.push(
    slab({ x: 56, y: -27, w: 5, d: 6, r: 1.2 }, 0, 8, { tone: "mid" }, 3, 0.4),
  );
  const ticks = k.topTicks(-48, 48, 8, 4, -25.6, 5, [1.7, 2.9], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([-58.5, -24, 8]), at([58.5, -24, 8])], { size: 0.45 }));
  // cable junction block on the back rail
  out.push(
    slab({ x: 36, y: -20, w: 6, d: 4, r: 1 }, 10, 2.2, { tone: "mid" }, 3),
  );
  return out.join("");
}

const cable = () =>
  k.wireSvg(at([38, -37, 11]), at([39, -17.8, 12.4]), {
    via: [at([40, -30, 6.5])],
    tone: "lo",
    size: 1.1,
  });

// two feed rollers seated in slots, one at the tray mouth, one on the seam
function rollers() {
  const out = [];
  for (const [cx, slot] of [
    [-51.5, { x: -53.5, y: -15, w: 4, d: 30, r: 1 }],
    [52, { x: 50, y: -15, w: 4, d: 30, r: 1 }],
  ]) {
    out.push(
      `<path class="iso-fill" style="fill:var(--anatomy-shade-0)" d="${k.planOutline(slot, DECK_TOP - 0.14, P, 4)}"/>`,
    );
    out.push(
      S(G.disc(-14, 14, 3, G.frameAlong([cx, 0, 3], [0, 1, 0]), P), {
        tone: "mid",
      }),
    );
    out.push(
      S(G.disc(-15.4, -14, 3.5, G.frameAlong([cx, 0, 3], [0, 1, 0]), P), {
        tone: "lo",
      }),
    );
    out.push(
      S(G.disc(14, 15.4, 3.5, G.frameAlong([cx, 0, 3], [0, 1, 0]), P), {
        tone: "mid",
      }),
    );
    out.push(
      slab(
        { x: cx - 1.7, y: 14.2, w: 3.4, d: 3, r: 0.8 },
        DECK_TOP,
        1.8,
        { tone: "mid" },
        3,
      ),
    );
    out.push(
      slab(
        { x: cx - 1.7, y: -17.2, w: 3.4, d: 3, r: 0.8 },
        DECK_TOP,
        1.8,
        { tone: "mid" },
        3,
      ),
    );
  }
  return out.join("");
}

function apronAndBin() {
  const out = [];
  // bin back wall (the apron lip rests on it) + floor + one dumped slip
  out.push(
    slab(
      { x: BIN.x, y: BIN.y, w: BIN.w, d: 4, r: 1.5 },
      0,
      3,
      { tone: "mid" },
      4,
      0.3,
    ),
  );
  out.push(
    slab(
      { x: BIN.x + 4, y: BIN.y + 4, w: BIN.w - 8, d: BIN.d - 8, r: 1.5 },
      2,
      0.8,
      { tone: "lo" },
      3,
    ),
  );
  out.push(STATIC_SLIP({ x: 4, y: 51, z: 3.5, pitch: -9, tilt: 4 }, "sabot"));
  // apron: sloped quad from the deck's front edge down onto the back wall
  const ap = [
    [-36, 16, 5.85],
    [36, 16, 5.85],
    [36, 39.5, 3.05],
    [-36, 39.5, 3.05],
  ];
  out.push(
    `<path class="iso-fill" style="fill:var(--anatomy-shade-2)" d="${quad(ap)}"/>`,
  );
  out.push(L(quad(ap), { tone: "lo" }));
  for (const gx of [-36, 36]) {
    const lip = [
      [gx, 16, 5.85],
      [gx, 39.5, 3.05],
      [gx, 39.5, 4.1],
      [gx, 16, 6.9],
    ];
    out.push(
      `<path class="iso-fill" style="fill:var(--anatomy-face)" d="${quad(lip)}"/>`,
    );
    out.push(L(quad(lip), { tone: "lo" }));
  }
  // exit apron: platen edge down into the accept tray
  const ap2 = [
    [88, -8, 5.9],
    [102, -8, 4.6],
    [102, 8, 4.6],
    [88, 8, 5.9],
  ];
  out.push(
    `<path class="iso-fill" style="fill:var(--anatomy-shade-2)" d="${quad(ap2)}"/>`,
  );
  out.push(L(quad(ap2), { tone: "lo" }));
  return out.join("");
}

function outTray() {
  const out = [];
  const back = { x: OUTTRAY.x, y: OUTTRAY.y, w: OUTTRAY.w, d: 4, r: 1.2 };
  const right = {
    x: OUTTRAY.x + OUTTRAY.w - 4,
    y: OUTTRAY.y,
    w: 4,
    d: OUTTRAY.d,
    r: 1.2,
  };
  const leftw = { x: OUTTRAY.x, y: OUTTRAY.y, w: 4, d: OUTTRAY.d, r: 1.2 };
  const floor = {
    x: OUTTRAY.x + 4,
    y: OUTTRAY.y + 4,
    w: OUTTRAY.w - 8,
    d: OUTTRAY.d - 8,
    r: 1,
  };
  out.push(slab(floor, 2, 0.8, { tone: "lo" }, 3));
  out.push(slab(back, 0, 8, { tone: "mid" }, 4, 0.4));
  out.push(slab(right, 0, 8, { tone: "mid" }, 4, 0.4));
  out.push(slab(leftw, 0, 3, { tone: "mid" }, 4, 0.4));
  out.push(
    STATIC_SLIP({ x: 107, y: -2.5, z: 3.5, pitch: 0, tilt: -3 }, "clean", true),
  );
  out.push(
    D(
      [
        at([back.x + 6, back.y + 2, 8]),
        at([back.x + back.w - 6, back.y + 2, 8]),
        at([right.x + 2, right.y + 8, 8]),
        at([right.x + 2, right.y + right.d - 8, 8]),
      ],
      { size: 0.45 },
    ),
  );
  return out.join("");
}
const outTrayFront = () => {
  const front = {
    x: OUTTRAY.x,
    y: OUTTRAY.y + OUTTRAY.d - 4,
    w: OUTTRAY.w,
    d: 4,
    r: 1.2,
  };
  return (
    slab(front, 0, 8, { tone: "mid" }, 4, 0.4) +
    D(
      [
        at([front.x + 6, front.y + 2, 8]),
        at([front.x + front.w - 6, front.y + 2, 8]),
      ],
      { size: 0.45 },
    )
  );
};
const binWalls = () => {
  const left = { x: BIN.x, y: BIN.y, w: 4, d: BIN.d, r: 1.2 };
  const right = { x: BIN.x + BIN.w - 4, y: BIN.y, w: 4, d: BIN.d, r: 1.2 };
  const front = { x: BIN.x, y: BIN.y + BIN.d - 4, w: BIN.w, d: 4, r: 1.2 };
  return (
    slab(left, 0, 7, { tone: "mid" }, 4, 0.4) +
    slab(right, 0, 7, { tone: "mid" }, 4, 0.4) +
    slab(front, 0, 7, { tone: "mid" }, 4, 0.4) +
    D(
      [
        at([front.x + 8, front.y + 2, 7]),
        at([front.x + front.w - 8, front.y + 2, 7]),
        at([left.x + 2, left.y + 10, 7]),
        at([right.x + 2, right.y + 10, 7]),
      ],
      { size: 0.45 },
    )
  );
};

// ejector finger in the deck slot, shoved forward +y when the flag trips
const ejector = () =>
  `<g data-part="ejector">${slab({ x: -1.6, y: -14.8, w: 3.2, d: 1.6, r: 0.5 }, DECK_TOP, 2.2, { tone: "hi", crease: "lo" }, 3, 0.3)}</g>`;

const frontStubs = () =>
  slab(STUB_L, DECK_TOP, 4, { tone: "mid" }, 4, 0.4) +
  slab(STUB_R, DECK_TOP, 4, { tone: "mid" }, 4, 0.4) +
  D(
    [
      at([STUB_L.x + 3, STUB_L.y + 2.2, 10]),
      at([STUB_R.x + STUB_R.w - 3, STUB_R.y + 2.2, 10]),
    ],
    { size: 0.45 },
  );

// reader: bushing on the guide rail + cantilever arm + blade + head block + flag
function head() {
  const hx = 0;
  const out = [];
  out.push(
    slab(
      { x: hx - 5, y: -28, w: 10, d: 9, r: 1.5 },
      5,
      5.5,
      { tone: "mid" },
      4,
      0.5,
    ),
  );
  out.push(
    D([at([hx - 3, -25.5, 10.5]), at([hx + 3, -25.5, 10.5])], { size: 0.4 }),
  );
  out.push(
    slab(
      { x: hx - 0.7, y: -22.6, w: 1.4, d: 1.4, r: 0.4 },
      4.2,
      2.6,
      { tone: "lo" },
      2,
    ),
  );
  out.push(
    slab(
      { x: hx - 3, y: -24, w: 6, d: 42, r: 1.5 },
      10.5,
      3.5,
      { tone: "mid" },
      4,
      0.5,
    ),
  );
  out.push(
    slab(
      { x: hx - 0.7, y: -13, w: 1.4, d: 26, r: 0.4 },
      7.8,
      2.7,
      { tone: "hi", crease: "lo" },
      3,
    ),
  );
  out.push(
    slab(
      { x: hx - 5, y: 2, w: 10, d: 15, r: 1.5 },
      14,
      5,
      { tone: "hi", lit: true },
      4,
      0.6,
    ),
  );
  out.push(D([at([hx, 9.5, 19])], { size: 0.9, tone: "hi" }));
  out.push(
    `<path data-part="flag" class="iso-fill" style="fill:var(--anatomy-face)" d=""/><path data-part="flagTip" class="iso-fill" style="fill:var(--anatomy-red);fill-opacity:.85" d=""/><path data-part="flagO" class="iso-line" data-tone="mid" d=""/>`,
  );
  return `<g data-part="head">${out.join("")}</g>`;
}

// press: arm, interlock pin, ram with spring and stamp plate
function pressTop() {
  const out = [];
  out.push(`<path data-part="springB" class="iso-line" data-tone="lo" d=""/>`);
  const ram = [];
  ram.push(
    S(k.cylinder(RAM.x, RAM.y, 1.8, 13, 31, P, 24), {
      tone: "mid",
      crease: "none",
    }),
  );
  ram.push(S(k.cylinder(RAM.x, RAM.y, 3.6, 16, 3.5, P, 28), { tone: "mid" }));
  ram.push(
    slab(
      { x: RAM.x - 6, y: -11, w: 12, d: 22, r: 1.5 },
      11,
      2.2,
      { tone: "lo" },
      4,
      0.4,
    ),
  );
  ram.push(S(k.cylinder(RAM.x, RAM.y, 4.2, 44, 4, P, 32), { tone: "mid" }));
  ram.push(L(k.knurl(RAM.x, RAM.y, 4.2, 44, 48, 30, P, 0.3), { tone: "lo" }));
  ram.push(
    L(k.lineOnTop([RAM.x, RAM.y], [RAM.x + 4.2, RAM.y], 48, P), {
      tone: "hi",
      free: "start",
    }),
  );
  ram.push(D([at([RAM.x, RAM.y, 48])], { size: 0.5, tone: "hi" }));
  out.push(`<g data-part="ram">${ram.join("")}</g>`);
  out.push(`<path data-part="springF" class="iso-line" data-tone="mid" d=""/>`);
  out.push(
    slab(
      { x: PRESS.px - 5, y: PRESS.py - 1, w: 10, d: 36, r: 1.5 },
      40,
      4,
      { tone: "mid" },
      4,
      0.6,
    ),
  );
  out.push(
    L(
      k.planOutline(
        k.insetPlan(
          { x: PRESS.px - 5, y: PRESS.py - 1, w: 10, d: 36, r: 1.5 },
          1.6,
        ),
        44,
        P,
        4,
      ),
      { tone: "faint" },
    ),
  );
  out.push(
    `<g data-part="pin">${slab({ x: RAM.x + 2.4, y: -2.6, w: 4.4, d: 3.2, r: 0.6 }, 19, 2.4, { tone: "mid" }, 3)}</g>`,
  );
  return out.join("");
}

function crank() {
  const out = [];
  out.push(S(k.cylinder(94, 46, 3, 0, 6.8, P, 28), { tone: "mid" }));
  out.push(L(k.sideArc(94, 46, 3, 4.4, P, 16), { tone: "faint" }));
  out.push(
    `<g data-part="crank"><path data-f="edge" class="iso-fill" style="fill:var(--anatomy-shade-2)" d=""/><path data-f="arm" class="iso-fill" style="fill:var(--anatomy-face)" d=""/><path data-f="armO" class="iso-line" data-tone="mid" d=""/><g data-f="knob"><path class="iso-fill" d=""/><path class="iso-shade" data-shade="2" d=""/><path class="iso-top" d=""/><path class="iso-line" data-tone="mid" d=""/></g></g>`,
  );
  return out.join("");
}

// ---- assembly --------------------------------------------------------------
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A countertop receipt press that verifies a printed diff slip. A slip feeds in from a tray; a reader arm sweeps its lines and lights six check lamps on a panel. A clean slip advances under a stamp press, is stamped and punched onto a receipt tape, and slides into the accept tray. A sabotaged slip trips a flag at its raised red line and an ejector finger shoves it into the reject bin.",
  body: [
    base(),
    inTray(),
    panel(),
    printer(),
    pressPost(),
    deck(),
    cable(),
    rollers(),
    apronAndBin(),
    outTray(),
    ejector(),
    `<g data-part="slipA">${slipMarkup()}</g>`,
    `<g data-part="slipB">${slipMarkup()}</g>`,
    frontStubs(),
    head(),
    pressTop(),
    binWalls(),
    outTrayFront(),
    crank(),
  ],
});

// ---- live -------------------------------------------------------------------
const live = `
const P = ${JSON.stringify(P)};
const HEAD_MIN = ${HEAD_MIN}, HEAD_MAX = ${HEAD_MAX}, TRIP_X = ${TRIP_X}, STROKE = ${STROKE};
const LAMP_X = ${JSON.stringify(LAMP_X)};
const HOME = ${JSON.stringify(SLIP_HOME)}, SCANP = ${JSON.stringify(SLIP_SCAN)}, STAMPP = ${JSON.stringify(SLIP_STAMP)}, OUTP = ${JSON.stringify(SLIP_OUT)}, BINP = ${JSON.stringify(SLIP_BIN)};
const ROWX = ${JSON.stringify(ROWS)};
const SLIP_TOP = ${JSON.stringify(SLIP_TOP)}, SLIP_EDGE_Y = ${JSON.stringify(SLIP_EDGE_Y)}, SLIP_EDGE_X = ${JSON.stringify(SLIP_EDGE_X)};
const MARK_Q = ${JSON.stringify(MARK_Q)}, MARK_T = ${JSON.stringify(MARK_T)};
const RAMX = ${RAM.x}, RAMY = ${RAM.y};
const deg = (a) => (a * Math.PI) / 180;
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const part = (name) => svg.querySelector('[data-part="' + name + '"]');
const lampEls = [...svg.querySelectorAll("[data-lamp]")];
const slipEls = { clean: part("slipA"), sabot: part("slipB") };
const slipFields = {};
for (const kind of ["clean", "sabot"]) {
  slipFields[kind] = {};
  slipEls[kind].querySelectorAll("[data-f]").forEach((n) => (slipFields[kind][n.dataset.f] = n));
}
const headEl = part("head"), ejEl = part("ejector"), ramEl = part("ram"), pinEl = part("pin");
const flagF = part("flag"), flagTip = part("flagTip"), flagO = part("flagO");
const springB = part("springB"), springF = part("springF");
const tapeG = part("tape");
const crankEl = part("crank");
const crankArm = crankEl.querySelector('[data-f="arm"]'), crankArmO = crankEl.querySelector('[data-f="armO"]'),
  crankEdge = crankEl.querySelector('[data-f="edge"]'), crankKnob = crankEl.querySelectorAll('[data-f="knob"] path');

const M = {
  phase: "idle", t: 0,
  kind: "clean", fed: 0,
  slip: { x: HOME.x, y: HOME.y, z: HOME.z, pitch: 0, tilt: 0 },
  target: { x: HOME.x, y: HOME.y, z: HOME.z, pitch: 0, tilt: 0 },
  head: HEAD_MIN, headTarget: HEAD_MIN,
  lamps: [0, 0, 0, 0, 0, 0], tripped: false, tripLamp: 3,
  flag: 0, ej: 0, ram: 0, pin: 0, crank: -6,
  stamped: false, markOn: false, stamps: 0,
};
const tapeState = { len: 0, rows: 0 };

function slipPtLocal(pose, lx, ly, lz) {
  const a = deg(pose.pitch || 0);
  let y = ly * Math.cos(a) - lz * Math.sin(a);
  let z = ly * Math.sin(a) + lz * Math.cos(a);
  const b = deg(pose.tilt || 0);
  const x = lx * Math.cos(b) + z * Math.sin(b);
  z = -lx * Math.sin(b) + z * Math.cos(b);
  return [pose.x + x, pose.y + y, pose.z + z];
}
const pt = (p3) => iso(p3, P);
function slipDraw(kind) {
  const pose = M.slip, F = slipFields[kind];
  const q = (corners) => pathOf(corners.map((c) => pt(slipPtLocal(pose, c[0], c[1], c[2]))), true);
  const seg = (m) => pathOf([pt(slipPtLocal(pose, m[0], m[1], m[2])), pt(slipPtLocal(pose, m[3], m[4], m[5]))]);
  F.top.setAttribute("d", q(SLIP_TOP));
  F.edge.setAttribute("d", q(SLIP_EDGE_Y) + q(SLIP_EDGE_X));
  F.rim.setAttribute("d", q(SLIP_TOP));
  let rows = "", red = "";
  for (let i = 0; i < ROWX.length; i++) {
    const x = ROWX[i], l1 = 13 + ((i * 7) % 6), sabot = kind === "sabot" && i === 4;
    const marks = sabot
      ? [[0, -10, 0.05, 0, 6, 0.05], [0, 7.6, 0.05, 0, 10, 0.05]]
      : [[x, -10, 0.05, x, -10 + l1, 0.05], [x, -10 + l1 + 1.6, 0.05, x, Math.min(-10 + l1 + 1.6 + 1 + ((i * 5) % 3), 11), 0.05]];
    const d = marks.map(seg).join("");
    if (sabot) red += d; else rows += d;
  }
  F.rows.setAttribute("d", rows);
  F.red.setAttribute("d", red);
  F.perf.setAttribute("d", pathOf([pt(slipPtLocal(pose, -30.5, -12, 0.05)), pt(slipPtLocal(pose, -30.5, 12, 0.05))]));
  if (kind === "sabot") {
    F.bumpF.setAttribute("d", q([[-0.7, 11, 0.55], [0.7, 11, 0.55], [0.7, 11, 0], [-0.7, 11, 0]]));
    F.bumpO.setAttribute("d", q([[-0.7, -11, 0.55], [0.7, -11, 0.55], [0.7, 11, 0.55], [-0.7, 11, 0.55]]));
  }
  F.mark.setAttribute("d", q(MARK_Q) + seg(MARK_T));
  F.mark.style.display = M.markOn ? "" : "none";
}
function coilZ(cx, cy, r, z0, z1, turns) {
  const steps = Math.max(24, Math.round(turns * 18));
  let back = "", front = "", run = [], near = null;
  for (let i = 0; i <= steps; i++) {
    const s = i / steps, a = s * turns * Math.PI * 2;
    const p = pt([cx + r * Math.cos(a), cy + r * Math.sin(a), z0 + (z1 - z0) * s]);
    const facing = depthOf([Math.cos(a), Math.sin(a), 0], P) > 0;
    if (near === null) near = facing;
    if (facing !== near) { run.push(p); const d = pathOf(run); if (near) front += d; else back += d; run = [p]; near = facing; continue; }
    run.push(p);
  }
  const d = pathOf(run); if (near) front += d; else back += d;
  return { back, front };
}
function drawTape() {
  const len = tapeState.len, rows = tapeState.rows;
  const lean = 0.22, x0 = 101, x1 = 131, y0 = -48.5, z0 = 16.2;
  const P2 = (x, s) => pt([x, y0 - s * lean, z0 + s]);
  const rim = pathOf([P2(x0, 0), P2(x1, 0), P2(x1, len), P2(x0, len)], true);
  const marks = [], holes = [];
  for (let s = 3; s < len - 1; s += 3) holes.push(P2(x0 + 4, s), P2(x1 - 4, s));
  for (let r = 0; r < rows; r++) {
    const s = len - 4 - r * 6;
    if (s < 3) break;
    marks.push(pathOf([P2(x0 + 8, s), P2(x0 + 15, s)]), pathOf([P2(x0 + 8, s + 1.6), P2(x0 + 20, s + 1.6)]), pathOf([P2(x0 + 8, s + 3.2), P2(x0 + 13, s + 3.2)]));
    holes.push(P2(x1 - 6, s + 1.4));
  }
  tapeG.querySelector('[data-f="fill"]').setAttribute("d", rim);
  tapeG.querySelector('[data-f="rim"]').setAttribute("d", rim);
  tapeG.querySelector('[data-f="rows"]').setAttribute("d", marks.join(""));
  tapeG.querySelector('[data-f="holes"]').innerHTML = holes.map(([x, y]) => '<circle cx="' + x + '" cy="' + y + '" r="0.5"/>').join("");
}
function draw() {
  slipDraw(M.kind);
  headEl.setAttribute("transform", translateAlong(P, [M.head, 0, 0]));
  ejEl.setAttribute("transform", translateAlong(P, [0, M.ej * 30, 0]));
  ramEl.setAttribute("transform", translateAlong(P, [0, 0, -M.ram * STROKE]));
  pinEl.setAttribute("transform", translateAlong(P, [M.pin * 4.4, 0, 0]));
  const coil = coilZ(RAMX, RAMY, 3.4, 19.5 - M.ram * STROKE, 39.5, 6.5);
  springB.setAttribute("d", coil.back);
  springF.setAttribute("d", coil.front);
  // trip flag on the head block: lies flat -y, stands up when tripped
  const fp = [3.5, 4, 19.1], fa = deg(-75 * M.flag);
  const ry = (dy) => [fp[1] + dy * Math.cos(fa), fp[2] + dy * Math.sin(fa)];
  const fq = (w) => pathOf([[fp[0], ...ry(0)], [fp[0] + w, ...ry(0)], [fp[0] + w, ...ry(-4.6)], [fp[0], ...ry(-4.6)]].map(pt), true);
  flagF.setAttribute("d", fq(4));
  flagTip.setAttribute("d", pathOf([[fp[0], ...ry(-4.6)], [fp[0] + 4, ...ry(-4.6)], [fp[0] + 4, ...ry(-6.5)], [fp[0], ...ry(-6.5)]].map(pt), true));
  flagO.setAttribute("d", pathOf([[fp[0], ...ry(0)], [fp[0] + 4, ...ry(0)], [fp[0] + 4, ...ry(-6.5)], [fp[0], ...ry(-6.5)]].map(pt), true));
  // feed crank: arm + knob tilting in the x-z plane about (94,46,7.4)
  const ca = deg(M.crank);
  const cv = (dx, dz) => [94 + dx * Math.cos(ca) + dz * Math.sin(ca), 7.4 - dx * Math.sin(ca) + dz * Math.cos(ca)];
  const cy0 = 44.5, cy1 = 47.5;
  crankArm.setAttribute("d", pathOf([cv(0, 0.6), cv(13, 0.6), cv(13, 0.6), cv(0, 0.6)].map((p, i) => pt([p[0], i === 0 || i === 3 ? cy0 : cy0, 0])), true));
  const armTop = [pt([cv(0, 0.6)[0], cy0, cv(0, 0.6)[1]]), pt([cv(13, 0.6)[0], cy0, cv(13, 0.6)[1]]), pt([cv(13, 0.6)[0], cy1, cv(13, 0.6)[1]]), pt([cv(0, 0.6)[0], cy1, cv(0, 0.6)[1]])];
  const armEdge = [pt([cv(0, 0.6)[0], cy1, cv(0, 0.6)[1]]), pt([cv(13, 0.6)[0], cy1, cv(13, 0.6)[1]]), pt([cv(13, -0.6)[0], cy1, cv(13, -0.6)[1]]), pt([cv(0, -0.6)[0], cy1, cv(0, -0.6)[1]])];
  crankArm.setAttribute("d", pathOf(armTop, true));
  crankEdge.setAttribute("d", pathOf(armEdge, true));
  crankArmO.setAttribute("d", pathOf(armTop, true));
  const kp = cv(14.2, 0), knob = cylinder(kp[0], 46, 2.2, kp[1] - 1.2, 2.4, P, 20);
  crankKnob[0].setAttribute("d", knob.fill);
  crankKnob[1].setAttribute("d", knob.shades[1] + knob.shades[2]);
  crankKnob[2].setAttribute("d", knob.top);
  crankKnob[3].setAttribute("d", knob.outline);
  lampEls.forEach((g, i) => {
    const bulb = g.querySelector("[data-bulb]"), ring = g.querySelector(".iso-line");
    const isTrip = g.dataset.lamp === "trip";
    let on = false, col = "";
    if (isTrip) { on = M.tripped; col = "var(--anatomy-red)"; }
    else if (M.tripped && i === M.tripLamp) { on = true; col = "var(--anatomy-red)"; }
    else { on = M.lamps[i] > 0.5; col = "var(--anatomy-green)"; }
    ring.setAttribute("data-tone", on ? "hi" : "lo");
    bulb.style.fill = on ? col : "var(--anatomy-faint)";
  });
  const rowsIn = ROWX.filter((x) => M.head >= x + M.slip.x).length;
  const lit = M.lamps.filter((v) => v > 0.5).length;
  let text = "ready · Space feeds a slip";
  if (M.phase === "feedIn") text = "feeding " + M.kind + " slip";
  else if (M.phase === "scan") text = "line " + Math.min(rowsIn, 9) + "/9 · checks " + lit + "/6";
  else if (M.phase === "advance") text = "to the stamp · 6/6";
  else if (M.phase === "stamp") text = M.stamped ? "stamped · receipt #" + M.stamps : "6/6 · stamping";
  else if (M.phase === "exit") text = "accepted → tray";
  else if (M.phase === "tripped") text = "trip at line 5/9 · ejecting";
  else if (M.phase === "reset") text = M.tripped ? "rejected · resetting" : "reset";
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuenow", String(Math.round(((M.head - HEAD_MIN) / (HEAD_MAX - HEAD_MIN)) * 100)));
  stage.setAttribute("aria-valuetext", text);
}

const follow = (cur, tgt, dt, tau, calm) => (calm ? tgt : cur + (tgt - cur) * (1 - Math.exp(-dt / tau)));
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

let frame = 0, last = 0, visible = false, touring = !still.matches, idleTimer = 0;
function enter(phase) {
  M.phase = phase; M.t = 0;
  if (phase === "feedIn") {
    M.kind = M.fed % 2 ? "sabot" : "clean";
    M.fed++;
    Object.assign(M.slip, { x: HOME.x, y: HOME.y, z: HOME.z, pitch: 0, tilt: 0 });
    Object.assign(M.target, { x: SCANP.x, y: SCANP.y, z: SCANP.z, pitch: 0, tilt: 0 });
    M.lamps = [0, 0, 0, 0, 0, 0]; M.tripped = false; M.stamped = false; M.markOn = false;
    M.flag = 0; M.ej = 0; M.ram = 0;
    M.crank = 28;
  }
  if (phase === "tripped") {
    M.tripped = true;
    M.tripLamp = M.lamps.findIndex((v) => v < 0.5);
    if (M.tripLamp < 0) M.tripLamp = 5;
  }
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now; M.t += dt;
  const calm = still.matches;
  const s = M.slip, tg = M.target;
  s.x = follow(s.x, tg.x, dt, 0.3, calm);
  s.y = follow(s.y, tg.y, dt, 0.2, calm);
  s.z = follow(s.z, tg.z, dt, 0.2, calm);
  s.pitch = follow(s.pitch, tg.pitch, dt, 0.18, calm);
  s.tilt = follow(s.tilt, tg.tilt, dt, 0.18, calm);
  M.head = follow(M.head, M.headTarget, dt, 0.13, calm);
  M.crank = follow(M.crank, -6, dt, 0.5, calm);
  M.flag = follow(M.flag, M.tripped ? 1 : 0, dt, 0.08, calm);
  M.pin = follow(M.pin, M.lamps.every((v) => v > 0.5) ? 1 : 0, dt, 0.18, calm);
  if (touring || M.phase !== "idle") {
    switch (M.phase) {
      case "idle": if (touring && M.t > 1.4) enter("feedIn"); break;
      case "feedIn":
        if (Math.abs(s.x - SCANP.x) < 0.7) { s.x = SCANP.x; enter("scan"); }
        break;
      case "scan":
        if (touring) M.headTarget = Math.min(HEAD_MAX, HEAD_MIN + (M.t / 2.8) * (HEAD_MAX - HEAD_MIN));
        if (M.kind === "sabot" && M.head >= TRIP_X) { enter("tripped"); break; }
        if (M.head >= HEAD_MAX - 0.3 && M.headTarget >= HEAD_MAX - 0.5 && M.lamps.every((v) => v > 0.5)) enter(M.kind === "clean" ? "advance" : "tripped");
        break;
      case "advance":
        Object.assign(M.target, { x: STAMPP.x, y: STAMPP.y, z: STAMPP.z, pitch: 0, tilt: 0 });
        if (Math.abs(s.x - STAMPP.x) < 0.8) enter("stamp");
        break;
      case "stamp": {
        M.ram = smooth(0, 0.28, M.t) * (1 - smooth(0.62, 1.05, M.t));
        if (M.t > 0.26 && !M.stamped) {
          M.stamped = true; M.markOn = true; M.stamps++;
          tapeState.rows = Math.min(M.stamps, 5); tapeState.len = Math.min(30, tapeState.len + 6);
          drawTape();
        }
        if (M.t > 1.15) enter("exit");
        break;
      }
      case "exit":
        Object.assign(M.target, { x: OUTP.x, y: OUTP.y, z: OUTP.z, tilt: -7 });
        if (Math.abs(s.x - OUTP.x) < 0.9) { M.target.tilt = 0; if (Math.abs(s.tilt) < 0.4) enter("reset"); }
        break;
      case "tripped":
        M.ej = smooth(0.5, 1.0, M.t);
        if (M.t > 0.5) Object.assign(M.target, { x: BINP.x, y: BINP.y, z: BINP.z, pitch: -8, tilt: 0 });
        else if (M.t > 0.2) M.target.y = 10;
        if (M.t > 1.7) enter("reset");
        break;
      case "reset": {
        M.headTarget = HEAD_MIN;
        if (M.t > 0.4) M.ej = 0;
        const dim = Math.floor(M.t / 0.08);
        for (let i = 0; i < 6; i++) if (i < dim) M.lamps[i] = 0;
        if (M.t > 1.0) { M.tripped = false; enter("idle"); }
        break;
      }
    }
  }
  LAMP_X.forEach((lx, i) => { if (!M.tripped && M.phase === "scan" && M.head >= lx) M.lamps[i] = 1; });
  draw();
  const moving =
    M.phase !== "idle" || touring ||
    Math.abs(M.head - M.headTarget) > 0.02 ||
    Math.abs(M.crank + 6) > 0.02 ||
    Math.abs(M.flag - (M.tripped ? 1 : 0)) > 0.02;
  frame = visible && moving ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const steer = (fn) => {
  touring = false; fn();
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (!still.matches) touring = true; }, 3600);
  run();
};
const feedNext = () => { if (M.phase === "idle" || M.phase === "reset") enter("feedIn"); };
new IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
if (still.matches) touring = false;
stage.addEventListener("pointermove", (e) => {
  if (M.phase !== "scan") return;
  const box = svg.getBoundingClientRect();
  const share = Math.max(0, Math.min(1, (e.clientX - box.left) / box.width));
  steer(() => { M.headTarget = HEAD_MIN + share * (HEAD_MAX - HEAD_MIN); });
});
stage.addEventListener("pointerdown", () => steer(feedNext));
stage.addEventListener("keydown", (e) => {
  if (e.key === " " || e.key === "Enter") { e.preventDefault(); steer(feedNext); return; }
  if (M.phase !== "scan") return;
  let next = null;
  if (e.key === "ArrowRight") next = M.headTarget + 4;
  if (e.key === "ArrowLeft") next = M.headTarget - 4;
  if (e.key === "Home") next = HEAD_MIN;
  if (e.key === "End") next = HEAD_MAX;
  if (next === null) return;
  e.preventDefault();
  steer(() => { M.headTarget = Math.max(HEAD_MIN, Math.min(HEAD_MAX, next)); });
});
draw(); drawTape();
`;

const body = k.plateHtml({
  fig: "Fig 1",
  title: "Receipts — proof of checking",
  hint: "Sweep the reader ← → · Space feeds a slip",
  readout: "ready · Space feeds a slip",
  keys: [
    {
      mark: "lit",
      label: "The reader arm sweeps the printed diff line by line",
    },
    {
      mark: "raised",
      label: "The diff slip — every row is a line that must check out",
    },
    {
      mark: "green",
      label: "All six checks lit → the interlock frees the stamp",
    },
    {
      mark: "red",
      label: "A raised sabotage line trips the flag → reject bin",
    },
  ],
  caption:
    "A diff comes in as a printed slip. The reader sweeps all nine lines and lights the six checks on the panel; only then does the pin free the stamp, which marks the slip and punches the receipt tape. One raised red line (a silenced test) trips the flag at line 5, and the ejector shoves the slip into the reject bin — the verdict cites the exact line.",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Receipt verifier: arrow keys sweep the reader arm across the slip, Space feeds the next slip" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-valuetext="ready">${svg}</div>`,
});

const out = theme === "light" ? "index-light.html" : "index.html";
writeFileSync(
  join(HERE, out),
  k.pageHtml({
    title: "Receipts — proof of checking",
    theme,
    body,
    script: kitScript() + live,
    width: 700,
  }),
);
console.log("wrote", out);
