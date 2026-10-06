import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GEOMETRY } from './geometry.js';

// ---------- constants (chemistry values are cited in NOTES.md) ----------
const VOID = 0x1d0c23;
const COLORS = { H: 0xffffff, C: 0x55555c, O: 0xff0d0d };
const ATOM_DRAW = { H: 0.26, C: 0.34, O: 0.33 };
const MOL_SCALE = 1.55;
const STICK_R = 0.07;

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ua = navigator.userAgent || '';
const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isMobile = isIOS || matchMedia('(pointer: coarse)').matches || matchMedia('(max-width: 720px)').matches;
const SEG = isMobile ? [24, 20] : [32, 28];

function satin(renderer, color, emissive = 0.06) {
  const gl = renderer.getContext();
  const webgl2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
  const aniso = !isMobile && webgl2;
  const m = new THREE.MeshPhysicalMaterial({
    color, metalness: 0.32, roughness: 0.45, clearcoat: 0.22, clearcoatRoughness: 0.38,
    emissive: color, emissiveIntensity: emissive,
    anisotropy: aniso ? 0.55 : 0,
  });
  if (aniso) m.anisotropyRotation = Math.PI / 2;
  return m;
}

const sphereGeo = new THREE.SphereGeometry(1, SEG[0], SEG[1]);
const stickGeo = new THREE.CylinderGeometry(1, 1, 1, isMobile ? 8 : 14);
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function stick(a, b, radius, mat) {
  const m = new THREE.Mesh(stickGeo, mat);
  const d = new THREE.Vector3().subVectors(b, a);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.scale.set(radius, d.length(), radius);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  return m;
}
function perpendicular(v) {
  const t = Math.abs(v.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
  return new THREE.Vector3().crossVectors(v, t).normalize();
}

function cloneGeom(id) {
  const g = GEOMETRY[id];
  return {
    id,
    atoms: g.atoms.map((a) => [a[0], a[1], a[2], a[3]]),
    bonds: g.bonds.map((b) => [...b]),
  };
}

/** Place a molecule copy at an origin with optional yaw (radians). Returns local atom world positions. */
function placeMolecule(geom, origin, yaw = 0) {
  const c = new THREE.Vector3();
  for (const a of geom.atoms) c.add(new THREE.Vector3(a[1], a[2], a[3]));
  c.multiplyScalar(1 / geom.atoms.length);
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const atoms = geom.atoms.map(([el, x, y, z]) => {
    const p = new THREE.Vector3(x, y, z).sub(c).applyQuaternion(q).multiplyScalar(MOL_SCALE).add(origin);
    return { el, p };
  });
  const bonds = geom.bonds.map(([i, j, o]) => ({ i, j, o }));
  return { atoms, bonds, label: geom.id };
}

// ---------- stage ----------
const stages = [];
function makeStage(el) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: isIOS ? 'default' : 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(VOID, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  el.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.5;
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xc4b8e0, 0x2a1218, 0.6));
  const key = new THREE.PointLight(0xffb36b, 1.5, 60, 1.6);
  key.position.set(5, 6, 8);
  scene.add(key);
  const fill = new THREE.PointLight(0x6a8cff, 0.4, 50, 2);
  fill.position.set(-6, -2, -4);
  scene.add(fill);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
  camera.position.set(0, 0.4, 14);
  let controls = null;
  if (!isMobile) {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    renderer.domElement.style.cursor = 'grab';
  } else {
    renderer.domElement.style.touchAction = 'pan-y';
  }
  const st = { el, renderer, scene, camera, controls, labels: [], visible: false, fit: { w: 6, h: 5 }, update: null, size: [1, 1] };
  st.label = (text, cls = '') => {
    const d = document.createElement('span');
    d.className = 'lbl ' + cls;
    d.textContent = text;
    el.appendChild(d);
    const L = { el: d, obj: null, offset: new THREE.Vector3(), on: true };
    st.labels.push(L);
    return L;
  };
  st.resize = () => {
    const w = el.clientWidth || 1, h = el.clientHeight || 1;
    st.size = [w, h];
    camera.aspect = w / h;
    renderer.setSize(w, h, isMobile);
    st.refit();
  };
  st.refit = () => {
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const dist = Math.max(st.fit.h / t, st.fit.w / (t * camera.aspect)) * 1.2;
    const dir = camera.position.clone().sub(controls ? controls.target : new THREE.Vector3());
    if (dir.lengthSq() < 1e-6) dir.set(0, 0.1, 1);
    camera.position.copy(dir.normalize().multiplyScalar(dist));
    camera.near = dist / 20; camera.far = dist * 6;
    camera.updateProjectionMatrix();
    if (controls) controls.update();
  };
  const v = new THREE.Vector3();
  st.render = () => {
    if (controls) controls.update();
    renderer.render(scene, camera);
    const [w, h] = st.size;
    for (const L of st.labels) {
      if (!L.on || !L.obj || !L.obj.visible) { L.el.style.display = 'none'; continue; }
      L.obj.getWorldPosition(v).add(L.offset);
      v.project(camera);
      if (v.z > 1) { L.el.style.display = 'none'; continue; }
      L.el.style.display = '';
      L.el.style.transform = `translate(${((v.x + 1) / 2 * w).toFixed(1)}px, ${((1 - v.y) / 2 * h).toFixed(1)}px) translate(-50%, -50%)`;
    }
  };
  new ResizeObserver(st.resize).observe(el);
  new IntersectionObserver((ents) => { for (const e of ents) st.visible = e.isIntersecting; }, { rootMargin: '120px' }).observe(el);
  stages.push(st);
  return st;
}

function matsFor(renderer) {
  return {
    H: satin(renderer, COLORS.H, 0.04),
    C: satin(renderer, COLORS.C, 0.05),
    O: satin(renderer, COLORS.O, 0.07),
    stick: satin(renderer, 0xb8a8c4, 0.02),
  };
}

/** Build a bond mesh group for a placed molecule; opacity controllable. */
function buildBondMeshes(placed, mats, opacity = 1) {
  const g = new THREE.Group();
  const sticks = [];
  for (const b of placed.bonds) {
    const a = placed.atoms[b.i].p;
    const c = placed.atoms[b.j].p;
    const n = b.o;
    const dir = new THREE.Vector3().subVectors(c, a);
    const perp = perpendicular(dir).multiplyScalar(0.12 * MOL_SCALE);
    for (let k = 0; k < n; k++) {
      const off = n === 1 ? 0 : (k - (n - 1) / 2);
      const aa = a.clone().addScaledVector(perp, off);
      const bb = c.clone().addScaledVector(perp, off);
      const mat = mats.stick.clone();
      mat.transparent = true;
      mat.opacity = opacity;
      mat.depthWrite = opacity > 0.95;
      const m = stick(aa, bb, STICK_R * MOL_SCALE, mat);
      g.add(m);
      sticks.push(m);
    }
  }
  return { group: g, sticks };
}

function countAtoms(placedList) {
  const c = {};
  for (const pl of placedList) for (const a of pl.atoms) c[a.el] = (c[a.el] || 0) + 1;
  return c;
}

function fillTally(table, left, right, elements) {
  const rows = [['', 'Left', 'Right', '']];
  for (const el of elements) {
    const L = left[el] || 0;
    const R = right[el] || 0;
    const ok = L === R;
    rows.push([el, String(L), String(R), ok ? 'balanced' : 'not yet']);
  }
  table.innerHTML = `<thead><tr>${rows[0].map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${
    rows.slice(1).map((r) => {
      const cls = r[3] === 'balanced' ? 'bal' : 'unbal';
      return `<tr><td><b>${r[0]}</b></td><td>${r[1]}</td><td>${r[2]}</td><td class="${cls}">${r[3]}</td></tr>`;
    }).join('')
  }</tbody>`;
}

// ---------- morph scene: atoms move from reactant layout to product layout ----------
function buildMorphScene(st, config) {
  const { renderer, scene } = st;
  const mats = matsFor(renderer);
  const root = new THREE.Group();
  scene.add(root);

  const reactantPlaced = config.reactants();
  const productPlaced = config.products();
  const leftCount = countAtoms(reactantPlaced);
  const rightCount = countAtoms(productPlaced);

  // Flatten atoms with matching by element order
  function flat(placedList) {
    const out = [];
    for (const pl of placedList) for (const a of pl.atoms) out.push({ el: a.el, p: a.p.clone(), mol: pl });
    return out;
  }
  const fromAtoms = flat(reactantPlaced);
  const toAtoms = flat(productPlaced);
  // Match by element: stable pairing
  const used = new Set();
  const pairs = fromAtoms.map((fa) => {
    let best = -1, bestD = Infinity;
    for (let i = 0; i < toAtoms.length; i++) {
      if (used.has(i) || toAtoms[i].el !== fa.el) continue;
      const d = fa.p.distanceTo(toAtoms[i].p);
      if (d < bestD) { bestD = d; best = i; }
    }
    if (best < 0) {
      for (let i = 0; i < toAtoms.length; i++) {
        if (!used.has(i) && toAtoms[i].el === fa.el) { best = i; break; }
      }
    }
    used.add(best);
    return { el: fa.el, from: fa.p, to: toAtoms[best].p };
  });

  const atomMeshes = [];
  const atomLabels = [];
  for (const p of pairs) {
    const mesh = new THREE.Mesh(sphereGeo, mats[p.el]);
    mesh.scale.setScalar(ATOM_DRAW[p.el] * MOL_SCALE);
    mesh.position.copy(p.from);
    root.add(mesh);
    atomMeshes.push({ mesh, from: p.from, to: p.to, el: p.el });
    const L = st.label(p.el, 'atom');
    L.obj = mesh;
    L.offset.set(0, ATOM_DRAW[p.el] * MOL_SCALE * 1.35, 0);
    atomLabels.push(L);
  }

  const reactBonds = [];
  for (const pl of reactantPlaced) {
    const b = buildBondMeshes(pl, mats, 1);
    root.add(b.group);
    reactBonds.push(b);
  }
  const prodBonds = [];
  for (const pl of productPlaced) {
    const b = buildBondMeshes(pl, mats, 0);
    root.add(b.group);
    prodBonds.push(b);
  }

  // Side labels
  const leftAnchor = new THREE.Object3D();
  leftAnchor.position.set(-3.2, 2.6, 0);
  root.add(leftAnchor);
  const rightAnchor = new THREE.Object3D();
  rightAnchor.position.set(3.2, 2.6, 0);
  root.add(rightAnchor);
  const lblL = st.label(config.leftTitle, 'big'); lblL.obj = leftAnchor;
  const lblR = st.label(config.rightTitle, 'big'); lblR.obj = rightAnchor;

  let step = 0;
  let morph = 0; // 0 reactants, 1 products
  let anim = null;

  function setBondOpacity(bondSets, opacity) {
    for (const b of bondSets) {
      for (const m of b.sticks) {
        m.material.opacity = opacity;
        m.material.transparent = opacity < 0.99;
        m.material.depthWrite = opacity > 0.95;
        m.visible = opacity > 0.02;
      }
    }
  }

  function applyMorph(u) {
    morph = u;
    for (const a of atomMeshes) {
      a.mesh.position.lerpVectors(a.from, a.to, u);
    }
    // Bonds: reactants fade out mid-way, products fade in mid-way
    const reactOp = u < 0.45 ? 1 - u / 0.45 : 0;
    const prodOp = u > 0.55 ? (u - 0.55) / 0.45 : 0;
    setBondOpacity(reactBonds, reactOp);
    setBondOpacity(prodBonds, prodOp);
    lblL.on = u < 0.55;
    lblR.on = u > 0.45;
    lblL.el.style.opacity = String(Math.max(0, 1 - u * 1.6));
    lblR.el.style.opacity = String(Math.max(0, (u - 0.35) / 0.65));
  }

  function setStep(s) {
    step = s;
    const say = document.getElementById(config.sayId);
    const tally = document.getElementById(config.tallyId);
    fillTally(tally, leftCount, rightCount, config.elements);
    if (say) say.textContent = config.says[s];
    const target = s === 0 ? 0 : s === 2 ? 1 : 0.5;
    if (reduceMotion) {
      applyMorph(target);
      anim = null;
    } else {
      anim = { from: morph, to: target, t: 0, dur: s === 1 ? 1.1 : 0.85 };
    }
    // fit box
    const all = [...pairs.map((p) => p.from), ...pairs.map((p) => p.to)];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of all) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    st.fit = { w: Math.max(5, maxX - minX + 2.5), h: Math.max(4, maxY - minY + 2.8) };
    st.refit();
  }

  st.setStep = setStep;
  st.update = (dt) => {
    if (!reduceMotion) root.rotation.y += dt * 0.12;
    if (anim) {
      anim.t += dt / anim.dur;
      const u = ease(Math.min(1, anim.t));
      applyMorph(anim.from + (anim.to - anim.from) * u);
      if (anim.t >= 1) anim = null;
    }
  };
  setStep(0);
  return st;
}

// Scene A: 2 H2 + O2 → 2 H2O
function buildConserve(st) {
  return buildMorphScene(st, {
    sayId: 'conserve-say',
    tallyId: 'conserve-tally',
    elements: ['H', 'O'],
    leftTitle: 'Reactants',
    rightTitle: 'Products',
    says: [
      'Two H₂ molecules and one O₂ molecule. Atom tally: 4 H and 2 O.',
      'Bonds rearrange. The same four hydrogens and two oxygens are still here — only the connections change.',
      'Two H₂O molecules. Atom tally: still 4 H and 2 O. Conserved.',
    ],
    reactants: () => [
      placeMolecule(cloneGeom('H2'), new THREE.Vector3(-3.2, 0.9, 0.2), 0.2),
      placeMolecule(cloneGeom('H2'), new THREE.Vector3(-3.2, -1.0, -0.2), -0.35),
      placeMolecule(cloneGeom('O2'), new THREE.Vector3(-0.6, 0, 0), 0.5),
    ],
    products: () => [
      placeMolecule(cloneGeom('H2O'), new THREE.Vector3(2.2, 1.0, 0.15), 0.4),
      placeMolecule(cloneGeom('H2O'), new THREE.Vector3(2.4, -1.1, -0.1), -0.55),
    ],
  });
}

// Scene B: CH4 + 2 O2 → CO2 + 2 H2O
function buildCombust(st) {
  return buildMorphScene(st, {
    sayId: 'combust-say',
    tallyId: 'combust-tally',
    elements: ['C', 'H', 'O'],
    leftTitle: 'Reactants',
    rightTitle: 'Products',
    says: [
      'One methane and two oxygen molecules. Atom tally: 1 C, 4 H, 4 O.',
      'The fuel and oxygen rearrange. Carbon keeps its four connections in a new pattern; hydrogens move to oxygen.',
      'Carbon dioxide and two waters. Atom tally: still 1 C, 4 H, 4 O.',
    ],
    reactants: () => [
      placeMolecule(cloneGeom('CH4'), new THREE.Vector3(-3.4, 0.2, 0), 0.3),
      placeMolecule(cloneGeom('O2'), new THREE.Vector3(-0.9, 1.3, 0.2), 0.8),
      placeMolecule(cloneGeom('O2'), new THREE.Vector3(-0.7, -1.2, -0.15), -0.4),
    ],
    products: () => [
      placeMolecule(cloneGeom('CO2'), new THREE.Vector3(2.0, 1.2, 0), 0.2),
      placeMolecule(cloneGeom('H2O'), new THREE.Vector3(2.6, -0.3, 0.4), 0.6),
      placeMolecule(cloneGeom('H2O'), new THREE.Vector3(2.3, -1.5, -0.2), -0.3),
    ],
  });
}

// Scene C: 2 H2O2 → 2 H2O + O2
function buildDecompose(st) {
  return buildMorphScene(st, {
    sayId: 'decompose-say',
    tallyId: 'decompose-tally',
    elements: ['H', 'O'],
    leftTitle: 'Reactants',
    rightTitle: 'Products',
    says: [
      'Two hydrogen peroxide molecules. Atom tally: 4 H and 4 O.',
      'Each peroxide splits. The atoms rearrange into water and oxygen gas — still 4 H and 4 O.',
      'Two waters and one O₂. Atom tally unchanged. That is decomposition.',
    ],
    reactants: () => [
      placeMolecule(cloneGeom('H2O2'), new THREE.Vector3(-2.8, 1.0, 0), 0.5),
      placeMolecule(cloneGeom('H2O2'), new THREE.Vector3(-2.6, -1.2, 0.1), -0.7),
    ],
    products: () => [
      placeMolecule(cloneGeom('H2O'), new THREE.Vector3(2.0, 1.3, 0.1), 0.3),
      placeMolecule(cloneGeom('H2O'), new THREE.Vector3(2.3, -0.2, -0.2), -0.5),
      placeMolecule(cloneGeom('O2'), new THREE.Vector3(2.1, -1.6, 0.15), 0.9),
    ],
  });
}

// Scene D: balance interactive
function buildBalance(st) {
  const { renderer, scene } = st;
  const mats = matsFor(renderer);
  const root = new THREE.Group();
  scene.add(root);
  const state = { h2: 1, o2: 1, h2o: 1 };
  let content = new THREE.Group();
  root.add(content);

  function clearContent() {
    while (content.children.length) content.remove(content.children[0]);
    for (const L of st.labels) { L.on = false; L.el.style.display = 'none'; }
    // keep rebuilding labels each time — remove old label els we created for molecules
    // Simpler: wipe label nodes that are atom/big from previous rebuild except we recreate
  }

  // Manage dynamic labels separately
  const dynLabels = [];
  function wipeDyn() {
    for (const L of dynLabels) {
      L.el.remove();
      const ix = st.labels.indexOf(L);
      if (ix >= 0) st.labels.splice(ix, 1);
    }
    dynLabels.length = 0;
  }
  function addLbl(text, cls, obj, offset) {
    const L = st.label(text, cls);
    L.obj = obj;
    if (offset) L.offset.copy(offset);
    dynLabels.push(L);
    return L;
  }

  function layoutRow(ids, y, x0, gap) {
    const placed = [];
    let x = x0;
    for (const id of ids) {
      const pl = placeMolecule(cloneGeom(id), new THREE.Vector3(x, y, 0), (placed.length % 2) * 0.35);
      placed.push(pl);
      // approximate width
      x += gap;
    }
    return placed;
  }

  function rebuild() {
    while (content.children.length) content.remove(content.children[0]);
    wipeDyn();

    const leftIds = [
      ...Array(state.h2).fill('H2'),
      ...Array(state.o2).fill('O2'),
    ];
    const rightIds = Array(state.h2o).fill('H2O');

    // layout left and right of arrow
    const leftPlaced = [];
    {
      const n = leftIds.length || 1;
      const gap = Math.min(2.1, 5.5 / Math.max(1, n));
      let x = -2.2 - ((n - 1) * gap) / 2;
      for (const id of leftIds) {
        leftPlaced.push(placeMolecule(cloneGeom(id), new THREE.Vector3(x, 0.15, 0), x * 0.08));
        x += gap;
      }
    }
    const rightPlaced = [];
    {
      const n = rightIds.length || 1;
      const gap = Math.min(2.2, 5.0 / Math.max(1, n));
      let x = 2.4 - ((n - 1) * gap) / 2;
      for (const id of rightIds) {
        rightPlaced.push(placeMolecule(cloneGeom(id), new THREE.Vector3(x, 0.15, 0), -x * 0.05));
        x += gap;
      }
    }

    for (const pl of [...leftPlaced, ...rightPlaced]) {
      for (const a of pl.atoms) {
        const mesh = new THREE.Mesh(sphereGeo, mats[a.el]);
        mesh.scale.setScalar(ATOM_DRAW[a.el] * MOL_SCALE);
        mesh.position.copy(a.p);
        content.add(mesh);
        addLbl(a.el, 'atom', mesh, new THREE.Vector3(0, ATOM_DRAW[a.el] * MOL_SCALE * 1.3, 0));
      }
      const b = buildBondMeshes(pl, mats, 1);
      content.add(b.group);
    }

    const arrow = new THREE.Object3D();
    arrow.position.set(0.15, 2.2, 0);
    content.add(arrow);
    addLbl('→', 'big', arrow);

    const leftC = countAtoms(leftPlaced);
    const rightC = countAtoms(rightPlaced);
    const els = ['H', 'O'];
    fillTally(document.getElementById('balance-tally'), leftC, rightC, els);
    const bal = els.every((e) => (leftC[e] || 0) === (rightC[e] || 0)) && (leftC.H || 0) > 0;
    const verdict = document.getElementById('balance-verdict');
    const say = document.getElementById('balance-say');
    if (bal && state.h2 === 2 && state.o2 === 1 && state.h2o === 2) {
      verdict.textContent = 'Balanced · smallest whole numbers';
      verdict.className = 'verdict ok';
      say.textContent = 'Every atom matches, and the coefficients are the usual classroom set: 2, 1, and 2.';
    } else if (bal) {
      verdict.textContent = 'Atom counts match';
      verdict.className = 'verdict ok';
      say.textContent = 'The atoms balance. Try the smallest whole-number coefficients: 2 H₂ + O₂ → 2 H₂O.';
    } else {
      verdict.textContent = 'Not balanced yet';
      verdict.className = 'verdict no';
      say.textContent = 'Change a coefficient. Subscripts stay put — only the numbers in front move.';
    }

    document.getElementById('coef-h2').textContent = String(state.h2);
    document.getElementById('coef-o2').textContent = String(state.o2);
    document.getElementById('coef-h2o').textContent = String(state.h2o);

    const allP = [...leftPlaced, ...rightPlaced].flatMap((pl) => pl.atoms.map((a) => a.p));
    if (allP.length) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of allP) {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      }
      st.fit = { w: Math.max(6, maxX - minX + 2.8), h: Math.max(4.2, maxY - minY + 3.2) };
    } else {
      st.fit = { w: 6, h: 4 };
    }
    st.refit();
  }

  st.setCoef = (key, dir) => {
    state[key] = Math.max(0, Math.min(4, state[key] + dir));
    rebuild();
  };
  st.update = (dt) => { if (!reduceMotion) root.rotation.y += dt * 0.1; };
  rebuild();
  return st;
}

// ---------- wire steps & balance controls ----------
function wireSteps(name, stage) {
  const group = document.querySelector(`[data-steps="${name}"]`);
  if (!group) return;
  group.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-step]');
    if (!btn) return;
    for (const b of group.querySelectorAll('button')) b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
    stage.setStep(Number(btn.dataset.step));
  });
}

const conserveEl = document.querySelector('.stage[data-scene="conserve"]');
const combustEl = document.querySelector('.stage[data-scene="combust"]');
const decomposeEl = document.querySelector('.stage[data-scene="decompose"]');
const balanceEl = document.querySelector('.stage[data-scene="balance"]');

const conserve = buildConserve(makeStage(conserveEl));
const combust = buildCombust(makeStage(combustEl));
const decompose = buildDecompose(makeStage(decomposeEl));
const balance = buildBalance(makeStage(balanceEl));

wireSteps('conserve', conserve);
wireSteps('combust', combust);
wireSteps('decompose', decompose);

document.querySelectorAll('.coef').forEach((box) => {
  const key = box.dataset.coef;
  box.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-dir]');
    if (!btn) return;
    balance.setCoef(key, Number(btn.dataset.dir));
  });
});

// ---------- render loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  for (const st of stages) {
    if (!st.visible) continue;
    if (st.update) st.update(dt, now * 0.001);
    st.render();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

for (const st of stages) st.resize();
