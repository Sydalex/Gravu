# Raster-to-DXF Centerline Vectorization App

Standalone FastAPI app that converts black-and-white raster line drawings into spline-based centerline vectors and exports DXF + SVG preview.

## What this does

- Treats black raster lines as thick strokes
- Binarizes, despeckles, and normalizes stroke width to reduce artifacts
- Skeletonizes to a 1-pixel centerline
- Converts skeleton pixels into a topology graph (endpoints, junctions, edge runs)
- Traces each edge run into one continuous stroke path
- Merges runs only when they are truly collinear and continuous
- Smooths and simplifies paths without changing topology
- Exports centerlines as DXF `SPLINE` entities
- Detects enclosed object bodies and adds white fill regions in DXF + SVG preview
- Returns SVG preview for browser rendering

## Project structure

- `app/main.py` - FastAPI app and upload endpoint
- `app/pipeline.py` - preprocessing, skeleton graph tracing, smoothing, DXF/SVG export
- `app/models.py` - response schema
- `app/static/` - browser UI for upload, preview, and DXF download
- `run_demo.py` - local runner for single-image conversion
- `tests/smoke_test.py` - synthetic-strokes smoke test

## Install

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run app

```bash
uvicorn app.main:app --reload
```

Open the upload UI at `http://127.0.0.1:8000/`.

Open API docs at `http://127.0.0.1:8000/docs`.

## Docker

```bash
docker build -t raster-dxf-centerline .
docker run --rm -p 8000:8000 raster-dxf-centerline
```

## Browser UI

The root page serves a simple standalone app with:

- image upload
- spline preview with white-filled enclosed regions
- path count and canvas stats
- DXF download button

Accepted upload types:

- PNG
- JPEG
- WebP
- BMP
- TIFF

## API usage

`POST /vectorize`

- multipart field: `file` (image)
- accepts PNG, JPEG, WebP, BMP, or TIFF images
- query params:
  - `simplify_epsilon` (float, default `0.8`)
  - `smooth_iterations` (int, default `1`)

Response includes:

- `dxf_base64`: DXF text encoded as base64
- `svg_preview`: SVG markup of vectorized paths
- `path_count`, `width`, `height`

DXF output contains:

- `CENTERLINES` layer with spline stroke paths
- `FILL` layer with solid white hatch fill inside those boundaries

`POST /vectorize/dxf`

- multipart field: `file` (image)
- accepts PNG, JPEG, WebP, BMP, or TIFF images
- query params:
  - `simplify_epsilon` (float, default `0.8`)
  - `smooth_iterations` (int, default `1`)

Returns a downloadable DXF payload directly with content type `application/dxf`.

`POST /vectorize/debug`

- multipart field: `file` (image)
- accepts PNG, JPEG, WebP, BMP, or TIFF images
- query params:
  - `simplify_epsilon` (float, default `0.8`)
  - `smooth_iterations` (int, default `1`)

Returns graph diagnostics for QA/tuning:

- `graph_stats.endpoint_count`
- `graph_stats.junction_count`
- `graph_stats.edge_run_count`
- `graph_stats.merged_path_count`

## Demo CLI

```bash
python run_demo.py /path/to/input.png --out-dxf output.dxf --out-svg preview.svg
```

## Test

```bash
pytest -q
```

## Integrating into another app

- Run this service standalone and call `POST /vectorize` from your main app.
- For local integration, the API enables CORS from all origins by default.
- In production, set `ALLOWED_ORIGINS=https://yourapp.com,https://admin.yourapp.com` to restrict cross-origin access.
