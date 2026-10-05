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
