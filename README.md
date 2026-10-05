# How Atoms Work

Intro chemistry · atom structure → nucleus → quarks → Standard Model atlas — by Virgil Renfroe.

**Live preview:** pending Railway deploy (Caddy static, this Dockerfile).

GitHub Pages (same source): https://virgilrenfroe.github.io/how-atoms-work/  
Repo: https://github.com/virgilrenfroe/how-atoms-work

Static three.js lab. Open any element from hydrogen through oganesson and walk one ladder: Atom → Nucleus → Quark, then a door into a separate Standard Model atlas room. Shells and orbitals stay on the Atom readout. They are not extra zoom stages.

Page chrome is a spatial atlas, not a dashboard: oversized Bricolage Grotesque, an offset legend, and film grain on the void. Counts, family colors, B2 electrons, satin nucleons, and the ladder are unchanged.

## Demos

- [`index.html`](index.html) — homepage. Full H–Og periodic table and the WebGL drill-down.
- [`periodic-table-atoms.html`](periodic-table-atoms.html) — the same lesson at the source filename.
- [`periodic-table-data.js`](periodic-table-data.js) — Z 1–118 (symbol, name, category, atomic mass, neutrons, period, group).
- [`NOTES.md`](NOTES.md) — chemistry rules, ladder, and craft notes.

Query params (either HTML page):

- `?el=C` / `?z=6` — open that element on the Atom stage
- `?embed=1` — chrome-less stage (defaults to C if no el/z)
- `?still=1` — static pose (also respects `prefers-reduced-motion`)

Not on the source branch, so not in this repo: `molecule-satin.html` and any ethanol satin demo.

## Local

```bash
python3 -m http.server 8877
```

Open http://localhost:8877/

## Stack

- three.js r170, local import map (`vendor/three`)
- Google Fonts: Bricolage Grotesque, Instrument Sans, Space Mono
- No backend
- Hosted on Railway (Caddy static) with GitHub Pages as the matching virgilrenfroe pattern when available
