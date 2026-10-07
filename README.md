# NOFACE3D project page

NOFACE3D: Noise-Scheduled Focused Anchoring for Controlled Enhancement for 3D Generation.

Project page: https://idkcouscous.github.io/NoFACE3D/

This source bundle contains the project page and its synchronized 3D comparison viewer, with nine examples across BIGDETAIL, characters, and TexVerse.

## Files

- `template.html`: editable page layout and content.
- `bigdetail.js` and `bigdetail.css`: comparison viewer and styles.
- `comparison-manifest.json`: sample metadata, asset paths, checksums, and cameras.
- `vendor/three/`: bundled Three.js runtime and its license.
- `build.py`: embeds paper figures and sample metadata into the three HTML entry points.
- `index.html`, `comparisons-360.html`, `bigdetail-360.html`: generated pages.
- `server.py`: local preview server, including compressed mesh delivery.

## Media and hosting

The repository includes the selected image and model assets, both fast previews and full-quality meshes, and the linked PDFs. `required-media.json` lists these files. Only the selected sample and quality are downloaded by the viewer.

GitHub Pages serves the repository root from `main`; `.nojekyll` enables static-file delivery. The generated pages can be published without running the Python build. The complete site is approximately 948 MB, so keep the GitHub Pages size limit in mind when adding media.

The build uses the original figure-source `paper.pdf` with fixed page indices. Replacing the paper may require updating those indices.

## Preview

Run:

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
