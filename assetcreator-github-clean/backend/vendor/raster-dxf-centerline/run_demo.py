from __future__ import annotations

import argparse
from pathlib import Path

import cv2

from app.pipeline import vectorize_from_array


def main() -> None:
    parser = argparse.ArgumentParser(description="Vectorize a raster line drawing to DXF centerlines")
    parser.add_argument("image", type=Path, help="Path to black-and-white line drawing")
    parser.add_argument("--out-dxf", type=Path, default=Path("output.dxf"), help="DXF output path")
    parser.add_argument("--out-svg", type=Path, default=Path("preview.svg"), help="SVG preview output path")
    parser.add_argument(
        "--mode",
        choices=["hybrid", "polyline", "spline"],
        default="hybrid",
        help="Centerline geometry mode for export",
    )
    parser.add_argument("--epsilon", type=float, default=0.8, help="Polyline simplification epsilon")
    parser.add_argument("--smooth", type=int, default=1, help="Path smoothing iterations")
    args = parser.parse_args()

    gray = cv2.imread(str(args.image), cv2.IMREAD_GRAYSCALE)
    if gray is None:
        raise SystemExit(f"Could not read image: {args.image}")

    result = vectorize_from_array(
        gray,
        simplify_epsilon=args.epsilon,
        smooth_iterations=args.smooth,
        export_mode=args.mode,
    )

    args.out_dxf.write_text(result.dxf_text, encoding="utf-8")
    args.out_svg.write_text(result.svg_text, encoding="utf-8")

    print(f"Wrote {len(result.paths_px)} centerline paths in {args.mode} mode")
    print(f"DXF: {args.out_dxf}")
    print(f"SVG: {args.out_svg}")


if __name__ == "__main__":
    main()
