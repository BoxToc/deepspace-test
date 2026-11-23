# Sprite pipeline (development only)

Renders original 3D models as transparent isometric PNGs that match Kenney's
isometric packs, so new art blends into the town. Nothing here is imported by
the app or bundled into production: it uses `three` (a dev dependency) in
headless Chromium via Playwright.

```
node tools/sprite-pipeline/render.mjs <model> [--out file.png] [--check reference.png]
node tools/sprite-pipeline/compare.mjs <sheet> [--out file.png] [--scale 2]
```

| File | Purpose |
|---|---|
| `kenney-style.js` | Camera, scale, palette and flat three-tone shading matched to Kenney; primitive helpers |
| `models/*.js` | Models. Each exports `build()` (a three.js object) and `output` (size and anchor). `citizens.js` renders the townspeople sprite sheet (4 people × front/back × 3 walk frames) |
| `sheets/*.js` | Contact-sheet layouts: Kenney buildings next to generated sprites |
| `render.mjs` | Model → PNG (default output: `art-source/renders/`, git-ignored) |
| `compare.mjs` | Side-by-side contact sheet (default output: `art-source/compare/`, git-ignored) |

## How the Kenney look is matched

Measured from the Kenney PNGs:

- **Projection:** true 2:1 dimetric, an orthographic camera at 45° azimuth and 30° elevation. A 1×1 tile is 132 px wide with a 66 px top diamond, and one storey is 34 px.
- **Shading:** no specular, falloff or cast shadows. Each face is its palette colour × a fixed tone: top 1.00, left face 0.90, right face 0.70. Curved faces blend between left and right.
- **Lot base:** buildings stand on 19 px of concrete over 14 px of dirt, with the top level with the street.

**Calibration check:** `render.mjs calibration-tile --check public/sprites/ground-pavement.png` rebuilds Kenney's pavement tile from a box. The current result is 98.5% silhouette overlap (Kenney draws it 1 px narrower) and a mean colour error of 0.7/255.

## Adding a sprite to the game

1. Write `models/<name>.js` and render it. Compare it with `compare.mjs`, and also check it in the town.
2. Copy the accepted PNG to `public/sprites/` and register it in `src/city/sprites.ts` with its size and `anchorY`. `anchorY` is the row of the lot's top-face centre; for a Kenney-style lot it is `height − 66`.
3. Keep a Kenney fallback (see `USE_POWER_STATION_ART`). `sprites.test.ts` checks every registered PNG's size.

The model file is the source; renders are reproducible output. Third-party
model sources (for example Tripo GLBs, if ever approved) belong in
`art-source/<tool>/<asset>/` with their prompt and settings. Never commit API
keys: put them in `.env.local`, which is git-ignored.
