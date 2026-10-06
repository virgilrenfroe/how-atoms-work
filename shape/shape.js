import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GEOMETRY } from './geometry.js';

// ---------- constants (chemistry values are cited in NOTES.md) ----------
const VOID = 0x1d0c23;
const COLORS = {
  H: 0xffffff, C: 0x55555c, N: 0x3050f8, O: 0xff0d0d, S: 0xffff30,
  bonded: 0x5fd6c6, lone: 0xf0c45c,
};
const ATOM_DRAW = { H: 0.26, C: 0.34, N: 0.33, O: 0.33, S: 0.40 };
const MOL_SCALE = 1.85;
const CENTRAL = { CO2: 'C', SO3: 'S', CH4: 'C', NH3: 'N', H2O: 'O' };

// Measured gas-phase values (NIST CCCBDB) — shown on stage; model uses PubChem coords.
const FACTS = {
  CO2: {
    title: 'Linear',
    formula: 'CO₂',
    angleLabel: '180°',
    angle: 180,
    say: 'Carbon dioxide has two electron domains around carbon and no lone pairs. The two oxygens sit opposite each other, so the molecule is a straight line.',
    rows: [
      ['', 'CO₂'],
      ['Shape', 'linear'],
      ['Domains', '2 bonded · 0 lone'],
      ['Bond', 'C=O 1.162 Å'],
      ['Angle', '∠ O–C–O = 180°'],
    ],
    lone: 0,
  },
  SO3: {
    title: 'Trigonal planar',
    formula: 'SO₃',
    angleLabel: '120°',
    angle: 120,
    say: 'Sulfur trioxide has three electron domains and no lone pairs on sulfur. The three oxygens sit in one flat plane, 120° apart.',
    rows: [
      ['', 'SO₃'],
      ['Shape', 'trigonal planar'],
      ['Domains', '3 bonded · 0 lone'],
      ['Bond', 'S=O 1.418 Å'],
      ['Angle', '∠ O–S–O = 120°'],
    ],
    lone: 0,
  },
  CH4: {
    title: 'Tetrahedral',
    formula: 'CH₄',
    angleLabel: '109.5°',
    angle: 109.5,
    say: 'Methane has four bonded pairs and no lone pairs. The hydrogens point to the corners of a tetrahedron. With nothing squeezing them, the angle stays near 109.5°.',
    rows: [
      ['', 'CH₄'],
      ['Shape', 'tetrahedral'],
      ['Domains', '4 bonded · 0 lone'],
      ['Bond', 'C–H 1.087 Å'],
      ['Angle', '∠ H–C–H ≈ 109.5°'],
    ],
    lone: 0,
  },
  NH3: {
    title: 'Trigonal pyramidal',
    formula: 'NH₃',
    angleLabel: '107°',
    angle: 107,
    say: 'Ammonia has three bonded pairs and one lone pair. The lone pair (gold) takes more room than a bonded pair, so it pushes the hydrogens into a pyramid and the angle down to about 107°.',
    rows: [
      ['', 'NH₃'],
      ['Shape', 'trigonal pyramidal'],
      ['Domains', '3 bonded · 1 lone'],
      ['Bond', 'N–H 1.012 Å'],
      ['Angle', '∠ H–N–H ≈ 107°'],
    ],
    lone: 1,
  },
  H2O: {
    title: 'Bent',
    formula: 'H₂O',
    angleLabel: '104.5°',
    angle: 104.5,
    say: 'Water has two bonded pairs and two lone pairs. The two lone pairs (gold) bend the molecule and squeeze the H–O–H angle to about 104.5°. That bend is why water is polar.',
    rows: [
      ['', 'H₂O'],
      ['Shape', 'bent'],
      ['Domains', '2 bonded · 2 lone'],
      ['Bond', 'O–H 0.958 Å'],
      ['Angle', '∠ H–O–H ≈ 104.5°'],
    ],
    lone: 2,
  },
};

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ua = navigator.userAgent || '';
const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isMobile = isIOS || matchMedia('(pointer: coarse)').matches || matchMedia('(max-width: 720px)').matches;
const SEG = isMobile ? [24, 20] : [32, 28];
const ESEG = isMobile ? [16, 14] : [24, 20];

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

const electronMat = new THREE.MeshBasicMaterial({ color: COLORS.bonded });
const loneMat = new THREE.MeshBasicMaterial({ color: COLORS.lone });
const electronGeo = new THREE.SphereGeometry(1, ESEG[0], ESEG[1]);
const sphereGeo = new THREE.SphereGeometry(1, SEG[0], SEG[1]);
const stickGeo = new THREE.CylinderGeometry(1, 1, 1, isMobile ? 8 : 14);

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
function ringLine(radius, color, opacity = 0.22) {
  const pts = [];
  const n = 64;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0));
  }
  const g = new THREE.BufferGeometry().setFromPoints(pts);
  const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  return new THREE.LineLoop(g, m);
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
  camera.position.set(0, 0.6, 12);
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
  const st = { el, renderer, scene, camera, controls, labels: [], visible: false, fit: { w: 5, h: 5 }, update: null, size: [1, 1] };
  st.label = (text, cls = '') => {
    const d = document.createElement('span');
    d.className = 'lbl ' + cls;
    d.textContent = text;
    el.appendChild(d);
    const L = { el: d, obj: null, offset: new THREE.Vector3(), px: [0, 0], on: true };
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
    const dist = Math.max(st.fit.h / t, st.fit.w / (t * camera.aspect)) * 1.18;
    const dir = camera.position.clone().sub(controls ? controls.target : new THREE.Vector3());
    if (dir.lengthSq() < 1e-6) dir.set(0, 0.15, 1);
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

/** Directions for lone pairs that complete a tetrahedron with the bonded neighbors. */
function lonePairDirs(center, neighbors, count) {
  if (count <= 0) return [];
  const bondDirs = neighbors.map((n) => n.clone().sub(center).normalize());
  if (count === 1) {
    // opposite the average of the three bond directions
    const sum = bondDirs.reduce((a, d) => a.add(d), new THREE.Vector3()).normalize();
    return [sum.multiplyScalar(-1)];
  }
  if (count === 2 && bondDirs.length === 2) {
    // complete tetrahedron: find two directions that with bondDirs are mutually ~109.5°
    const a = bondDirs[0], b = bondDirs[1];
    const bisector = a.clone().add(b).normalize();
    const plane = new THREE.Vector3().crossVectors(a, b).normalize();
    // If bonds are coplanar-ish with a flat angle, plane is fine; for water they are not collinear.
    // Rotate around the bond-bisector axis to place lone pairs above/below the H–O–H plane.
    const out = bisector.clone().multiplyScalar(-1);
    // Build an orthonormal basis: out (in plane of bonds, away from H), and plane (perp to HOH).
    // Lone pairs sit at ±acos(1/3) from out in the out–plane plane... actually standard:
    // Tetrahedral: two lone dirs = normalize(-bisector ± plane * tan(half)).
    const half = Math.acos(-1 / 3) / 2; // ~54.75° from tetrahedral axis pairs
    // Better: construct tetrahedron from two known vectors.
    // Let midplane normal = plane. Rotate out by ±θ around plane? 
    // Classic approach: find vector perpendicular to both bonds' bisector in the HOH plane = plane×bisector
    const inPlane = new THREE.Vector3().crossVectors(plane, bisector).normalize();
    // For water, lone pairs are roughly tetrahedral: from O, directions that average opposite bisector
    // and are separated in the plane perpendicular to the HOH plane (i.e. along ±plane from -bisector).
    const spread = Math.tan(Math.acos(-1 / 3) / 2) * 2.4;
    const d1 = out.clone().addScaledVector(plane, spread).normalize();
    const d2 = out.clone().addScaledVector(plane, -spread).normalize();
    // Prefer the side away from hydrogens: out already points away if bisector pointed toward H mean.
    void inPlane;
    void half;
    return [d1, d2];
  }
  return [];
}

function buildShapeScene(st) {
  const root = new THREE.Group();
  st.scene.add(root);
  const mats = {};
  const mat = (el) => (mats[el] ||= satin(st.renderer, COLORS[el], el === 'H' ? 0.04 : el === 'C' ? 0.02 : 0.08));
  const stickMat = new THREE.MeshStandardMaterial({ color: 0xd8cfe0, roughness: 0.55, metalness: 0.15 });

  const molGroup = new THREE.Group();
  root.add(molGroup);
  let content = new THREE.Group();
  molGroup.add(content);

  const lblTitle = st.label('', 'big');
  const titleAnchor = new THREE.Object3D();
  molGroup.add(titleAnchor);
  lblTitle.obj = titleAnchor;

  const lblAngle = st.label('', 'angle');
  const angleAnchor = new THREE.Object3D();
  molGroup.add(angleAnchor);
  lblAngle.obj = angleAnchor;

  const lblFormula = st.label('', 'dim');
  const formulaAnchor = new THREE.Object3D();
  molGroup.add(formulaAnchor);
  lblFormula.obj = formulaAnchor;

  const pairSpinners = []; // { heads: Mesh[], center: Vector3, axis: Vector3, radius, phase }
  const atomLabels = [];

  const say = document.getElementById('shape-say');
  const read = document.getElementById('shape-read');
  const cap = document.getElementById('shape-cap');

  function table(rows) {
    read.innerHTML = rows.map((r, i) => `<tr>${r.map((c, j) => (i === 0 || j === 0 ? `<th>${c}</th>` : `<td><b>${c}</b></td>`)).join('')}</tr>`).join('');
  }

  function clearMol() {
    molGroup.remove(content);
    content.traverse((o) => {
      if (o.geometry && o.geometry !== sphereGeo && o.geometry !== stickGeo && o.geometry !== electronGeo) o.geometry.dispose?.();
    });
    content = new THREE.Group();
    molGroup.add(content);
    pairSpinners.length = 0;
    for (const L of atomLabels) {
      L.on = false;
      L.el.remove();
      const ix = st.labels.indexOf(L);
      if (ix >= 0) st.labels.splice(ix, 1);
    }
    atomLabels.length = 0;
  }

  function show(id) {
    clearMol();
    const geo = GEOMETRY[id];
    const fact = FACTS[id];
    const atoms = geo.atoms.map(([el, x, y, z]) => ({ el, p: new THREE.Vector3(x, y, z) }));
    const c = atoms.reduce((a, at) => a.add(at.p), new THREE.Vector3()).multiplyScalar(1 / atoms.length);
    atoms.forEach((at) => at.p.sub(c).multiplyScalar(MOL_SCALE));

    // Orient: put central atom at origin already roughly; lift so lone pairs read clearly
    const ci = atoms.findIndex((a) => a.el === CENTRAL[id]);
    const center = atoms[ci].p.clone();
    atoms.forEach((at) => at.p.sub(center));

    // Align average of neighbors toward -Y for pyramidal/bent so lone pairs point +Y
    const neighIdx = [];
    for (const [i, j] of geo.bonds) {
      if (i === ci) neighIdx.push(j);
      if (j === ci) neighIdx.push(i);
    }
    const neighPts = neighIdx.map((i) => atoms[i].p.clone());
    if (fact.lone > 0 && neighPts.length) {
      const avg = neighPts.reduce((a, p) => a.add(p), new THREE.Vector3()).normalize();
      // rotate so avg goes to (0,-1,0)
      const target = new THREE.Vector3(0, -1, 0);
      const q = new THREE.Quaternion().setFromUnitVectors(avg, target);
      atoms.forEach((at) => at.p.applyQuaternion(q));
      neighPts.forEach((p) => p.applyQuaternion(q));
    } else if (id === 'CO2') {
      // lay along X
      const axis = atoms[neighIdx[0]].p.clone().normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(axis, new THREE.Vector3(1, 0, 0));
      atoms.forEach((at) => at.p.applyQuaternion(q));
    } else if (id === 'SO3') {
      // flatten to XY
      const n0 = atoms[neighIdx[0]].p.clone().normalize();
      const n1 = atoms[neighIdx[1]].p.clone().normalize();
      const normal = new THREE.Vector3().crossVectors(n0, n1).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(normal, new THREE.Vector3(0, 0, 1));
      atoms.forEach((at) => at.p.applyQuaternion(q));
    }

    const centerP = atoms[ci].p;
    for (const at of atoms) {
      const m = new THREE.Mesh(sphereGeo, mat(at.el));
      m.position.copy(at.p);
      m.scale.setScalar(ATOM_DRAW[at.el] * MOL_SCALE);
      content.add(m);
      const L = st.label(at.el, 'atom');
      L.obj = m;
      L.offset.set(0, ATOM_DRAW[at.el] * MOL_SCALE + 0.18, 0);
      atomLabels.push(L);
    }

    for (const [i, j, order] of geo.bonds) {
      const a = atoms[i].p, b = atoms[j].p;
      const axis = new THREE.Vector3().subVectors(b, a).normalize();
      const side = perpendicular(axis);
      const gap = 0.12;
      for (let k = 0; k < order; k++) {
        const off = side.clone().multiplyScalar((k - (order - 1) / 2) * gap);
        content.add(stick(a.clone().add(off), b.clone().add(off), order === 1 ? 0.055 : 0.04, stickMat));
      }
      // bonded pair: one faint ring with two electron heads mid-bond (for VSEPR, one domain per bond)
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const ringR = 0.28;
      const ring = ringLine(ringR, COLORS.bonded, 0.28);
      ring.position.copy(mid);
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis);
      content.add(ring);
      const heads = [];
      for (let h = 0; h < 2; h++) {
        const e = new THREE.Mesh(electronGeo, electronMat);
        e.scale.setScalar(0.07);
        content.add(e);
        heads.push(e);
      }
      pairSpinners.push({ heads, center: mid.clone(), axis: axis.clone(), radius: ringR, phase: Math.random() * Math.PI * 2, color: 'bonded' });
    }

    // lone pairs
    const loneDirs = lonePairDirs(centerP, neighIdx.map((i) => atoms[i].p), fact.lone);
    const loneDist = 0.72 * MOL_SCALE;
    for (const dir of loneDirs) {
      const mid = centerP.clone().addScaledVector(dir, loneDist * 0.72);
      const ringR = 0.26;
      const ring = ringLine(ringR, COLORS.lone, 0.35);
      ring.position.copy(mid);
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      content.add(ring);
      const heads = [];
      for (let h = 0; h < 2; h++) {
        const e = new THREE.Mesh(electronGeo, loneMat);
        e.scale.setScalar(0.075);
        content.add(e);
        heads.push(e);
      }
      pairSpinners.push({ heads, center: mid.clone(), axis: dir.clone(), radius: ringR, phase: Math.random() * Math.PI * 2, color: 'lone' });
    }

    // angle arc hint between first two neighbors
    if (neighIdx.length >= 2) {
      const u = atoms[neighIdx[0]].p.clone().sub(centerP).normalize();
      const v = atoms[neighIdx[1]].p.clone().sub(centerP).normalize();
      const arcR = 0.95 * MOL_SCALE;
      const ang = u.angleTo(v);
      const normal = new THREE.Vector3().crossVectors(u, v).normalize();
      if (normal.lengthSq() < 1e-6) normal.set(0, 0, 1);
      const pts = [];
      const steps = 32;
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * ang;
        const q = new THREE.Quaternion().setFromAxisAngle(normal, t);
        pts.push(centerP.clone().add(u.clone().applyQuaternion(q).multiplyScalar(arcR)));
      }
      const arc = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0xff6b3d, transparent: true, opacity: 0.85 }),
      );
      content.add(arc);
      const midDir = u.clone().add(v).normalize();
      angleAnchor.position.copy(centerP).addScaledVector(midDir, arcR + 0.35);
    } else {
      angleAnchor.position.set(0, 1.2, 0);
    }

    titleAnchor.position.set(0, id === 'CO2' ? 1.6 : 2.15, 0);
    formulaAnchor.position.set(0, id === 'CO2' ? -1.55 : -2.05, 0);
    lblTitle.el.textContent = fact.title;
    lblAngle.el.textContent = fact.angleLabel;
    lblFormula.el.textContent = fact.formula;

    say.textContent = fact.say;
    table(fact.rows);
    cap.textContent = `${geo.source}. Measured angle ${fact.angleLabel} (NIST CCCBDB).`;

    // fit
    let maxR = 0;
    atoms.forEach((at) => { maxR = Math.max(maxR, at.p.length() + ATOM_DRAW[at.el] * MOL_SCALE); });
    maxR = Math.max(maxR, 2.4);
    st.fit = { w: maxR * 2.1, h: maxR * 2.2 };
    st.refit();
  }

  st.setStep = show;
  st.update = (dt, t) => {
    if (!reduceMotion) molGroup.rotation.y += dt * 0.18;
    const tt = reduceMotion ? 0 : t;
    for (const p of pairSpinners) {
      // basis around axis
      const ax = p.axis;
      const side = perpendicular(ax);
      const up = new THREE.Vector3().crossVectors(ax, side).normalize();
      p.heads.forEach((e, i) => {
        const a = p.phase + tt * 1.4 + i * Math.PI;
        e.position.copy(p.center)
          .addScaledVector(side, Math.cos(a) * p.radius)
          .addScaledVector(up, Math.sin(a) * p.radius);
      });
    }
  };
  show('CO2');
}

// ---------- wire UI ----------
const shapeEl = document.querySelector('.stage[data-scene="shape"]');
const shapeStage = makeStage(shapeEl);
buildShapeScene(shapeStage);

document.querySelectorAll('[data-steps="shape"] button').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-steps="shape"] button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
    btn.setAttribute('aria-pressed', 'true');
    shapeStage.setStep(btn.dataset.step);
  });
});

// ---------- loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const t = now / 1000;
  for (const st of stages) {
    if (!st.visible) continue;
    st.update?.(dt, t);
    st.render();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
addEventListener('resize', () => { for (const st of stages) st.resize(); });
