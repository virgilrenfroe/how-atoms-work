// Checks the chemistry behind reactions/index.html.
//
//   node reactions/check-reactions.mjs
//
// 1. geometry.js still matches the PubChem SDF files.
// 2. Atom counts, connectivity, and bond orders match each formula.
// 3. Conformer bond lengths (and H2O2 angles) sit close to measured NIST values.
// 4. Each demo equation conserves atoms (left tally == right tally).
// 5. The balance interactive's target coefficients balance; wrong ones do not.
// 6. The page copy carries no developer or status text.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GEOMETRY } from "./geometry.js";

const here = dirname(fileURLToPath(import.meta.url));
let fail = 0;
const ok = (cond, msg) => { console.log(`${cond ? "ok  " : "FAIL"} ${msg}`); if (!cond) fail++; };

execFileSync(process.execPath, [join(here, "build-geometry.mjs"), "--check"], { stdio: "inherit" });

const VALENCE = { H: 1, C: 4, O: 2 };
const EXPECT = {
  H2: { formula: { H: 2 }, bonds: [["H", "H", 1]] },
  O2: { formula: { O: 2 }, bonds: [["O", "O", 2]] },
  H2O: { formula: { O: 1, H: 2 }, bonds: [["O", "H", 1], ["O", "H", 1]] },
  CH4: { formula: { C: 1, H: 4 }, bonds: [["C", "H", 1], ["C", "H", 1], ["C", "H", 1], ["C", "H", 1]] },
  CO2: { formula: { C: 1, O: 2 }, bonds: [["C", "O", 2], ["C", "O", 2]] },
  H2O2: { formula: { O: 2, H: 2 }, bonds: [["O", "O", 1], ["O", "H", 1], ["O", "H", 1]] },
};
const MEASURED = {
  H2: { "H-H": 0.7414 },
  O2: { "O-O": 1.2075 },
  H2O: { "O-H": 0.958, angle: 104.4776 },
  CH4: { "C-H": 1.087, angle: 109.471 },
  CO2: { "C-O": 1.162, angle: 180 },
  H2O2: { "O-H": 0.950, "O-O": 1.475, angle: 94.8 },
};
const dist = (a, b) => Math.hypot(a[1] - b[1], a[2] - b[2], a[3] - b[3]);
const angleAt = (g, center, i, j) => {
  const u = [1, 2, 3].map((k) => g.atoms[i][k] - g.atoms[center][k]);
  const v = [1, 2, 3].map((k) => g.atoms[j][k] - g.atoms[center][k]);
  return (Math.acos((u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / Math.hypot(...u) / Math.hypot(...v)) * 180) / Math.PI;
};

for (const [id, exp] of Object.entries(EXPECT)) {
  const g = GEOMETRY[id];
  ok(!!g, `${id}: present in GEOMETRY`);
  const counts = {};
  for (const [el] of g.atoms) counts[el] = (counts[el] || 0) + 1;
  ok(JSON.stringify(Object.entries(counts).sort()) === JSON.stringify(Object.entries(exp.formula).sort()),
    `${id}: atom counts ${JSON.stringify(counts)}`);
  const got = g.bonds.map(([i, j, o]) => [g.atoms[i][0], g.atoms[j][0], o].sort().join()).sort();
  const want = exp.bonds.map((b) => [...b].sort().join()).sort();
  ok(JSON.stringify(got) === JSON.stringify(want), `${id}: connectivity and bond orders ${got.join(" | ")}`);
  const sum = g.atoms.map(() => 0);
  for (const [i, j, o] of g.bonds) { sum[i] += o; sum[j] += o; }
  ok(g.atoms.every(([el], i) => sum[i] === VALENCE[el]), `${id}: every atom has a full valence`);
  for (const [i, j] of g.bonds) {
    const key = `${g.atoms[i][0]}-${g.atoms[j][0]}`;
    const keyR = `${g.atoms[j][0]}-${g.atoms[i][0]}`;
    const m = MEASURED[id][key] ?? MEASURED[id][keyR];
    if (m == null) continue;
    const d = dist(g.atoms[i], g.atoms[j]);
    ok(Math.abs(d - m) <= 0.04, `${id}: ${key} model ${d.toFixed(4)} Å vs measured ${m} Å`);
  }
  if (id === "H2O") {
    const c = g.atoms.findIndex(([el]) => el === "O");
    const hs = g.atoms.map((_, i) => i).filter((i) => g.atoms[i][0] === "H");
    const ang = angleAt(g, c, hs[0], hs[1]);
    ok(Math.abs(ang - MEASURED.H2O.angle) <= 1.5, `${id}: angle model ${ang.toFixed(2)}° vs measured ${MEASURED.H2O.angle}°`);
  }
  if (id === "CH4") {
    const c = g.atoms.findIndex(([el]) => el === "C");
    const hs = g.atoms.map((_, i) => i).filter((i) => g.atoms[i][0] === "H");
    const ang = angleAt(g, c, hs[0], hs[1]);
    ok(Math.abs(ang - MEASURED.CH4.angle) <= 1.5, `${id}: angle model ${ang.toFixed(2)}° vs measured ${MEASURED.CH4.angle}°`);
  }
  if (id === "CO2") {
    const c = g.atoms.findIndex(([el]) => el === "C");
    const os = g.atoms.map((_, i) => i).filter((i) => g.atoms[i][0] === "O");
    const ang = angleAt(g, c, os[0], os[1]);
    ok(Math.abs(ang - 180) <= 1.5, `${id}: angle model ${ang.toFixed(2)}° vs measured 180°`);
  }
  if (id === "H2O2") {
    const Os = g.atoms.map((_, i) => i).filter((i) => g.atoms[i][0] === "O");
    const Hs = g.atoms.map((_, i) => i).filter((i) => g.atoms[i][0] === "H");
    // ∠HOO at each oxygen
    for (const o of Os) {
      const h = Hs.find((hi) => g.bonds.some(([a, b]) => (a === o && b === hi) || (b === o && a === hi)));
      const otherO = Os.find((x) => x !== o);
      const ang = angleAt(g, o, otherO, h);
      ok(Math.abs(ang - MEASURED.H2O2.angle) <= 4, `${id}: ∠HOO model ${ang.toFixed(2)}° vs measured ${MEASURED.H2O2.angle}°`);
    }
  }
}

function tally(species) {
  const c = {};
  for (const [id, n] of Object.entries(species)) {
    for (const [el] of GEOMETRY[id].atoms) c[el] = (c[el] || 0) + n;
  }
  return c;
}
function sameTally(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if ((a[k] || 0) !== (b[k] || 0)) return false;
  return true;
}

const rxns = [
  { name: "2 H2 + O2 → 2 H2O", left: { H2: 2, O2: 1 }, right: { H2O: 2 } },
  { name: "CH4 + 2 O2 → CO2 + 2 H2O", left: { CH4: 1, O2: 2 }, right: { CO2: 1, H2O: 2 } },
  { name: "2 H2O2 → 2 H2O + O2", left: { H2O2: 2 }, right: { H2O: 2, O2: 1 } },
];
for (const r of rxns) {
  const L = tally(r.left), R = tally(r.right);
  ok(sameTally(L, R), `${r.name}: atom tally ${JSON.stringify(L)}`);
}

// balance interactive target
ok(sameTally(tally({ H2: 2, O2: 1 }), tally({ H2O: 2 })), "balance target 2,1,2 conserves atoms");
ok(!sameTally(tally({ H2: 1, O2: 1 }), tally({ H2O: 1 })), "unbalanced 1,1,1 does not conserve");
ok(!sameTally(tally({ H2: 2, O2: 1 }), tally({ H2O: 1 })), "unbalanced 2,1,1 does not conserve");

const html = readFileSync(join(here, "index.html"), "utf8").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
const banned = [/webgl/i, /\?safe/i, /\?still/i, /reduced[- ]motion/i, /coming (later|soon)/i, /\bTODO\b/, /\bGPU\b/i, /\bDPR\b/, /swiftshader/i, /device cap/i, /virgil/i];
for (const re of banned) ok(!re.test(html), `page copy has no ${re}`);

for (const phrase of [
  "conservation", "coefficient", "subscript", "combination", "decomposition", "combustion",
  "In the real world", "Check yourself", "2 H₂ + O₂", "CH₄ + 2 O₂", "2 H₂O₂",
]) {
  ok(html.includes(phrase) || html.toLowerCase().includes(phrase.toLowerCase()), `page mentions ${phrase}`);
}

// real-world jobs named
for (const job of ["HVAC", "Auto technicians", "Firefighters", "Wastewater", "Janitorial", "Bakers"]) {
  ok(html.includes(job), `real-world names ${job}`);
}

if (fail) { console.error(`\n${fail} check(s) failed`); process.exit(1); }
console.log("\nall reactions checks passed");
