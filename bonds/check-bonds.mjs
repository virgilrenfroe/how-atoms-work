// Checks the chemistry behind bonds/index.html.
//
//   node bonds/check-bonds.mjs
//
// 1. geometry.js still matches the PubChem SDF files (build-geometry --check logic).
// 2. Atom counts, connectivity, and bond orders match each formula; every
//    atom has a full valence (H 1, C 4, N 3, O 2).
// 3. Conformer bond lengths and angles sit close to the measured values
//    quoted on the page (NIST CCCBDB). Tolerance 0.03 Å and 1°.
// 4. The rock-salt cell: 14 Na⁺ + 13 Cl⁻ on a 3×3×3 grid, spacing a/2 = 2.820 Å,
//    every nearest neighbor of opposite charge.
// 5. The page copy carries no developer or status text.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GEOMETRY } from "./geometry.js";

const here = dirname(fileURLToPath(import.meta.url));
let fail = 0;
const ok = (cond, msg) => { console.log(`${cond ? "ok  " : "FAIL"} ${msg}`); if (!cond) fail++; };

execFileSync(process.execPath, [join(here, "build-geometry.mjs"), "--check"], { stdio: "inherit" });

const VALENCE = { H: 1, C: 4, N: 3, O: 2 };
const EXPECT = {
  H2: { formula: { H: 2 }, bonds: [["H", "H", 1]] },
  CH4: { formula: { C: 1, H: 4 }, bonds: [["C", "H", 1], ["C", "H", 1], ["C", "H", 1], ["C", "H", 1]] },
  O2: { formula: { O: 2 }, bonds: [["O", "O", 2]] },
  N2: { formula: { N: 2 }, bonds: [["N", "N", 3]] },
  H2O: { formula: { O: 1, H: 2 }, bonds: [["O", "H", 1], ["O", "H", 1]] },
};
// measured (NIST CCCBDB experimental r_e / angles)
const MEASURED = {
  H2: { "H-H": 0.7414 },
  CH4: { "C-H": 1.087, angle: 109.471 },
  O2: { "O-O": 1.2075 },
  N2: { "N-N": 1.0977 },
  H2O: { "O-H": 0.958, angle: 104.4776 },
};
const dist = (a, b) => Math.hypot(a[1] - b[1], a[2] - b[2], a[3] - b[3]);
for (const [id, exp] of Object.entries(EXPECT)) {
  const g = GEOMETRY[id];
  const counts = {};
  for (const [el] of g.atoms) counts[el] = (counts[el] || 0) + 1;
  ok(JSON.stringify(Object.entries(counts).sort()) === JSON.stringify(Object.entries(exp.formula).sort()), `${id}: atom counts ${JSON.stringify(counts)}`);
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
    const d = dist(g.atoms[i], g.atoms[j]);
    ok(Math.abs(d - m) <= 0.03, `${id}: ${key} model ${d.toFixed(4)} Å vs measured ${m} Å`);
  }
  if (MEASURED[id].angle) {
    const c = g.atoms.findIndex(([el]) => el !== "H");
    const hs = g.atoms.map((a, i) => i).filter((i) => g.atoms[i][0] === "H");
    const vec = (i) => [1, 2, 3].map((k) => g.atoms[i][k] - g.atoms[c][k]);
    const u = vec(hs[0]), v = vec(hs[1]);
    const ang = (Math.acos((u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / Math.hypot(...u) / Math.hypot(...v)) * 180) / Math.PI;
    ok(Math.abs(ang - MEASURED[id].angle) <= 1, `${id}: angle model ${ang.toFixed(2)}° vs measured ${MEASURED[id].angle}°`);
  }
}

// rock salt
const A = 5.64, D = A / 2;
const sites = [];
for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) sites.push({ p: [i * D, j * D, k * D], na: (i + j + k) % 2 === 0 });
ok(sites.filter((s) => s.na).length === 14 && sites.filter((s) => !s.na).length === 13, "NaCl cell: 14 Na⁺ + 13 Cl⁻ sites");
let nnOk = true;
for (const a of sites) for (const b of sites) {
  const d = Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1], a.p[2] - b.p[2]);
  if (Math.abs(d - D) < 1e-9 && a.na === b.na) nnOk = false;
}
ok(nnOk && Math.abs(D - 2.82) < 1e-9, "NaCl cell: nearest neighbors 2.820 Å apart are always Na⁺–Cl⁻");
const center = sites.find((s) => s.p.every((x) => Math.abs(x - D) < 1e-9));
const six = sites.filter((s) => Math.abs(Math.hypot(...s.p.map((x, k) => x - center.p[k])) - D) < 1e-9);
ok(six.length === 6 && six.every((s) => s.na !== center.na), "NaCl cell: the center ion has six opposite-charge neighbors");

// page copy: student-facing only
const html = readFileSync(join(here, "index.html"), "utf8").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
const banned = [/webgl/i, /\?safe/i, /\?still/i, /reduced[- ]motion/i, /coming (later|soon)/i, /\bTODO\b/, /context/i, /\bGPU\b/i, /\bDPR\b/];
for (const re of banned) ok(!re.test(html), `page copy has no ${re}`);

if (fail) { console.error(`${fail} check(s) failed`); process.exit(1); }
console.log("all bond checks passed");
