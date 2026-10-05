// Checks every ball-and-stick model: the atom list matches the stated
// formula, and every atom has a valid valence.
//
//   node molecules/check-geometries.mjs
//
// Bond order 4 (aromatic) and 5 (a delocalized pair) skip the classical
// bond-order sum. Degree is still checked. Hydrogens must be degree 1.

import { MOLECULES } from "./molecules-data.js";
import { GEOMETRIES } from "./geometries.js";

const DEGREE = { H: new Set([1]), C: new Set([2, 3, 4]), N: new Set([2, 3]), O: new Set([1, 2]), S: new Set([1, 2]) };
const CLASSICAL = { H: 1, C: 4, N: 3, O: 2, S: 2 };

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
    if (![1, 2, 3, 4, 5].includes(order)) {
      problems.push(`bad order ${order}`);
      continue;
    }
    degree[a] += 1;
    degree[b] += 1;
    adj[a].push(b);
    adj[b].push(a);
    if (order === 4 || order === 5) {
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
    if (atom.el === "H" && orderSum[i] !== 1) problems.push(`H${i} order ${orderSum[i]}`);
    if (!special[i] && orderSum[i] !== CLASSICAL[atom.el]) {
      problems.push(`${atom.el}${i} valence ${orderSum[i]}`);
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
