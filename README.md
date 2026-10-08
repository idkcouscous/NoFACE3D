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

GitHub Pages serves the repository root from `main`; `.nojekyll` enables static-file delivery. The generated pages can be published without running the Python build. The complete site is approximately 952 MB, so keep the GitHub Pages size limit in mind when adding media.

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

The page lists the authors and identifies the paper as under review at ICLR 2027. Method code and the full BIGDETAIL dataset are planned for release; this repository hosts the project website and its selected examples.

## BIGDETAIL image gallery

The benchmark section shows 99 conditioning images randomly sampled from a collection of 420 source images (seed `20261007`). The sample is fixed across visits. Each JPEG preserves its aspect ratio and fits within 1280×720 pixels without upscaling.

The gallery displays three images at a time across 33 pages. Next advances one page; Last returns to the previous page. Only the current three images are requested.

- `bigdetail-gallery.json`: selected filenames, image dimensions, and sampling seed.
- `bigdetail-gallery.js` / `bigdetail-gallery.css`: gallery controls and layout.
- `assets/bigdetail-gallery/`: 99 resized JPEGs.
- `prepare_gallery.py`: samples and resizes an authorized local image collection using Pillow. Source downloads use the shared Portal service.

To regenerate from a local source collection, install Pillow and run:

```sh
python prepare_gallery.py /path/to/source-images . --seed 20261007
```

Keep `required-media.json` in sync if the gallery paths change.

## Boundary anchoring ablation

Two supplied pairs are shown one at a time with shared camera, orbit, pan, zoom, auto-rotation, and texture/clay/normal controls. Each pair compares `voxel_to_mesh_remesh_1024` (Without noise scheduling) against its matching `12_remesh/joined_remesh_1024.glb` (With noise scheduling). The refined meshes are the supplied S3 remesh outputs for Yun Jin and Kamisato Ayaka; their source URIs are recorded in the manifest.

The four displayed GLBs are stored unchanged on the `ablation-assets` branch and loaded through immutable GitHub raw URLs recorded in `ablation-manifest.json`. This keeps the Pages deployment below its size limit. The viewer checks byte lengths, SHA-256 hashes, and triangle counts. Both meshes use one common display transform; there is no independent alignment or simplification. Only the selected pair loads, starting when the ablation section approaches the viewport.

`comparison-viewer.js` is shared by the results and ablation viewers. Each instance has its own state and camera; controls for one section do not affect the other.

The ablation viewer’s **Detail** button frames the recorded head-and-neck refinement cube identically in both panes. **Refinement box** toggles matching 3D outlines independently of the camera and rendering mode. Detail mode and outline visibility persist when switching samples. Bounds come from `selection.source_cube_bounds` in the inference metadata; `ablation-regions.json` records provenance and the alignment cross-check. Both outlines use the same display transform as the meshes.

## Sequential editing viewer

The Wings → head refinement and Engine bay → rockets examples each show three synchronized stages: the starting TRELLIS.2 mesh, edit 1, and edit 2 (final). A single camera controls all three views; rendering mode, orbit, pan, zoom, and auto-rotation are shared. One sequence loads at a time, with three columns on desktop and stacked views on mobile. The paper figures remain available below the viewer.

`editing-manifest.json` records the supplied S3 sources, immutable URLs on the `editing-assets` branch, SHA-256 hashes, byte sizes, and triangle counts. The six GLBs are preserved without simplification. Each sequence uses one display transform derived from the union of all three mesh bounds, preserving their relative scale and alignment. The unused car variant `custom-cf1f543efaf6_439c-stock_mesh.glb` is excluded.

## Comparison refinement regions

All nine 3D comparison samples include the recorded refinement cuboid in both panes, with a **Refinement box** switch. BIGDETAIL uses the rotated `region.bbox_3d` annotations from each refinement run’s `bbox.json`; inverse box rotation preserves the eight corners in the original mesh scene. Character and TexVerse selections use `selection.source_cube_bounds` from `02_semantic_crop/selection.json` in the comparison frame. All regions use the existing shared display normalization, in both preview and full quality. Cuboids do not affect mesh framing or rendering modes.

`comparison-regions.json` records the exact S3 metadata URIs, hashes, coordinate mapping, and corner coordinates. Alignment round-trip checks and agreement with all nine existing Detail camera centers validate the mappings.
