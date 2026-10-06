import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GEOMETRY } from './geometry.js';

const VOID = 0x1d0c23;
const COLORS = {
  H: 0xffffff, C: 0x55555c, O: 0xff0d0d, Cl: 0x1ff01f, Na: 0xab5cf2,
  electron: 0x5fd6c6,
};
const ATOM_DRAW = { H: 0.26, C: 0.34, O: 0.33, Cl: 0.40, Na: 0.38 };
const R_NA = 1.02; // Shannon ionic radius Å
const ION_DRAW = 0.42;
const MOL_SCALE = 1.55;

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
  camera.position.set(0, 0, 14);
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
    const dist = Math.max(st.fit.h / t, st.fit.w / (t * camera.aspect)) * 1.12;
    const dir = camera.position.clone().sub(controls ? controls.target : new THREE.Vector3());
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
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

function buildMolecule(st, id, opts = {}) {
  const geo = GEOMETRY[id];
  const g = new THREE.Group();
  const pos = geo.atoms.map(([, x, y, z]) => new THREE.Vector3(x, y, z));
  const c = pos.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / pos.length);
  pos.forEach((p) => p.sub(c).multiplyScalar(MOL_SCALE));
  if (opts.align) opts.align(pos, geo);
  if (opts.offset) pos.forEach((p) => p.add(opts.offset));
  const mats = {};
  const mat = (el) => (mats[el] ||= satin(st.renderer, COLORS[el], el === 'H' ? 0.04 : el === 'C' ? 0.02 : 0.08));
  const stickMat = new THREE.MeshStandardMaterial({ color: 0xd8cfe0, roughness: 0.55, metalness: 0.15 });
  const atomMeshes = geo.atoms.map(([el], i) => {
    const m = new THREE.Mesh(sphereGeo, mat(el));
    m.position.copy(pos[i]);
    m.scale.setScalar(ATOM_DRAW[el] * MOL_SCALE);
    g.add(m);
    return m;
  });
  const bondMeshes = [];
  for (const [i, j, order] of geo.bonds) {
    const a = pos[i], b = pos[j];
    const axis = new THREE.Vector3().subVectors(b, a).normalize();
    const side = perpendicular(axis);
    const gap = 0.13;
    for (let k = 0; k < order; k++) {
      const off = side.clone().multiplyScalar((k - (order - 1) / 2) * gap);
      const s = stick(a.clone().add(off), b.clone().add(off), order === 1 ? 0.055 : 0.04, stickMat);
      g.add(s);
      bondMeshes.push({ mesh: s, i, j });
    }
  }
  g.userData = { pos, atomMeshes, bondMeshes, geo, id };
  return g;
}

function table(el, rows) {
  el.innerHTML = rows.map(([a, b]) => `<tr><th>${a}</th><td><b>${b}</b></td></tr>`).join('');
}

// ---------- Scene A: proton transfer HCl + H2O → H3O+ + Cl- ----------
function buildProton(st) {
  const root = new THREE.Group();
  st.scene.add(root);
  const say = document.getElementById('proton-say');
  const read = document.getElementById('proton-read');

  const hcl = buildMolecule(st, 'HCl', {
    align: (pos) => {
      const d = new THREE.Vector3().subVectors(pos[1], pos[0]).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(d, new THREE.Vector3(1, 0, 0));
      pos.forEach((p) => p.applyQuaternion(q));
    },
    offset: new THREE.Vector3(-2.4, 0, 0),
  });
  const h2o = buildMolecule(st, 'H2O', {
    align: (pos) => {
      const o = pos[0];
      const mid = pos[1].clone().add(pos[2]).multiplyScalar(0.5);
      const down = mid.clone().sub(o).normalize();
      const q1 = new THREE.Quaternion().setFromUnitVectors(down, new THREE.Vector3(0, -1, 0));
      pos.forEach((p) => p.applyQuaternion(q1));
    },
    offset: new THREE.Vector3(2.6, 0, 0),
  });
  const h3o = buildMolecule(st, 'H3O', {
    align: (pos) => {
      // tip oxygen upward-ish
      const o = pos[0];
      const cH = pos[1].clone().add(pos[2]).add(pos[3]).multiplyScalar(1 / 3);
      const up = o.clone().sub(cH).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(up, new THREE.Vector3(0, 1, 0));
      pos.forEach((p) => p.applyQuaternion(q));
    },
    offset: new THREE.Vector3(2.2, 0, 0),
  });
  const clIon = new THREE.Mesh(sphereGeo, satin(st.renderer, COLORS.Cl, 0.08));
  clIon.scale.setScalar(ATOM_DRAW.Cl * MOL_SCALE * 1.15);
  clIon.position.set(-2.4, 0, 0);

  // free proton (bare H+) during transfer
  const proton = new THREE.Mesh(sphereGeo, satin(st.renderer, COLORS.H, 0.12));
  proton.scale.setScalar(ATOM_DRAW.H * MOL_SCALE * 0.95);

  root.add(hcl, h2o, h3o, clIon, proton);
  h3o.visible = false;
  clIon.visible = false;
  proton.visible = false;

  // Hide H of HCl when flying / done; hide one H of water bonding context handled by swapping molecules
  const hclH = hcl.userData.atomMeshes[1];
  const hclBond = hcl.userData.bondMeshes[0]?.mesh;

  const lblHCl = st.label('HCl', 'big'); lblHCl.obj = hcl; lblHCl.offset.set(0, -2.2, 0);
  const lblH2O = st.label('H₂O', 'big'); lblH2O.obj = h2o; lblH2O.offset.set(0, -2.2, 0);
  const lblH3O = st.label('H₃O⁺', 'big pos'); lblH3O.obj = h3o; lblH3O.offset.set(0, -2.4, 0);
  const lblCl = st.label('Cl⁻', 'big neg'); lblCl.obj = clIon; lblCl.offset.set(0, -2.2, 0);
  const lblH = st.label('H⁺', 'big pos'); lblH.obj = proton; lblH.offset.set(0, 1.1, 0);

  const STEPS = [
    {
      say: 'Hydrogen chloride sits next to a water molecule. HCl is ready to donate its proton; water is ready to accept it.',
      rows: [['Species', 'HCl and H₂O'], ['Acid action', 'HCl will donate H⁺'], ['Base action', 'H₂O will accept H⁺'], ['After transfer', 'H₃O⁺ and Cl⁻']],
    },
    {
      say: 'The proton leaves chlorine and crosses to water. For a blink you see H⁺ on its own — then it sticks to oxygen.',
      rows: [['Step', 'Proton transfer'], ['Leaving', 'HCl → Cl⁻ + H⁺'], ['Arriving', 'H⁺ + H₂O → H₃O⁺'], ['Net', 'HCl + H₂O → H₃O⁺ + Cl⁻']],
    },
    {
      say: 'Done. Chloride is free, and the water that took the proton is now hydronium, H₃O⁺. That is what “H⁺ in water” really looks like.',
      rows: [['Products', 'H₃O⁺ and Cl⁻'], ['Hydronium', '3 H bonded to O, charge +1'], ['Chloride', 'Cl⁻, charge −1'], ['Strength', 'HCl transfers completely']],
    },
  ];

  let step = 0, flight = null;
  const from = new THREE.Vector3(), to = new THREE.Vector3(), mid = new THREE.Vector3();

  function set(k) {
    step = k;
    say.textContent = STEPS[k].say;
    table(read, STEPS[k].rows);
    flight = null;
    proton.visible = false;
    if (k === 0) {
      hcl.visible = true; h2o.visible = true; h3o.visible = false; clIon.visible = false;
      if (hclH) hclH.visible = true;
      if (hclBond) hclBond.visible = true;
      lblHCl.on = true; lblH2O.on = true; lblH3O.on = false; lblCl.on = false; lblH.on = false;
      st.fit = { w: 5.8, h: 3.6 };
    } else if (k === 1) {
      hcl.visible = true; h2o.visible = true; h3o.visible = false; clIon.visible = false;
      if (hclH) hclH.visible = false;
      if (hclBond) hclBond.visible = false;
      lblHCl.on = false; lblH2O.on = true; lblH3O.on = false; lblCl.on = true; lblH.on = true;
      clIon.visible = true;
      // start flight from HCl H position toward water O
      hcl.userData.atomMeshes[1].getWorldPosition(from);
      h2o.userData.atomMeshes[0].getWorldPosition(to);
      to.x -= 0.55;
      mid.copy(from).add(to).multiplyScalar(0.5).add(new THREE.Vector3(0, 1.6, 0.4));
      proton.position.copy(from);
      proton.visible = true;
      flight = { t: 0, dur: reduceMotion ? 0.01 : 2.2 };
      st.fit = { w: 5.8, h: 4.2 };
    } else {
      hcl.visible = false; h2o.visible = false; h3o.visible = true; clIon.visible = true;
      lblHCl.on = false; lblH2O.on = false; lblH3O.on = true; lblCl.on = true; lblH.on = false;
      st.fit = { w: 5.6, h: 3.8 };
    }
    st.refit();
  }
  st.setStep = set;
  st.update = (dt) => {
    if (!reduceMotion) root.rotation.y += dt * 0.12;
    if (flight) {
      flight.t += dt / flight.dur;
      const u = ease(Math.min(1, flight.t));
      proton.position.set(0, 0, 0)
        .addScaledVector(from, (1 - u) * (1 - u))
        .addScaledVector(mid, 2 * u * (1 - u))
        .addScaledVector(to, u * u);
      if (flight.t >= 1) {
        flight = null;
        // snap to products
        set(2);
        const group = document.querySelector('[data-steps="proton"]');
        if (group) {
          group.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.step === '2')));
        }
      }
    }
  };
  set(0);
}

// ---------- Scene B: NaOH dissolve ----------
function buildHydroxide(st) {
  const root = new THREE.Group();
  st.scene.add(root);
  const say = document.getElementById('oh-say');
  const read = document.getElementById('oh-read');

  const oh = buildMolecule(st, 'OH', {
    align: (pos) => {
      const d = new THREE.Vector3().subVectors(pos[1], pos[0]).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(d, new THREE.Vector3(0.4, 1, 0).normalize());
      pos.forEach((p) => p.applyQuaternion(q));
    },
  });
  const na = new THREE.Mesh(sphereGeo, satin(st.renderer, COLORS.Na, 0.1));
  na.scale.setScalar(R_NA * ION_DRAW * MOL_SCALE);

  const pair = new THREE.Group();
  pair.add(na, oh);
  na.position.set(-1.35, 0, 0);
  oh.position.set(1.15, 0, 0);
  root.add(pair);

  // faint waters in background when dissolved
  const waters = new THREE.Group();
  const spots = [[-3.2, 1.4, -1], [3.4, -1.2, -0.8], [-2.8, -1.6, 1.2], [2.9, 1.8, 1], [0.2, 2.4, -1.4], [0.4, -2.5, 1.1]];
  for (const [x, y, z] of spots) {
    const w = buildMolecule(st, 'H2O');
    w.position.set(x, y, z);
    w.scale.setScalar(0.72);
    w.rotation.y = x * 0.3;
    waters.add(w);
  }
  waters.visible = false;
  root.add(waters);

  const lblNa = st.label('Na⁺', 'big pos'); lblNa.obj = na;
  const lblOH = st.label('OH⁻', 'big neg'); lblOH.obj = oh; lblOH.offset.set(0, -1.6, 0);

  const STEPS = [
    {
      say: 'In solid NaOH, sodium ions and hydroxide ions sit next to each other. There is no covalent Na–O molecule to draw.',
      rows: [['Solid', 'Ionic lattice of Na⁺ and OH⁻'], ['OH⁻ formula', '1 O, 1 H, charge −1'], ['Na⁺', 'Sodium ion, charge +1'], ['In water', 'Ions separate']],
    },
    {
      say: 'Water pulls the ions apart. Na⁺ and OH⁻ drift into the solution. That is dissolving.',
      rows: [['Process', 'Dissociation in water'], ['Na⁺', 'Surrounded by water'], ['OH⁻', 'Surrounded by water'], ['Result', 'A basic solution']],
    },
    {
      say: 'Free hydroxide is ready to accept a proton from any acid that comes along. That is why NaOH is a strong base.',
      rows: [['Ions in solution', 'Na⁺ and OH⁻'], ['Base', 'OH⁻ accepts H⁺'], ['Strength', 'Strong base — fully dissociated'], ['With acid', 'Neutralizes to water + salt']],
    },
  ];

  let step = 0, sep = 0;
  const naHome = na.position.clone();
  const ohHome = oh.position.clone();

  function set(k) {
    step = k;
    say.textContent = STEPS[k].say;
    table(read, STEPS[k].rows);
    waters.visible = k >= 1;
    if (k === 0) {
      sep = 0;
      na.position.copy(naHome);
      oh.position.copy(ohHome);
      st.fit = { w: 4.2, h: 3.2 };
    } else if (k === 1) {
      sep = reduceMotion ? 1 : 0;
      st.fit = { w: 6.5, h: 5.2 };
    } else {
      sep = 1;
      na.position.set(-3.0, 0.3, 0);
      oh.position.set(3.0, -0.2, 0);
      st.fit = { w: 7.2, h: 5.2 };
    }
    st.refit();
  }
  st.setStep = set;
  st.update = (dt) => {
    if (!reduceMotion) root.rotation.y += dt * 0.1;
    if (step === 1 && sep < 1) {
      sep = Math.min(1, sep + dt / 1.8);
      const u = ease(sep);
      na.position.lerpVectors(naHome, new THREE.Vector3(-3.0, 0.3, 0), u);
      oh.position.lerpVectors(ohHome, new THREE.Vector3(3.0, -0.2, 0), u);
    }
  };
  set(0);
}

// ---------- Scene C: neutralization ----------
function buildNeutralize(st) {
  const root = new THREE.Group();
  st.scene.add(root);
  const say = document.getElementById('neut-say');
  const read = document.getElementById('neut-read');

  const h3o = buildMolecule(st, 'H3O', {
    align: (pos) => {
      const o = pos[0];
      const cH = pos[1].clone().add(pos[2]).add(pos[3]).multiplyScalar(1 / 3);
      const up = o.clone().sub(cH).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(up, new THREE.Vector3(0, 1, 0));
      pos.forEach((p) => p.applyQuaternion(q));
    },
    offset: new THREE.Vector3(-2.5, 0, 0),
  });
  const oh = buildMolecule(st, 'OH', {
    align: (pos) => {
      const d = new THREE.Vector3().subVectors(pos[1], pos[0]).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(d, new THREE.Vector3(-0.3, 1, 0).normalize());
      pos.forEach((p) => p.applyQuaternion(q));
    },
    offset: new THREE.Vector3(2.5, 0, 0),
  });
  const w1 = buildMolecule(st, 'H2O', { offset: new THREE.Vector3(-1.8, 0, 0) });
  const w2 = buildMolecule(st, 'H2O', { offset: new THREE.Vector3(1.8, 0, 0) });
  root.add(h3o, oh, w1, w2);
  w1.visible = false;
  w2.visible = false;

  // flying proton: one H from H3O (index 1)
  const proton = new THREE.Mesh(sphereGeo, satin(st.renderer, COLORS.H, 0.12));
  proton.scale.setScalar(ATOM_DRAW.H * MOL_SCALE * 0.95);
  proton.visible = false;
  root.add(proton);
  const hFly = h3o.userData.atomMeshes[1];
  const bondsToH = h3o.userData.bondMeshes.filter((b) => b.i === 1 || b.j === 1);

  const lblA = st.label('H₃O⁺', 'big pos'); lblA.obj = h3o; lblA.offset.set(0, -2.3, 0);
  const lblB = st.label('OH⁻', 'big neg'); lblB.obj = oh; lblB.offset.set(0, -2.0, 0);
  const lblW1 = st.label('H₂O', 'big'); lblW1.obj = w1; lblW1.offset.set(0, -2.0, 0);
  const lblW2 = st.label('H₂O', 'big'); lblW2.obj = w2; lblW2.offset.set(0, -2.0, 0);
  const lblH = st.label('H⁺', 'big pos'); lblH.obj = proton; lblH.offset.set(0, 1.0, 0);

  const STEPS = [
    {
      say: 'Hydronium and hydroxide approach. One has an extra proton; the other wants one.',
      rows: [['Left', 'H₃O⁺ (acid in water)'], ['Right', 'OH⁻ (base)'], ['Reaction', 'H₃O⁺ + OH⁻ → 2 H₂O'], ['Also formed', 'A salt from leftover ions']],
    },
    {
      say: 'A proton leaves H₃O⁺ and lands on OH⁻. For a moment you see the handoff.',
      rows: [['Leaving', 'H₃O⁺ → H₂O + H⁺'], ['Arriving', 'H⁺ + OH⁻ → H₂O'], ['Net', 'Two water molecules']],
    },
    {
      say: 'Two waters. The acid and the base have canceled. Any leftover Na⁺ and Cl⁻ stay dissolved as salt.',
      rows: [['Products', '2 H₂O'], ['Ion equation', 'H₃O⁺ + OH⁻ → 2 H₂O'], ['Salt example', 'Na⁺ + Cl⁻ from NaOH + HCl'], ['pH', 'Moves toward neutral']],
    },
  ];

  let flight = null;
  const from = new THREE.Vector3(), to = new THREE.Vector3(), mid = new THREE.Vector3();

  function set(k) {
    say.textContent = STEPS[k].say;
    table(read, STEPS[k].rows);
    flight = null;
    proton.visible = false;
    if (k === 0) {
      h3o.visible = true; oh.visible = true; w1.visible = false; w2.visible = false;
      hFly.visible = true;
      bondsToH.forEach((b) => { b.mesh.visible = true; });
      lblA.on = true; lblB.on = true; lblW1.on = false; lblW2.on = false; lblH.on = false;
      st.fit = { w: 5.8, h: 3.8 };
    } else if (k === 1) {
      h3o.visible = true; oh.visible = true; w1.visible = false; w2.visible = false;
      hFly.visible = false;
      bondsToH.forEach((b) => { b.mesh.visible = false; });
      lblA.on = true; lblB.on = true; lblW1.on = false; lblW2.on = false; lblH.on = true;
      hFly.getWorldPosition(from);
      oh.userData.atomMeshes[0].getWorldPosition(to);
      to.x -= 0.5;
      mid.copy(from).add(to).multiplyScalar(0.5).y += 1.5;
      proton.position.copy(from);
      proton.visible = true;
      flight = { t: 0, dur: reduceMotion ? 0.01 : 2.0 };
      st.fit = { w: 5.8, h: 4.2 };
    } else {
      h3o.visible = false; oh.visible = false; w1.visible = true; w2.visible = true;
      lblA.on = false; lblB.on = false; lblW1.on = true; lblW2.on = true; lblH.on = false;
      st.fit = { w: 5.2, h: 3.6 };
    }
    st.refit();
  }
  st.setStep = set;
  st.update = (dt) => {
    if (!reduceMotion) root.rotation.y += dt * 0.12;
    if (flight) {
      flight.t += dt / flight.dur;
      const u = ease(Math.min(1, flight.t));
      proton.position.set(0, 0, 0)
        .addScaledVector(from, (1 - u) * (1 - u))
        .addScaledVector(mid, 2 * u * (1 - u))
        .addScaledVector(to, u * u);
      if (flight.t >= 1) {
        flight = null;
        set(2);
        const group = document.querySelector('[data-steps="neutralize"]');
        if (group) group.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.step === '2')));
      }
    }
  };
  set(0);
}

// ---------- Scene D: strong vs weak ----------
function buildContrast(st) {
  const holder = new THREE.Group();
  st.scene.add(holder);
  const say = document.getElementById('sw-say');
  const read = document.getElementById('sw-read');
  const cap = document.getElementById('sw-cap');

  const cache = {};
  const atomLabels = [];
  let cur = null;

  const COPY = {
    HCl: {
      say: 'HCl is a strong acid. In water essentially every molecule has already given its proton away. What you meet in solution is H₃O⁺ and Cl⁻, not intact HCl.',
      rows: [['Acid', 'Hydrochloric acid, HCl'], ['Strength', 'Strong — complete transfer'], ['In water', 'H₃O⁺ + Cl⁻'], ['Intact HCl left', 'Essentially none']],
      cap: 'Strong acid: the proton has transferred. The stage shows the products H₃O⁺ and Cl⁻.',
      build: () => {
        const g = new THREE.Group();
        const h3o = buildMolecule(st, 'H3O', { offset: new THREE.Vector3(1.8, 0, 0) });
        const cl = new THREE.Mesh(sphereGeo, satin(st.renderer, COLORS.Cl, 0.08));
        cl.scale.setScalar(ATOM_DRAW.Cl * MOL_SCALE * 1.1);
        cl.position.set(-2.0, 0, 0);
        g.add(h3o, cl);
        g.userData.atomMeshes = [cl, ...h3o.userData.atomMeshes];
        g.userData.labels = [
          { text: 'Cl⁻', mesh: cl, cls: 'big neg', off: [0, -1.8, 0] },
          { text: 'H₃O⁺', mesh: h3o, cls: 'big pos', off: [0, -2.2, 0] },
        ];
        return g;
      },
    },
    CH3COOH: {
      say: 'Acetic acid is a weak acid. Most molecules keep their acidic hydrogen. Only a small fraction have transferred a proton to water at any moment — enough to taste sour, not a complete handoff.',
      rows: [['Acid', 'Acetic acid, CH₃COOH (vinegar)'], ['Strength', 'Weak — partial transfer'], ['Mostly present as', 'Intact CH₃COOH'], ['Dissociated', 'A small fraction → H₃O⁺ + CH₃COO⁻']],
      cap: 'Weak acid: the intact acetic acid molecule dominates. The acidic H (on the –OH) is still attached.',
      build: () => {
        const g = buildMolecule(st, 'CH3COOH', {
          align: (pos, geo) => {
            // put carboxyl roughly to the right
            const oH = geo.atoms.findIndex((a, i) => a[0] === 'O' && geo.bonds.some(([i0, j0]) => (i0 === i || j0 === i) && geo.atoms[i0 === i ? j0 : i0][0] === 'H'));
            // simple: no special align beyond centering
          },
        });
        g.userData.labels = g.userData.atomMeshes.map((m, i) => ({
          text: GEOMETRY.CH3COOH.atoms[i][0],
          mesh: m,
          cls: 'atom',
          off: [0, 0, 0],
        }));
        // highlight acidic H
        const acidH = GEOMETRY.CH3COOH.atoms.findIndex((a, i) => a[0] === 'H' && GEOMETRY.CH3COOH.bonds.some(([i0, j0]) => {
          const other = i0 === i ? j0 : j0 === i ? i0 : -1;
          return other >= 0 && GEOMETRY.CH3COOH.atoms[other][0] === 'O';
        }));
        if (acidH >= 0) {
          g.userData.labels.push({ text: 'acidic H', mesh: g.userData.atomMeshes[acidH], cls: 'dim', off: [0, -0.85, 0] });
        }
        return g;
      },
    },
  };

  function set(id) {
    if (cur) holder.remove(cur);
    cur = cache[id] ||= COPY[id].build();
    holder.add(cur);
    holder.rotation.set(0.15, 0.4, 0);
    atomLabels.forEach((L) => { L.on = false; });
    (cur.userData.labels || []).forEach((info, i) => {
      const L = atomLabels[i] || (atomLabels[i] = st.label('', ''));
      L.el.textContent = info.text;
      L.el.className = 'lbl ' + info.cls;
      L.obj = info.mesh;
      L.offset.set(...info.off);
      L.on = true;
    });
    say.textContent = COPY[id].say;
    table(read, COPY[id].rows);
    cap.textContent = COPY[id].cap;
    const box = new THREE.Box3().setFromObject(cur);
    const size = new THREE.Vector3();
    box.getSize(size);
    const R = Math.max(size.x, size.y, size.z, 3) * 0.65;
    st.fit = { w: R * 1.2, h: R * 1.15 };
    st.refit();
  }
  st.setStep = set;
  st.update = (dt) => {
    if (!reduceMotion && cur) holder.rotation.y += dt * 0.25;
  };
  set('HCl');
}

// ---------- Scene E: pH conceptual ----------
function buildPh(st) {
  const root = new THREE.Group();
  st.scene.add(root);
  // a few water molecules + two hydronium highlighted
  const spots = [
    [-2.2, 0.8, 0.2], [0.3, -1.1, 0.6], [2.0, 0.9, -0.5],
    [-1.0, -1.4, -0.8], [1.4, -0.2, 1.2], [-0.2, 1.6, -1.0],
  ];
  for (const [x, y, z] of spots) {
    const w = buildMolecule(st, 'H2O');
    w.position.set(x, y, z);
    w.scale.setScalar(0.78);
    w.rotation.set(y * 0.2, x * 0.3, 0);
    root.add(w);
  }
  const hA = buildMolecule(st, 'H3O');
  hA.position.set(-1.6, 0.2, 1.4);
  hA.scale.setScalar(0.95);
  root.add(hA);
  const hB = buildMolecule(st, 'H3O');
  hB.position.set(1.5, -0.6, -1.2);
  hB.scale.setScalar(0.95);
  root.add(hB);
  const l1 = st.label('H₃O⁺', 'big pos'); l1.obj = hA; l1.offset.set(0, 1.6, 0);
  const l2 = st.label('H₃O⁺', 'big pos'); l2.obj = hB; l2.offset.set(0, 1.6, 0);
  st.fit = { w: 5.5, h: 4.5 };
  st.refit();
  st.update = (dt) => {
    if (!reduceMotion) root.rotation.y += dt * 0.15;
  };
}

// ---------- boot ----------
const builders = {
  proton: buildProton,
  hydroxide: buildHydroxide,
  neutralize: buildNeutralize,
  contrast: buildContrast,
  ph: buildPh,
};
for (const el of document.querySelectorAll('.stage[data-scene]')) {
  try {
    const st = makeStage(el);
    builders[el.dataset.scene](st);
    st.resize();
    el._stage = st;
  } catch (err) {
    console.warn(err);
    const p = document.createElement('p');
    p.className = 'caption';
    p.style.padding = '20px';
    p.textContent = 'This browser could not draw the 3D model. The text beside it still covers the lesson.';
    el.appendChild(p);
  }
}
for (const group of document.querySelectorAll('[data-steps]')) {
  const st = document.querySelector(`.stage[data-scene="${group.dataset.steps}"]`)?._stage;
  group.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-step]');
    if (!b || !st) return;
    group.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    const v = b.dataset.step;
    st.setStep(/^\d+$/.test(v) ? Number(v) : v);
  });
}
const clock = new THREE.Clock();
let t = 0;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  t += dt;
  for (const st of stages) {
    if (!st.visible) continue;
    st.update && st.update(dt, t);
    st.render();
  }
}
frame();
