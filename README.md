# How Atoms Work

Intro chemistry · atom structure → nucleus → quarks → Standard Model atlas — by Virgil Renfroe.

**Live:** https://virgilrenfroe.github.io/how-atoms-work/

Repo: https://github.com/virgilrenfroe/how-atoms-work

Railway is a deploy preview only, not the public share link: https://how-atoms-work-production.up.railway.app/

Static three.js lab. Open any element from hydrogen through oganesson and walk one ladder: Atom → Nucleus → Quark, then a door into a separate Standard Model atlas room. Shells and orbitals stay on the Atom readout. They are not extra zoom stages.

The page is a split: the periodic table is one panel, the atom stage is the other. The WebGL view never sits under the tiles. Inside the stage, a floor grid drops away in the nucleus and rises on the atlas. Type is Bricolage Grotesque, Instrument Sans, and Space Mono. Counts, family colors, B2 electrons, satin nucleons, and the ladder are unchanged.

The molecule gallery is the same kind of split. Categories and names stay in one column. The model or the teaching card stays in the other. Ethanol remains its own page and is linked from the atom-room header and from the history group.

## Demos

- [`index.html`](index.html) — homepage. Full H–Og periodic table and the WebGL drill-down.
- [`periodic-table-atoms.html`](periodic-table-atoms.html) — the same lesson at the source filename.
- [`ethanol.html`](ethanol.html) — Intro chem · molecular structure / bonding. Satin ethanol, C₂H₆O, anti conformer.
- [`bonds/index.html`](bonds/index.html) — How Atoms Bond. Ionic (Na + Cl → Na⁺ Cl⁻, rock-salt cell), covalent (H₂, CH₄, O₂, N₂), and polar covalent (H₂O) in 3D, with an In the real world section.
- [`bonds/check-bonds.mjs`](bonds/check-bonds.mjs) — checks the bond lesson’s formulas, bond orders, distances, and salt cell against cited values.
- [`molecules/index.html`](molecules/index.html) — 115 incredible molecules. Category hub, teaching cards, and ball-and-stick models.
- [`molecules/molecules-data.js`](molecules/molecules-data.js) — the hundred entries (id, name, formula, category, teaching sentence, structure mode).
- [`molecules/geometries.js`](molecules/geometries.js) — coordinates for the ball-and-stick set.
- [`molecules/check-geometries.mjs`](molecules/check-geometries.mjs) — checks each model’s formula against its atoms, and each atom’s valence.
- [`periodic-table-data.js`](periodic-table-data.js) — Z 1–118 (symbol, name, category, atomic mass, neutrons, period, group).
- [`NOTES.md`](NOTES.md) — chemistry rules, ladder, ethanol geometry, molecule gallery, and craft notes.

Query params (either HTML page):

- `?el=C` / `?z=6` — open that element on the Atom stage
- `?embed=1` — chrome-less stage (defaults to C if no el/z)
- `?still=1` — static pose (also respects `prefers-reduced-motion`)

## Local

```bash
python3 -m http.server 8877
```

Open http://localhost:8877/

## Stack

- three.js r170, local import map (`vendor/three`)
- Google Fonts: Bricolage Grotesque, Instrument Sans, Space Mono
- No backend
- Public site: GitHub Pages at https://virgilrenfroe.github.io/how-atoms-work/
- Railway (Caddy static) is a deploy preview, not the featured link
