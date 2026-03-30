import os
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles

from app.models import GraphStatsResponse, VectorizeDebugResponse, VectorizeResponse
from app.pipeline import vectorize_from_image_bytes

STATIC_DIR = Path(__file__).resolve().parent / "static"
ACCEPTED_IMAGE_TYPES = {
    "image/png",
    "image/x-png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/bmp",
    "image/tiff",
    "image/x-tiff",
}
ExportMode = Literal["hybrid", "polyline", "spline"]
SimplificationLevel = Literal["low", "mid", "high"]

SIMPLIFICATION_PRESETS: dict[SimplificationLevel, tuple[float, int]] = {
    "low": (0.5, 1),
    "mid": (1.0, 2),
    "high": (1.5, 3),
}


def _allowed_origins() -> list[str]:
    raw = os.getenv("ALLOWED_ORIGINS", "*").strip()
    if raw == "*":
        return ["*"]
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


app = FastAPI(title="Raster-to-DXF Centerline Vectorization")
origins = _allowed_origins()
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials="*" not in origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


async def _read_image_payload(file: UploadFile) -> bytes:
    if file.content_type not in ACCEPTED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file must be a PNG, JPEG, WebP, BMP, or TIFF image",
        )

    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    return payload


@app.get("/", include_in_schema=False)
def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def _resolve_vectorization_params(
    simplification: SimplificationLevel | None,
    simplify_epsilon: float,
    smooth_iterations: int,
) -> tuple[float, int, SimplificationLevel]:
    level = simplification or "mid"
    if level not in SIMPLIFICATION_PRESETS:
        raise HTTPException(status_code=400, detail="Invalid simplification preset")

    preset_epsilon, preset_smooth = SIMPLIFICATION_PRESETS[level]
    if simplification is None:
        return simplify_epsilon, smooth_iterations, level
    return preset_epsilon, preset_smooth, level


@app.post("/vectorize", response_model=VectorizeResponse)
async def vectorize(
    file: UploadFile = File(...),
    simplification: SimplificationLevel = "mid",
    simplify_epsilon: float = 0.8,
    smooth_iterations: int = 1,
    export_mode: ExportMode = "hybrid",
    include_fill: bool = True,
    preserve_detail: bool = False,
) -> VectorizeResponse:
    payload = await _read_image_payload(file)
    resolved_epsilon, resolved_smooth, resolved_level = _resolve_vectorization_params(
        simplification,
        simplify_epsilon,
        smooth_iterations,
    )

    try:
        if preserve_detail:
            resolved_epsilon = min(resolved_epsilon, 0.3)
            resolved_smooth = 0
        result = vectorize_from_image_bytes(
            payload,
            simplify_epsilon=resolved_epsilon,
            smooth_iterations=resolved_smooth,
            export_mode=export_mode,
            include_fill=include_fill,
            preserve_detail=preserve_detail,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Vectorization failed: {exc}") from exc

    return VectorizeResponse(
        width=result.width,
        height=result.height,
        export_mode=f"{export_mode}:{resolved_level}",
        path_count=len(result.paths_px),
        svg_preview=result.svg_text,
        dxf_base64=result.dxf_base64,
    )


@app.post("/vectorize/dxf")
async def vectorize_dxf(
    file: UploadFile = File(...),
    simplification: SimplificationLevel = "mid",
    simplify_epsilon: float = 0.8,
    smooth_iterations: int = 1,
    export_mode: ExportMode = "hybrid",
    include_fill: bool = False,
    preserve_detail: bool = False,
) -> Response:
    payload = await _read_image_payload(file)
    resolved_epsilon, resolved_smooth, _resolved_level = _resolve_vectorization_params(
        simplification,
        simplify_epsilon,
        smooth_iterations,
    )

    try:
        if preserve_detail:
            resolved_epsilon = min(resolved_epsilon, 0.3)
            resolved_smooth = 0
        result = vectorize_from_image_bytes(
            payload,
            simplify_epsilon=resolved_epsilon,
            smooth_iterations=resolved_smooth,
            export_mode=export_mode,
            include_fill=include_fill,
            preserve_detail=preserve_detail,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Vectorization failed: {exc}") from exc

    return Response(
        content=result.dxf_text,
        media_type="application/dxf",
        headers={"Content-Disposition": 'attachment; filename="vectorized.dxf"'},
    )


@app.post("/vectorize/debug", response_model=VectorizeDebugResponse)
async def vectorize_debug(
    file: UploadFile = File(...),
    simplification: SimplificationLevel = "mid",
    simplify_epsilon: float = 0.8,
    smooth_iterations: int = 1,
    export_mode: ExportMode = "hybrid",
    include_fill: bool = True,
    preserve_detail: bool = False,
) -> VectorizeDebugResponse:
    payload = await _read_image_payload(file)
    resolved_epsilon, resolved_smooth, resolved_level = _resolve_vectorization_params(
        simplification,
        simplify_epsilon,
        smooth_iterations,
    )

    try:
        if preserve_detail:
            resolved_epsilon = min(resolved_epsilon, 0.3)
            resolved_smooth = 0
        result = vectorize_from_image_bytes(
            payload,
            simplify_epsilon=resolved_epsilon,
            smooth_iterations=resolved_smooth,
            export_mode=export_mode,
            include_fill=include_fill,
            preserve_detail=preserve_detail,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Vectorization failed: {exc}") from exc

    return VectorizeDebugResponse(
        width=result.width,
        height=result.height,
        export_mode=f"{export_mode}:{resolved_level}",
        path_count=len(result.paths_px),
        graph_stats=GraphStatsResponse(**result.graph_stats),
        svg_preview=result.svg_text,
    )
