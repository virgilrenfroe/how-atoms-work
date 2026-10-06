# Periodic table · intro chemistry

Teachable drill-down for every element, hydrogen through oganesson. One path, named in the page header:

**Atom structure → nucleus → quarks → Standard Model atlas**

Intro chemistry stays exact on the way down. Shells and orbitals are labels on the Atom readout, not extra zoom stages. After the nucleus, any element can open one nucleon’s quarks, then a separate Standard Model atlas room. Mesons live only in that room.

## Open

From the repo root:

```bash
python3 -m http.server 8080
```

Visit `http://localhost:8080/periodic-table-atoms.html`

Query params:

- `?el=C` / `?z=6` — open that element on the Atom stage
- `?embed=1` — chrome-less stage (defaults to C if no el/z)
- `?still=1` — static pose (also respects `prefers-reduced-motion`)

## Files

- `periodic-table-atoms.html` — table, WebGL ladder, quark stage, atlas room
- `periodic-table-data.js` — Z 1–118 (symbol, name, category, atomicMass, neutrons, period, group)

Local three r170 via `./vendor/three/` import map.

## Chemistry (Virgil)

| Quantity | Rule |
|----------|------|
| Protons | Z |
| Electrons | Z (neutral) |
| Neutrons | `Math.round(atomicMass) − Z` |

Masses: IUPAC CIAAW conventional atomic weights where available; radioactive/synthetic elements use a commonly listed standard weight or the most-stable isotope mass number.

Spot checks (p / n / e): H 1/0/1 · He 2/2/2 · C 6/6/6 · O 8/8/8 · Ne 10/10/10 · Ar 18/22/18 · Fe 26/30/26 · Au 79/118/79 · U 92/146/92 · Og 118/176/118.

Electron heads sit on faint Bohr rings, one head per electron, grouped by principal **n**. Totals always equal Z. Outer shells compress visually for Z > 36. Carbon is K 2 + L 4. Hydrogen is one electron on K.

**Electron finish B2 (Atom):** bright discrete heads on faint Bohr rings. Count = Z. No comet dust, trails, or decorative points in the empty space between the heads and the nucleus. Nucleons stay satin.

Shells and orbitals are HUD labels, not stages. The Atom readout shows the Madelung string and the shell summary, for example Carbon `1s² 2s² 2p²` and `K2 · L4`, with `Σ e⁻ = Z`. Hydrogen is `1s¹` · `K1`. Iron’s string includes `4s² 3d⁶`. Oganesson runs through `7p⁶`. A few real atoms (Cr, Cu, and some heavier cases) differ from this Madelung order; the page keeps one fill so the Aufbau string and the shell summary match. There are no plastic s/p/d/f volumes.

## What finished means

A student can open any of the 118 elements and walk the same lesson:

1. **Atom** — Z protons, `round(mass) − Z` neutrons, Z electrons as bright B2 heads on faint rings. The readout shows the Aufbau string, the shell summary (`K2 · L4` for carbon), and `Σ e⁻ = Z`.
2. **Nucleus** — satin protons and neutrons with a small gap between neighbors, not one fused blob.
3. **Quark** — the chosen proton is uud (+1), the chosen neutron is udd (0). Hydrogen has no neutron.
4. **Atlas door**, then the **atlas room** — fermions, gauge bosons, the Higgs, and mesons (π⁺ = u d̄). Mesons are not nucleons. Nothing in that room is packed into the nucleus.

Esc or Back walks atlas → quark → nucleus → atom. The page is the whole lesson: `periodic-table-atoms.html` plus `periodic-table-data.js` (Z 1–118), served from the repo root.

## Ladder

```
Atom → Nucleus → Quark ┆ door ┆ Atlas room
```

1. Tap an element. The panel opens on **Atom** (p / n / e, plus the Aufbau string, shell summary, and Σ e⁻ = Z). Electrons are B2 heads on faint rings. Tap the nucleus or Next to open Nucleus.
2. **Nucleus** — proton and neutron spheres only, spaced so neighbors leave a small gap instead of merging into one blob. No quarks, gluons, bosons, or mesons in the pack.
3. **Quark** — from Nucleus, tap a nucleon or press Next. A proton shows **uud** (+2/3, +2/3, −1/3 = +1). A neutron shows **udd** (+2/3, −1/3, −1/3 = 0). Both are labeled baryons. Hydrogen has no neutron, so the only nucleon is the proton.
4. **Atlas door** — Next on Quark is “Open door”. The handoff card reads “Leaving the atom · Standard Model atlas”. Enter atlas, or Esc to stay on the quark. This is a separate room, not a deeper nucleus.
5. **Atlas room** — hard cut (atom hidden, blue dashed frame). Browse fermions (6 quarks, 6 leptons), gauge bosons (γ, g, W±, Z⁰), Higgs (H⁰), and mesons (π⁺ = u d̄, π⁻ = d ū, π⁰ = (uū − dd̄)/√2, K⁺ = u s̄). A dashed contrast group shows p = uud and n = udd as baryons, not mesons and not elementary.

Quark stays locked on Atom. The Atlas chip opens only from Quark, and only through the handoff card.

Esc or Back steps **atlas → quark → nucleus → atom** (Esc closes the handoff card first). The Atom chip returns straight to the Atom stage. On a phone, ← back uses the same steps, then ← table closes the panel.

Keys: ← → step, Enter confirms the door, 0 jumps to Atom.

## Atlas bookkeeping

| Rule | Value |
|------|--------|
| Proton | uud · charge +1 · baryon B = 1 · spin ½ |
| Neutron | udd · charge 0 · baryon · spin ½ |
| Quark charges | u +2/3 · d −1/3 (stored as thirds) |
| Mesons | q q̄, spin 0. Not nucleons. |
| Elementary list | 17 entries: 6 quarks, 6 leptons, γ, g, W±, Z⁰, H⁰ |

Particle-symbol chips (γ, μ, ν, π, uud, …) do **not** use CSS `text-transform: uppercase`.

## Craft

Family tiles use the legend hues at about half opacity, with a solid left edge in the same hex, so alkali through actinide read at a glance. Selected tiles keep that fill and pick up a warm ring. Corridor void `#140818`, Bricolage Grotesque / Instrument Sans / Space Mono, warm accent. Satin nucleons: metalness 0.32, roughness 0.45, clearcoat 0.22 / 0.38. Anisotropy 0.55 on desktop WebGL2 and **off on mobile**. Atom electrons are B2 heads (no clearcoat): bright teal beads, ring opacity about 0.16. Shared nucleon, quark, and glow spheres are 24×20 on mobile and 32×28 on desktop so a nucleus zoom does not look faceted. Electron heads stay a step lower (16×14 mobile, 24×20 desktop) because there is one per electron. Hemisphere + warm point light. Subtle UnrealBloom on desktop only.

DPR ≤ 1.5. `setSize(w, h, true)` on mobile. The atom panel and stage use `minmax(0, 1fr)` so the canvas cannot collapse to 0×0. Touch-friendly cells. Mobile atom panel is full screen.

Colours: p `#ff6b3d` · n `#6c84a8` · e `#5fd6c6` · u `#ffd166` · d `#a78bfa`.

The page is a split. The periodic table is the left panel; the WebGL atom is the right panel. The canvas does not sit under the tiles, and the table is not a tilted plate. Inside the atom stage only, the room is a floor: a sparse grid, a low disc, and a center ring. Atom keeps the floor under the model. Nucleus and quark drop it away. Atlas raises a cooler floor under that same stage. Pointer parallax offsets the camera for one frame (then restores it) so the floor shears against the nucleons. Chemistry meshes, counts, and the ladder are not part of that motion. On a narrow screen the atom stage is its own opaque sheet, not a drawing over the tiles.

## Ethanol · C₂H₆O

`ethanol.html` — Intro chem · molecular structure / bonding. Ball-and-stick anti conformer, staggered.

| Quantity | Value |
|----------|--------|
| Formula | C₂H₆O · 2 C, 6 H, 1 O · 8 single bonds |
| C–C | 1.512 Å |
| C–O | 1.431 Å |
| C–H | 1.096 Å |
| O–H | 0.971 Å |
| Carbon angles | tetrahedral, arccos(−1/3) ≈ 109.47° |
| ∠C–O–H | 108.5° |
| Dihedral H–O–C–C | 180° (anti) |
| Methyl vs O | one H anti (180°), two gauche (±60°) |

CPK (Jmol): C `#909090` · H `#FFFFFF` · O `#FF0D0D`. Satin `MeshPhysicalMaterial` metalness 0.32, roughness 0.45, clearcoat 0.22, clearcoat roughness 0.38. Anisotropy 0.55 on desktop WebGL2 and off on mobile. Sphere display radii are not van der Waals radii, so the sticks stay visible. Oxygen’s two lone pairs are not drawn. Void `#140818`. DPR ≤ 1.5. Linked from the atom-room header and from the molecule gallery.

## 115 molecules

`molecules/index.html` lists ten groups. `molecules/molecules-data.js` holds the entries. The list column and the model column do not overlap. The lesson sits under the model, on its own band, so the structure stays clear.

Ball-and-stick covers the small molecules from the earlier waves, plus every later entry that has an exact public 3D structure: PubChem 3D conformers, or ideal coordinates from the PDB Chemical Component Dictionary (paclitaxel as TA1, chlorophyll a as CLA). Aromatic bonds are order 1.5. Fragments are labeled as pieces: coronene for graphene, a capped aramid for Kevlar, decane for polyethylene, perfluorohexane for Teflon, a short siloxane for PDMS, chitobiose for chitin, and hexamethylene bisacetamide for the diamine piece of nylon 6,6. Adenine, guanine, cytosine, ATP, and indigo are not separate catalog entries. Ethanol is the existing page, not a second model.

Entries without an exact structure open a lesson: name, formula, and what it is, where it shows up, and why it matters. Graphyne and carbyne add a predicted bonding diagram. Prithivi, metallic hydrogen, and N₈ stay labeled as predictions or names. Explosives, toxins, nerve agents, and other dual-use or controlled entries are cards only, even when a public 3D file exists. The card keeps the name, the formula, and public facts, with no preparation and no coordinates.

`node molecules/check-geometries.mjs` checks that each ball-and-stick atom list matches its formula and that every atom has a valid valence, including formal charge and the hypervalent cases (sulfate sulfur, phosphate phosphorus).

Water, carbon dioxide, ozone, methane, and ammonia use textbook gas-phase distances and angles. C₆₀ is a truncated icosahedron: 5–6 bonds 1.455 Å, 6–6 bonds 1.391 Å. The nanotube is a hydrogen-capped graphene roll, C–C about 1.42 Å. The other ball-and-stick entries use PubChem 3D conformers or PDB ideal coordinates. Atom counts have to match the formula.

## How Atoms Bond · `bonds/`

`bonds/index.html` — Intro chem · ionic, covalent, and polar covalent bonds. Three 3D stages, each in its own column beside the lesson text (never under it), then an **In the real world** band and a Check yourself list for the classroom. Linked from the hub header (`index.html` and `periodic-table-atoms.html`) as “How atoms bond”.

`node bonds/check-bonds.mjs` checks the formulas, bond orders, valences, model distances against the measured values, the salt cell, and the page copy. `node bonds/build-geometry.mjs` rebuilds `bonds/geometry.js` from `bonds/sdf/`.

### Scenes

1. **Ionic · Na + Cl.** Bohr shells, B2 electrons (bright heads on faint rings, no trails). Na 11 p / 12 n / 11 e, shells 2, 8, 1 → Na⁺ 2, 8 (10 e). Cl 17 p / 18 n / 17 e, shells 2, 8, 7 → Cl⁻ 2, 8, 8 (18 e). Neutrons follow the site rule `round(mass) − Z` (Na 22.99 → 12, Cl 35.45 → 18). Steps: Atoms → Transfer → Ions → Crystal. The crystal is one conventional rock-salt cell, 3 × 3 × 3 sites, 14 Na⁺ + 13 Cl⁻, spacing a/2. Sphere radii are 42% of the Shannon ionic radii so the inside shows; Na⁺ stays smaller than Cl⁻.
2. **Covalent.** H₂, CH₄, O₂, N₂. Each shared pair is one faint ring with two electron heads around its bond. Single, double, triple bonds draw 1, 2, 3 sticks and 1, 2, 3 rings. Unshared pairs are not drawn (the caption says so).
3. **Polar covalent · H₂O.** δ− on O, δ+ on each H, Pauling values beside each atom. Shared-pair rings sit 36% of the way from O to H (a drawing choice to show unequal sharing, not a measured electron position).

### Geometry source

| Model | Source | Model value | Measured (quoted on page) |
|---|---|---|---|
| CH₄ | PubChem CID 297 3D conformer | C–H 1.092 Å, 109.47° | C–H 1.087 Å, 109.471° |
| O₂ | PubChem CID 977 3D conformer | O=O 1.232 Å | 1.2075 Å |
| N₂ | PubChem CID 947 3D conformer | N≡N 1.112 Å | 1.0977 Å |
| H₂O | PubChem CID 962 3D conformer | O–H 0.969 Å, 104.0° | O–H 0.958 Å, 104.48° |
| H₂ | **No PubChem 3D conformer** (PUG REST `cid/783/SDF?record_type=3d` → 404) | H–H 0.7414 Å | 0.7414 Å |

SDF files fetched 2026-10-06 from `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/<CID>/SDF?record_type=3d` and stored in `bonds/sdf/`. PubChem conformers are computed (MMFF94s), so their lengths differ from experiment by up to 0.025 Å; the page text quotes the measured values and the sources line says the shapes come from PubChem. H₂ is a diatomic, so its only geometric parameter is its bond length; it is placed at ±0.3707 Å from the measured r_e. NaCl has no molecular conformer either; the cell is built from the crystal structure below.

### Values and sources

| Value | Source |
|---|---|
| H–H r_e 0.7414 Å | NIST CCCBDB experimental data, H₂ (Huber & Herzberg 1979) — https://cccbdb.nist.gov/exp2x.asp?casno=1333740 |
| N≡N r_e 1.0977 Å | NIST CCCBDB, N₂ (Huber & Herzberg 1979) — https://cccbdb.nist.gov/exp2x.asp?casno=7727379 |
| O=O r_e 1.2075 Å | NIST CCCBDB, O₂ (Huber & Herzberg 1979) — https://cccbdb.nist.gov/exp2x.asp?casno=7782447 |
| O–H 0.958 Å, ∠HOH 104.4776° | NIST CCCBDB, H₂O (Hoy & Bunker 1979) — https://cccbdb.nist.gov/exp2x.asp?casno=7732185 |
| C–H 1.087 Å, ∠HCH 109.471° | NIST CCCBDB, CH₄ — https://cccbdb.nist.gov/exp2x.asp?casno=74828 |
| NaCl rock salt, Fm-3m (No. 225), a = 5.640 Å (5.6402–5.6406), Z = 4, Na–Cl = a/2 = 2.820 Å | Handbook of Mineralogy, halite (a = 5.6404 Å); COD 9008678 (Wyckoff, *Crystal Structures*, a = 5.64056 Å) |
| Na⁺ 1.02 Å, Cl⁻ 1.81 Å (CN 6) | Shannon, *Acta Cryst.* A32, 751 (1976) |
| Pauling χ: H 2.20, C 2.55, N 3.04, O 3.44, Na 0.93, Cl 3.16 | CRC Handbook / WebElements values, as tabulated at https://en.wikipedia.org/wiki/Electronegativities_of_the_elements_(data_page) and LibreTexts A2 |
| Differences: H–H 0.00, C–H 0.35, O–H 1.24, Na–Cl 2.23 | computed from the Pauling values |
| 0.4 / 1.7 polarity cut-offs | a common textbook rule of thumb; the page calls it “a rough guide, not a hard line” |

Physics on the page that is stated qualitatively (no numbers): removing Na’s electron costs more energy than Cl releases on gaining it, and the lattice energy makes NaCl stable; O₂ has two unpaired electrons (paramagnetic, liquid O₂ is attracted to a magnet); N≡N is very strong, which is why fixing nitrogen (Haber–Bosch) needs high heat and pressure.

### In the real world (all true, plain sentences)

Rock salt on winter roads (highway maintenance crews; freezing-point depression). Normal saline, 0.9% NaCl, as IV fluid (nurses). Sodium and potassium ions in sports drinks. Water’s polarity dissolves salts and minerals (water treatment operators). Natural gas is mostly methane and is odorless, so utilities add an odorant (HVAC technicians, gas utility workers). N₂’s triple bond, ammonia, nitrogen fertilizer (farmers). Supplemental oxygen from tanks and concentrators (respiratory therapists).

### Craft

Same void, fonts, and satin as the rest of the site: `MeshPhysicalMaterial` metalness 0.32, roughness 0.45, clearcoat 0.22, clearcoat roughness 0.38; anisotropy 0.55 on desktop WebGL2 only, off on mobile. Protons `#ff6b3d`, neutrons `#6c84a8`, electrons `#5fd6c6`. CPK: H `#ffffff`, C `#55555c` (dark grey), N `#3050f8`, O `#ff0d0d`, Na `#ab5cf2`, Cl `#1ff01f`. Oversized Bricolage headings, outlined chapter numbers, chapters alternate text-left / stage-left, and the real-world band is a full-bleed proton-orange block. DPR ≤ 1.5. One renderer per stage, drawn only while on screen. Drag to turn on desktop; on phones the page scrolls normally over the stage and the models turn on their own.
