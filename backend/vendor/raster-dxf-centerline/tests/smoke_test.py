import base64
import io

import cv2
import ezdxf
import numpy as np
from fastapi.testclient import TestClient

from app.main import app
from app.pipeline import (
    _build_open_svg_path_data,
    _bridge_endpoint_gaps,
    _collapse_nearly_straight_path,
    _centerline_entities,
    preprocess_binarize,
    _resample_path,
    _smooth_path,
    _spline_has_overshoot_risk,
    vectorize_from_array,
)


client = TestClient(app)


def _entity_types(dxf_text: str) -> list[str]:
    doc = ezdxf.read(io.StringIO(dxf_text))
    return [entity.dxftype() for entity in doc.modelspace()]


def _synthetic_strokes() -> np.ndarray:
    canvas = np.full((180, 240), 255, dtype=np.uint8)
    cv2.line(canvas, (20, 20), (200, 20), color=0, thickness=7)
    cv2.line(canvas, (60, 40), (60, 160), color=0, thickness=9)
    cv2.line(canvas, (100, 50), (210, 150), color=0, thickness=6)
    return canvas


def _synthetic_t_junction() -> np.ndarray:
    canvas = np.full((220, 220), 255, dtype=np.uint8)
    cv2.line(canvas, (40, 60), (180, 60), color=0, thickness=11)
    cv2.line(canvas, (110, 60), (110, 190), color=0, thickness=11)
    return canvas


def _synthetic_closed_outline() -> np.ndarray:
    canvas = np.full((220, 220), 255, dtype=np.uint8)
    cv2.rectangle(canvas, (40, 40), (180, 180), color=0, thickness=10)
    cv2.line(canvas, (70, 110), (150, 110), color=0, thickness=8)
    return canvas


def _synthetic_mixed_geometry() -> np.ndarray:
    canvas = np.full((240, 240), 255, dtype=np.uint8)
    cv2.line(canvas, (20, 200), (210, 200), color=0, thickness=8)
    cv2.ellipse(canvas, (120, 95), (65, 42), 0, 25, 320, color=0, thickness=8)
    return canvas


def _synthetic_broken_line() -> np.ndarray:
    canvas = np.full((120, 220), 255, dtype=np.uint8)
    cv2.line(canvas, (20, 60), (90, 60), color=0, thickness=4)
    cv2.line(canvas, (98, 60), (190, 60), color=0, thickness=4)
    return canvas


def _synthetic_branch_heavy_linework() -> np.ndarray:
    canvas = np.full((200, 320), 255, dtype=np.uint8)
    cv2.line(canvas, (20, 140), (300, 140), color=0, thickness=7)
    cv2.line(canvas, (80, 70), (80, 140), color=0, thickness=6)
    cv2.line(canvas, (160, 40), (160, 140), color=0, thickness=6)
    cv2.line(canvas, (240, 90), (240, 140), color=0, thickness=6)
    return canvas


def _synthetic_dense_parallel_strokes() -> np.ndarray:
    canvas = np.full((120, 120), 255, dtype=np.uint8)
    for x in [30, 35, 40, 45]:
        cv2.line(canvas, (x, 10), (x, 110), color=0, thickness=2)
    return canvas


def _synthetic_mixed_outline_cavities() -> np.ndarray:
    canvas = np.full((180, 220), 255, dtype=np.uint8)
    cv2.rectangle(canvas, (20, 25), (110, 150), color=0, thickness=3)
    cv2.rectangle(canvas, (150, 35), (170, 145), color=0, thickness=3)
    return canvas


def test_vectorization_produces_centerline_paths() -> None:
    gray = _synthetic_strokes()
    result = vectorize_from_array(gray, simplify_epsilon=1.2, smooth_iterations=1)

    assert result.width == 240
    assert result.height == 180
    assert len(result.paths_px) >= 3
    assert result.fill_paths_px == []
    assert all(len(path) >= 2 for path in result.paths_px)
    assert result.graph_stats["polyline_count"] + result.graph_stats["spline_count"] == len(result.paths_px)
    assert "<polyline" in result.svg_text or "<path" in result.svg_text
    decoded_dxf = base64.b64decode(result.dxf_base64.encode("utf-8")).decode("utf-8")
    assert "LWPOLYLINE" in decoded_dxf or "SPLINE" in decoded_dxf


def test_root_serves_browser_app() -> None:
    response = client.get("/")

    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "Centerline vectorization" in response.text
    assert "Simplification" in response.text
    assert "Mid" in response.text


def test_vectorize_dxf_endpoint_returns_attachment() -> None:
    gray = _synthetic_strokes()
    success, encoded = cv2.imencode(".png", gray)
    assert success

    response = client.post(
        "/vectorize/dxf",
        files={"file": ("drawing.png", encoded.tobytes(), "image/png")},
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/dxf")
    assert "attachment; filename=\"vectorized.dxf\"" in response.headers["content-disposition"]
    assert "LWPOLYLINE" in response.text or "SPLINE" in response.text


def test_t_junction_merges_straight_stroke_through_branch() -> None:
    gray = _synthetic_t_junction()
    result = vectorize_from_array(gray, simplify_epsilon=0.8, smooth_iterations=1)

    assert len(result.paths_px) == 2
    assert result.graph_stats["edge_run_count"] >= 3
    assert result.graph_stats["merged_path_count"] == len(result.paths_px)
    assert result.graph_stats["polyline_count"] + result.graph_stats["spline_count"] == len(result.paths_px)
    horizontal_spans = [max(point[0] for point in path) - min(point[0] for point in path) for path in result.paths_px]
    assert max(horizontal_spans) >= 135.0
    assert all(len(path) >= 2 for path in result.paths_px)


def test_small_stroke_gap_is_bridged() -> None:
    gray = _synthetic_broken_line()
    result = vectorize_from_array(gray, simplify_epsilon=0.5, smooth_iterations=0)

    assert len(result.paths_px) == 1
    assert result.graph_stats["endpoint_count"] == 2


def test_dense_detail_preprocess_preserves_parallel_stroke_separation() -> None:
    gray = _synthetic_dense_parallel_strokes()
    foreground, detail_mask, bridge_mask = preprocess_binarize(gray)

    component_count = cv2.connectedComponents((foreground.astype(np.uint8) * 255), connectivity=8)[0] - 1
    assert component_count == 4
    assert int(detail_mask.sum()) > 0
    assert int(bridge_mask.sum()) == 0


def test_preprocess_fills_narrow_enclosed_stroke_cavities_only() -> None:
    gray = _synthetic_mixed_outline_cavities()
    foreground, _detail_mask, _bridge_mask = preprocess_binarize(gray)

    # The narrow outlined rectangle should be collapsed into a solid stroke area.
    assert bool(foreground[90, 160])

    # The large outlined rectangle should still retain its intended interior hole.
    assert not bool(foreground[90, 65])


def test_blocked_dense_region_prevents_gap_bridge() -> None:
    skeleton = np.zeros((40, 60), dtype=bool)
    skeleton[20, 8:22] = True
    skeleton[20, 28:42] = True

    blocked = np.zeros_like(skeleton, dtype=bool)
    blocked[17:24, 20:30] = True

    bridged = _bridge_endpoint_gaps(skeleton, max_gap=12.0, max_angle_deg=20.0, iterations=1, blocked_mask=blocked)
    assert not bridged[20, 25]


def test_corner_aware_smoothing_removes_stair_steps_but_keeps_endpoints() -> None:
    points = [(0.0, 0.0), (1.0, 0.0), (2.0, 1.0), (3.0, 1.0), (4.0, 2.0), (5.0, 2.0)]
    resampled = _resample_path(points, spacing=0.75)
    smoothed = _smooth_path(resampled, iterations=1)

    assert smoothed[0] == points[0]
    assert smoothed[-1] == points[-1]
    assert any(not x.is_integer() or not y.is_integer() for x, y in smoothed[1:-1])


def test_handle_like_path_downgrades_risky_spline_to_polyline() -> None:
    handle_path = [(0.0, 0.0), (20.0, 0.0), (40.0, 0.0), (52.0, 4.0), (60.0, 14.0), (60.0, 40.0), (60.0, 80.0)]

    assert _spline_has_overshoot_risk(handle_path)
    entities = _centerline_entities([handle_path], export_mode="hybrid")
    assert entities[0].kind == "polyline"


def test_svg_spline_builder_clamps_controls_inside_local_envelope() -> None:
    handle_path = [(0.0, 0.0), (20.0, 0.0), (40.0, 0.0), (52.0, 4.0), (60.0, 14.0), (60.0, 40.0), (60.0, 80.0)]

    svg_path = _build_open_svg_path_data(handle_path)
    assert "-0.67" not in svg_path
    assert "61.33" not in svg_path


def test_nearly_straight_noisy_diagonal_collapses_to_two_point_line() -> None:
    diagonal = [(0.0, 0.0), (10.0, 10.4), (20.0, 20.1), (30.0, 29.7), (40.0, 40.2)]

    collapsed = _collapse_nearly_straight_path(diagonal)
    assert len(collapsed) == 2
    assert collapsed[0] != collapsed[1]


def test_branch_heavy_linework_keeps_main_baseline_continuous() -> None:
    gray = _synthetic_branch_heavy_linework()
    result = vectorize_from_array(gray, simplify_epsilon=0.8, smooth_iterations=1)

    assert len(result.paths_px) == 4
    longest_span = max(max(point[0] for point in path) - min(point[0] for point in path) for path in result.paths_px)
    assert longest_span >= 270.0


def test_hybrid_mode_mixes_polylines_and_splines() -> None:
    gray = _synthetic_mixed_geometry()
    result = vectorize_from_array(gray, simplify_epsilon=0.9, smooth_iterations=1, export_mode="hybrid")

    assert result.graph_stats["polyline_count"] >= 1
    assert result.graph_stats["spline_count"] >= 1
    assert any(entity.kind == "polyline" for entity in result.centerline_entities)
    assert any(entity.kind == "spline" for entity in result.centerline_entities)
    decoded_dxf = base64.b64decode(result.dxf_base64.encode("utf-8")).decode("utf-8")
    entity_types = _entity_types(decoded_dxf)
    assert "LWPOLYLINE" in entity_types
    assert "SPLINE" in entity_types


def test_polyline_mode_forces_polylines() -> None:
    gray = _synthetic_mixed_geometry()
    result = vectorize_from_array(gray, simplify_epsilon=0.9, smooth_iterations=1, export_mode="polyline")

    assert result.graph_stats["spline_count"] == 0
    assert result.graph_stats["polyline_count"] == len(result.paths_px)
    assert all(entity.kind == "polyline" for entity in result.centerline_entities)
    decoded_dxf = base64.b64decode(result.dxf_base64.encode("utf-8")).decode("utf-8")
    entity_types = _entity_types(decoded_dxf)
    assert "LWPOLYLINE" in entity_types
    assert "SPLINE" not in entity_types


def test_spline_mode_forces_splines() -> None:
    gray = _synthetic_mixed_geometry()
    result = vectorize_from_array(gray, simplify_epsilon=0.9, smooth_iterations=1, export_mode="spline")

    assert result.graph_stats["polyline_count"] == 0
    assert result.graph_stats["spline_count"] == len(result.paths_px)
    assert all(entity.kind == "spline" for entity in result.centerline_entities)
    decoded_dxf = base64.b64decode(result.dxf_base64.encode("utf-8")).decode("utf-8")
    entity_types = _entity_types(decoded_dxf)
    assert "SPLINE" in entity_types
    assert "LWPOLYLINE" not in entity_types


def test_closed_outline_creates_white_fill_without_visible_outline() -> None:
    gray = _synthetic_closed_outline()
    result = vectorize_from_array(gray, simplify_epsilon=1.0, smooth_iterations=1)

    assert len(result.fill_paths_px) >= 1
    assert 'fill="#ffffff"' in result.svg_text
    decoded_dxf = base64.b64decode(result.dxf_base64.encode("utf-8")).decode("utf-8")
    entity_types = _entity_types(decoded_dxf)
    assert "HATCH" in entity_types
    assert "LWPOLYLINE" in entity_types or "SPLINE" in entity_types
    assert "CENTERLINES" in decoded_dxf
    assert "FILL" in decoded_dxf
    assert "OUTLINE" not in decoded_dxf


def test_vectorize_accepts_jpeg_upload() -> None:
    gray = _synthetic_strokes()
    success, encoded = cv2.imencode(".jpg", gray)
    assert success

    response = client.post(
        "/vectorize",
        files={"file": ("drawing.jpg", encoded.tobytes(), "image/jpeg")},
    )

    assert response.status_code == 200
    assert response.json()["path_count"] >= 3
    assert response.json()["export_mode"] == "hybrid:mid"


def test_vectorize_accepts_simplification_presets() -> None:
    gray = _synthetic_strokes()
    success, encoded = cv2.imencode(".png", gray)
    assert success

    low_response = client.post(
        "/vectorize?simplification=low",
        files={"file": ("drawing.png", encoded.tobytes(), "image/png")},
    )
    high_response = client.post(
        "/vectorize?simplification=high",
        files={"file": ("drawing.png", encoded.tobytes(), "image/png")},
    )

    assert low_response.status_code == 200
    assert high_response.status_code == 200
    assert low_response.json()["export_mode"] == "hybrid:low"
    assert high_response.json()["export_mode"] == "hybrid:high"


def test_vectorize_rejects_non_image_upload() -> None:
    response = client.post(
        "/vectorize",
        files={"file": ("drawing.txt", b"not-an-image", "text/plain")},
    )

    assert response.status_code == 400
    assert "image" in response.json()["detail"].lower()


def test_vectorize_debug_returns_graph_stats() -> None:
    gray = _synthetic_strokes()
    success, encoded = cv2.imencode(".png", gray)
    assert success

    response = client.post(
        "/vectorize/debug",
        files={"file": ("drawing.png", encoded.tobytes(), "image/png")},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["export_mode"] == "hybrid:mid"
    assert payload["path_count"] >= 3
    assert payload["graph_stats"]["endpoint_count"] >= 2
    assert payload["graph_stats"]["junction_count"] >= 0
    assert payload["graph_stats"]["edge_run_count"] >= payload["graph_stats"]["merged_path_count"]
    assert payload["graph_stats"]["polyline_count"] + payload["graph_stats"]["spline_count"] == payload["path_count"]
    assert "<polyline" in payload["svg_preview"] or "<path" in payload["svg_preview"]
