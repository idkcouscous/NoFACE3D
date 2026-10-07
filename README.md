# NOFACE3D project page

NOFACE3D: Noise-Scheduled Focused Anchoring for Controlled Enhancement for 3D Generation.

Live preview: https://18768--standard--b200-dev-box--jamesrose.devspaces.rbx.com/

This source bundle contains the project page and its synchronized 3D comparison viewer, with nine examples across BIGDETAIL, characters, and TexVerse.

## Files

- `template.html`: editable page layout and content.
- `bigdetail.js` and `bigdetail.css`: comparison viewer and styles.
- `comparison-manifest.json`: sample metadata, asset paths, checksums, and cameras.
- `vendor/three/`: bundled Three.js runtime and its license.
- `build.py`: embeds paper figures and sample metadata into the three HTML entry points.
- `index.html`, `comparisons-360.html`, `bigdetail-360.html`: generated pages.
- `server.py`: local preview server, including compressed mesh delivery.

## Required media

The source bundle does **not** include the model/image assets or PDFs. The original hosted page keeps about 1.14 GB of files in `assets/`. An asset hosting or distribution arrangement is needed before this repository can provide a fully working standalone deployment.

`required-media.json` lists the media paths used by the page. Restore them relative to this directory, keeping the paths in `comparison-manifest.json`. Both fast previews and full-quality models are required for the existing quality selector. The build also needs the original figure-source `paper.pdf`; its figure extraction uses fixed page indices.

## Preview

With the media restored, run:

```sh
python server.py
```

Open `http://localhost:18768/`. The prebuilt HTML needs no Python packages beyond the standard library to serve. Static hosting can also serve the same page, JavaScript, styles, vendor files, and media.

## Rebuild

Install PyMuPDF in your project environment, then run:

```sh
python -m pip install PyMuPDF
python build.py
```

The build updates all three HTML entry points and precompresses preview meshes. To generate optional PDF snapshots, install Playwright and its Chromium browser, start the preview server, then run `python export_pdf.py`.

The page remains a draft: editorial notes, author information, citation metadata, and release links need final review before publication.
