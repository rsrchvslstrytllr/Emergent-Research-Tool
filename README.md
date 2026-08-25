# Emergent Research Tool

A browser-based image-treatment studio that turns any image into a field of
color-sampled **spark** marks arranged on a hex grid. Built for the Cohere
Visual Storyteller SWAG project to produce print-ready artwork for garments.

Everything runs locally in the browser — no image is ever uploaded to a
server.

## Features

- Drag-and-drop or file-picker image upload (PNG, JPG, WEBP, GIF)
- Hex-packed spark lattice that preserves the source image's coherence
- Color treatments:
  - **Electric dither** — limited bright palette with deterministic blue-noise dithering
  - **Boosted source** — source colors pushed toward contrast against the preview background
  - **Original sample** — exact sampled RGB
- Density, spark size, contrast, and dither controls
- Optional grid gutters that split the image into sections
- Independent layer toggles for sparks, source image, and grid
- Preview-background swatches (navy, black, cream, white, or custom) — the
  preview color is never exported
- Print export:
  - **Transparent 300 DPI PNG** with embedded `pHYs` density metadata
  - **SVG** with every spark as an editable vector `<path>`

## Run locally

It's a static site — any static file server works:

```bash
python3 -m http.server 4173 --bind 127.0.0.1
# open http://127.0.0.1:4173/
```

## Deploy

The app is a single `index.html` plus `app.js`, `styles.css`, and
`sparkwhite.svg`. Deploy it as a static site on Vercel, Netlify, GitHub Pages,
or any static host.
