// Checks the chemistry behind shape/index.html.
//
//   node shape/check-shape.mjs
//
// 1. geometry.js still matches the PubChem SDF files.
// 2. Atom counts, connectivity, and bond orders match each formula.
// 3. Conformer bond lengths and angles sit close to the measured values
//    quoted on the page (NIST CCCBDB). Tolerance 0.04 Å and 1.5°.
// 4. VSEPR electron-domain counts match the taught shapes.
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

const EXPECT = {
  CO2: { formula: { C: 1, O: 2 }, bonds: [["C", "O", 2], ["C", "O", 2]], shape: "linear", domains: 2, lone: 0 },
  SO3: { formula: { S: 1, O: 3 }, bonds: [["S", "O", 2], ["S", "O", 2], ["S", "O", 2]], shape: "trigonal planar", domains: 3, lone: 0 },
  CH4: { formula: { C: 1, H: 4 }, bonds: [["C", "H", 1], ["C", "H", 1], ["C", "H", 1], ["C", "H", 1]], shape: "tetrahedral", domains: 4, lone: 0 },
  NH3: { formula: { N: 1, H: 3 }, bonds: [["N", "H", 1], ["N", "H", 1], ["N", "H", 1]], shape: "trigonal pyramidal", domains: 4, lone: 1 },
  H2O: { formula: { O: 1, H: 2 }, bonds: [["O", "H", 1], ["O", "H", 1]], shape: "bent", domains: 4, lone: 2 },
};
// measured (NIST CCCBDB experimental)
const MEASURED = {
  CO2: { "C-O": 1.162, angle: 180 },
  SO3: { "S-O": 1.418, angle: 120 },
  CH4: { "C-H": 1.087, angle: 109.471 },
  NH3: { "N-H": 1.012, angle: 106.67 },
  H2O: { "O-H": 0.958, angle: 104.4776 },
};
const CENTRAL = { CO2: "C", SO3: "S", CH4: "C", NH3: "N", H2O: "O" };
const dist = (a, b) => Math.hypot(a[1] - b[1], a[2] - b[2], a[3] - b[3]);

for (const [id, exp] of Object.entries(EXPECT)) {
  const g = GEOMETRY[id];
  const counts = {};
  for (const [el] of g.atoms) counts[el] = (counts[el] || 0) + 1;
  ok(JSON.stringify(Object.entries(counts).sort()) === JSON.stringify(Object.entries(exp.formula).sort()),
    `${id}: atom counts ${JSON.stringify(counts)}`);
  const got = g.bonds.map(([i, j, o]) => [g.atoms[i][0], g.atoms[j][0], o].sort().join()).sort();
  const want = exp.bonds.map((b) => [...b].sort().join()).sort();
  ok(JSON.stringify(got) === JSON.stringify(want), `${id}: connectivity and bond orders ${got.join(" | ")}`);
  ok(g.bonds.length === exp.domains - exp.lone, `${id}: ${g.bonds.length} bonded domains (VSEPR ${exp.shape})`);
  for (const [i, j] of g.bonds) {
    const els = [g.atoms[i][0], g.atoms[j][0]];
    const key = `${els[0]}-${els[1]}`;
    const keyR = `${els[1]}-${els[0]}`;
    const m = MEASURED[id][key] ?? MEASURED[id][keyR];
    const d = dist(g.atoms[i], g.atoms[j]);
    ok(Math.abs(d - m) <= 0.04, `${id}: ${key} model ${d.toFixed(4)} Å vs measured ${m} Å`);
  }
  const c = g.atoms.findIndex(([el]) => el === CENTRAL[id]);
  const neigh = [];
  for (const [i, j] of g.bonds) { if (i === c) neigh.push(j); if (j === c) neigh.push(i); }
  ok(neigh.length >= 2, `${id}: central atom has neighbors`);
  const vec = (i) => [1, 2, 3].map((k) => g.atoms[i][k] - g.atoms[c][k]);
  const angles = [];
  for (let a = 0; a < neigh.length; a++) for (let b = a + 1; b < neigh.length; b++) {
    const u = vec(neigh[a]), v = vec(neigh[b]);
    const ang = (Math.acos((u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / Math.hypot(...u) / Math.hypot(...v)) * 180) / Math.PI;
    angles.push(ang);
  }
  const mean = angles.reduce((s, x) => s + x, 0) / angles.length;
  ok(Math.abs(mean - MEASURED[id].angle) <= 1.5, `${id}: mean angle model ${mean.toFixed(2)}° vs measured ${MEASURED[id].angle}°`);
}

const html = readFileSync(join(here, "index.html"), "utf8").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
const banned = [/webgl/i, /\?safe/i, /\?still/i, /reduced[- ]motion/i, /coming (later|soon)/i, /\bTODO\b/, /\bGPU\b/i, /\bDPR\b/, /swiftshader/i, /device cap/i];
for (const re of banned) ok(!re.test(html), `page copy has no ${re}`);

// page must teach the five shapes and show measured angles
for (const phrase of ["linear", "trigonal planar", "tetrahedral", "trigonal pyramidal", "bent", "180", "120", "109.5", "107", "104.5"]) {
  ok(html.toLowerCase().includes(phrase.toLowerCase()) || html.includes(phrase), `page mentions ${phrase}`);
}
ok(/In the real world/i.test(html), "page has In the real world");
ok(/Check yourself/i.test(html), "page has Check yourself");
ok(/water treatment|HVAC|firefighter|farmer|pharmacist|medicinal/i.test(html), "real-world section names jobs");

if (fail) { console.error(`${fail} check(s) failed`); process.exit(1); }
console.log("all shape checks passed");
