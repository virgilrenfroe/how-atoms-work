// Checks the chemistry behind acids/index.html.
//
//   node acids/check-acids.mjs
//
// 1. geometry.js still matches the PubChem SDF files.
// 2. Atom counts, connectivity, and bond orders match each formula.
// 3. Conformer bond lengths (and H3O+/H2O angles) sit close to measured
//    NIST CCCBDB values. Tolerance 0.04 Å and 1.5°.
// 4. The page copy carries no developer or status text.
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
  HCl: { formula: { Cl: 1, H: 1 }, bonds: [["Cl", "H", 1]] },
  H2O: { formula: { O: 1, H: 2 }, bonds: [["O", "H", 1], ["O", "H", 1]] },
  H3O: { formula: { O: 1, H: 3 }, bonds: [["O", "H", 1], ["O", "H", 1], ["O", "H", 1]] },
  OH: { formula: { O: 1, H: 1 }, bonds: [["O", "H", 1]] },
  CH3COOH: {
    formula: { C: 2, H: 4, O: 2 },
    bonds: [
      ["O", "C", 1], ["O", "H", 1], ["O", "C", 2], ["C", "C", 1],
      ["C", "H", 1], ["C", "H", 1], ["C", "H", 1],
    ],
  },
};
const MEASURED = {
  HCl: { "Cl-H": 1.2746, "H-Cl": 1.2746 },
  H2O: { "O-H": 0.958, angle: 104.48 },
  H3O: { "O-H": 0.976, angle: 111.30 },
  OH: { "O-H": 0.964 },
  CH3COOH: { "O-H": 0.97 }, // carboxyl O–H ~0.97 Å; PubChem ~0.981
};
const dist = (a, b) => Math.hypot(a[1] - b[1], a[2] - b[2], a[3] - b[3]);

for (const [id, exp] of Object.entries(EXPECT)) {
  const g = GEOMETRY[id];
  const counts = {};
  for (const [el] of g.atoms) counts[el] = (counts[el] || 0) + 1;
  ok(JSON.stringify(Object.entries(counts).sort()) === JSON.stringify(Object.entries(exp.formula).sort()), `${id}: atom counts ${JSON.stringify(counts)}`);
  const got = g.bonds.map(([i, j, o]) => [g.atoms[i][0], g.atoms[j][0], o].sort().join()).sort();
  const want = exp.bonds.map((b) => [...b].sort().join()).sort();
  ok(JSON.stringify(got) === JSON.stringify(want), `${id}: connectivity and bond orders`);
  for (const [i, j] of g.bonds) {
    const key = `${g.atoms[i][0]}-${g.atoms[j][0]}`;
    const keyR = `${g.atoms[j][0]}-${g.atoms[i][0]}`;
    const m = MEASURED[id]?.[key] ?? MEASURED[id]?.[keyR];
    if (m == null) continue;
    const d = dist(g.atoms[i], g.atoms[j]);
    // For acetic, only check the O–H (acidic) bond against ~0.97
    if (id === "CH3COOH" && !(g.atoms[i][0] === "O" && g.atoms[j][0] === "H") && !(g.atoms[i][0] === "H" && g.atoms[j][0] === "O")) continue;
    ok(Math.abs(d - m) <= 0.04, `${id}: ${key} model ${d.toFixed(4)} Å vs measured ${m} Å`);
  }
  if (MEASURED[id]?.angle) {
    const o = g.atoms.findIndex(([el]) => el === "O");
    const hs = g.atoms.map((a, i) => i).filter((i) => g.atoms[i][0] === "H");
    const vec = (i) => [1, 2, 3].map((k) => g.atoms[i][k] - g.atoms[o][k]);
    const u = vec(hs[0]), v = vec(hs[1]);
    const ang = (Math.acos((u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / Math.hypot(...u) / Math.hypot(...v)) * 180) / Math.PI;
    ok(Math.abs(ang - MEASURED[id].angle) <= 1.5, `${id}: angle model ${ang.toFixed(2)}° vs measured ${MEASURED[id].angle}°`);
  }
}

// acetic acid must have exactly one O–H (the acidic hydrogen)
{
  const g = GEOMETRY.CH3COOH;
  const oh = g.bonds.filter(([i, j]) => {
    const a = g.atoms[i][0], b = g.atoms[j][0];
    return (a === "O" && b === "H") || (a === "H" && b === "O");
  });
  ok(oh.length === 1, `CH3COOH: exactly one O–H bond (got ${oh.length})`);
  const H = g.atoms.filter(([el]) => el === "H").length;
  ok(H === 4, `CH3COOH: four hydrogens present`);
}

// page copy: student-facing only
const html = readFileSync(join(here, "index.html"), "utf8").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
const banned = [/webgl/i, /\?safe/i, /\?still/i, /reduced[- ]motion/i, /coming (later|soon)/i, /\bTODO\b/, /\bGPU\b/i, /\bDPR\b/, /devicePixelRatio/i, /console\./i];
for (const re of banned) ok(!re.test(html), `page copy has no ${re}`);

// required teaching phrases present
ok(/hydronium/i.test(html), "page mentions hydronium");
ok(/H₃O⁺/.test(html) || /H3O/.test(html), "page shows H₃O⁺");
ok(/neutralization|neutralize|cancel/i.test(html), "page covers neutralization");
ok(/strong/i.test(html) && /weak/i.test(html), "page covers strong vs weak");
ok(/\bpH\b/.test(html), "page covers pH");
ok(/real world/i.test(html), "page has In the real world");
ok(/Check yourself/i.test(html), "page has Check yourself");

if (fail) { console.error(`${fail} check(s) failed`); process.exit(1); }
console.log("all acid checks passed");
