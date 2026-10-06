// Checks every ball-and-stick model in the catalog, including later
// waves: the atom list matches the stated formula, and every atom has
// a valid valence. A new element needs an entry in DEGREE and CLASSICAL.
//
//   node molecules/check-geometries.mjs
//
// Bond order 1.5 is an aromatic bond and counts in the order sum.
// An atom in an aromatic ring may sit above the classical valence:
// a bridgehead carbon is 4.5, a ring carbonyl carbon is 5, pyrrole
// nitrogen is 4, and a thiophene sulfur is 3. Bond order 4 (the
// nanotube) and 5 (ozone) skip the classical sum. Degree is still
// checked. Hydrogens must be degree 1.
//
// Formal charge `c` shifts the expected order sum (N+ is 4, O− is 1,
// C− in carbon monoxide is 3). Sulfur may be 4 or 6 and phosphorus
// may be 5 when the degree matches a sulfoxide, sulfone, sulfate, or
// phosphate. Those are the hypervalent cases, not a free pass.
// A restraint entry (explosives, toxins, nerve agents, and other
// dual-use or controlled substances) is a card only. It must not be
// ball-and-stick, and it must not have coordinates in the geometry file.

import { MOLECULES } from "./molecules-data.js";
import { GEOMETRIES } from "./geometries.js";

const DEGREE = {
  H: new Set([1]),
  C: new Set([1, 2, 3, 4]),
  N: new Set([1, 2, 3, 4]),
  O: new Set([1, 2]),
  F: new Set([1]),
  Mg: new Set([4]),
  Si: new Set([4]),
  P: new Set([3, 4, 5]),
  S: new Set([1, 2, 3, 4, 6]),
};
const CLASSICAL = { H: 1, C: 4, N: 3, O: 2, F: 1, Mg: 2, Si: 4, P: 3, S: 2 };
const HYPER = {
  S: { 4: new Set([3]), 6: new Set([4]) },
  P: { 5: new Set([4, 5]) },
};
const AROMATIC_SUM = {
  H: new Set([1]),
  C: new Set([4, 4.5, 5]),
  N: new Set([3, 4]),
  O: new Set([2, 3]),
  S: new Set([2, 3]),
};

function parseFormula(formula) {
  const counts = {};
  const re = /([A-Z][a-z]?)(\d*)/g;
  let match;
  while ((match = re.exec(formula))) {
    counts[match[1]] = (counts[match[1]] || 0) + (match[2] ? Number(match[2]) : 1);
  }
  return counts;
}

function sameCounts(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) if ((a[key] || 0) !== (b[key] || 0)) return false;
  return true;
}

function atomCounts(atoms) {
  const counts = {};
  for (const atom of atoms) counts[atom.el] = (counts[atom.el] || 0) + 1;
  return counts;
}

function problemsFor(geo) {
  const problems = [];
  const atoms = geo.atoms;
  const degree = new Array(atoms.length).fill(0);
  const orderSum = new Array(atoms.length).fill(0);
  const special = new Array(atoms.length).fill(false);
  const aromatic = new Array(atoms.length).fill(false);
  const seen = new Set();
  const adj = atoms.map(() => []);
  for (const bond of geo.bonds) {
    if (!bond || bond.length !== 3) {
      problems.push("bond shape");
      continue;
    }
    const [a, b, order] = bond;
    if (a === b || a < 0 || b < 0 || a >= atoms.length || b >= atoms.length) {
      problems.push(`bad index ${a}-${b}`);
      continue;
    }
    const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
    if (seen.has(key)) problems.push(`duplicate ${key}`);
    seen.add(key);
    if (![1, 1.5, 2, 3, 4, 5].includes(order)) {
      problems.push(`bad order ${order}`);
      continue;
    }
    degree[a] += 1;
    degree[b] += 1;
    adj[a].push(b);
    adj[b].push(a);
    if (order === 1.5) {
      aromatic[a] = true;
      aromatic[b] = true;
      orderSum[a] += order;
      orderSum[b] += order;
    } else if (order === 4 || order === 5) {
      special[a] = true;
      special[b] = true;
    } else {
      orderSum[a] += order;
      orderSum[b] += order;
    }
  }
  atoms.forEach((atom, i) => {
    const allowed = DEGREE[atom.el];
    if (!allowed) {
      problems.push(`element ${atom.el}`);
      return;
    }
    if (!allowed.has(degree[i])) problems.push(`${atom.el}${i} degree ${degree[i]}`);
    const charge = atom.c || 0;
    if (atom.el === "H" && orderSum[i] !== 1) problems.push(`H${i} order ${orderSum[i]}`);
    if (aromatic[i]) {
      const allowedSum = AROMATIC_SUM[atom.el];
      if (!allowedSum || !allowedSum.has(orderSum[i])) {
        problems.push(`${atom.el}${i} aromatic valence ${orderSum[i]}`);
      }
    } else if (!special[i]) {
      const expected = CLASSICAL[atom.el] + charge;
      const hyper = HYPER[atom.el] && HYPER[atom.el][orderSum[i]];
      if (orderSum[i] !== expected && !(hyper && hyper.has(degree[i]))) {
        problems.push(`${atom.el}${i} valence ${orderSum[i]}`);
      }
    }
  });
  if (atoms.length) {
    const stack = [0];
    const reach = new Set();
    while (stack.length) {
      const i = stack.pop();
      if (reach.has(i)) continue;
      reach.add(i);
      stack.push(...adj[i]);
    }
    if (reach.size !== atoms.length) problems.push(`disconnected ${reach.size}/${atoms.length}`);
  }
  return problems;
}

const ball = MOLECULES.filter((m) => m.structureMode === "ballstick");
const failures = [];

const ballIds = new Set(ball.map((m) => m.id));
const geoIds = new Set(Object.keys(GEOMETRIES));
for (const id of ballIds) {
  if (!geoIds.has(id)) failures.push(`${id}: ball-and-stick with no geometry`);
}
for (const id of geoIds) {
  if (!ballIds.has(id)) failures.push(`${id}: geometry is not a ball-and-stick entry`);
}
for (const molecule of MOLECULES) {
  if (!molecule.restraint) continue;
  if (molecule.structureMode === "ballstick") {
    failures.push(`${molecule.id}: restraint entry is ball-and-stick`);
  }
  if (geoIds.has(molecule.id)) {
    failures.push(`${molecule.id}: restraint entry has geometry`);
  }
}

const lines = [];
for (const molecule of ball) {
  const geo = GEOMETRIES[molecule.id];
  if (!geo) continue;
  const fromAtoms = atomCounts(geo.atoms);
  const stated = parseFormula(molecule.formula);
  const stored = geo.formula ? parseFormula(geo.formula) : null;
  const local = [];
  if (!molecule.formula) local.push("missing formula");
  if (!sameCounts(fromAtoms, stated)) local.push(`formula ${molecule.formula} != atoms`);
  if (stored && !sameCounts(fromAtoms, stored)) local.push(`stored formula ${geo.formula} != atoms`);
  local.push(...problemsFor(geo));
  const mark = local.length ? "FAIL" : "ok";
  const counts = Object.entries(fromAtoms)
    .map(([el, n]) => `${el}${n}`)
    .join("");
  lines.push(`${mark}  ${molecule.id}  ${molecule.formula}  atoms ${geo.atoms.length} (${counts})  bonds ${geo.bonds.length}`);
  for (const problem of local) failures.push(`${molecule.id}: ${problem}`);
}

console.log(lines.join("\n"));
console.log(`\n${ball.length} ball-and-stick models, ${failures.length} problems`);
if (failures.length) {
  console.log(failures.join("\n"));
  process.exit(1);
}
