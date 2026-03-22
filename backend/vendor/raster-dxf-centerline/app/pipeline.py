from __future__ import annotations

import base64
import io
import math
from dataclasses import dataclass
from typing import Iterable, Literal

import cv2
import ezdxf
import numpy as np
from skimage.morphology import skeletonize

Pixel = tuple[int, int]
Point = tuple[float, float]
ExportMode = Literal["hybrid", "polyline", "spline"]
WORK_SCALE = 2.0


@dataclass
class CenterlineEntity:
    kind: Literal["polyline", "spline"]
    points: list[Point]


@dataclass
class VectorizationResult:
    width: int
    height: int
    paths_px: list[list[Point]]
    fill_paths_px: list[list[Point]]
    centerline_entities: list[CenterlineEntity]
    dxf_text: str
    svg_text: str
    graph_stats: dict[str, int]

    @property
    def dxf_base64(self) -> str:
        return base64.b64encode(self.dxf_text.encode("utf-8")).decode("utf-8")


def _decode_grayscale(image_bytes: bytes) -> np.ndarray:
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)
    if image is None:
        raise ValueError("Could not decode image bytes")
    return image


def _nearby_component_count_map(foreground: np.ndarray, expansion_radius: int = 2) -> np.ndarray:
    if not np.any(foreground):
        return np.zeros_like(foreground, dtype=np.uint8)

    component_count, labels, _stats, _ = cv2.connectedComponentsWithStats(foreground.astype(np.uint8) * 255, connectivity=8)
    counts = np.zeros_like(labels, dtype=np.uint16)
    kernel_size = expansion_radius * 2 + 1
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))

    for label in range(1, component_count):
        component_mask = (labels == label).astype(np.uint8) * 255
        if not np.any(component_mask):
            continue
        vicinity = cv2.dilate(component_mask, kernel, iterations=1) > 0
        counts += vicinity.astype(np.uint16)

    return np.clip(counts, 0, 255).astype(np.uint8)


def _crowded_gap_mask(foreground: np.ndarray, gap_radius: float = 2.4, expansion_radius: int = 2) -> np.ndarray:
    if not np.any(foreground):
        return np.zeros_like(foreground, dtype=bool)

    background_u8 = ((~foreground).astype(np.uint8) * 255)
    background_distance = cv2.distanceTransform(background_u8, cv2.DIST_L2, 5)
    nearby_component_counts = _nearby_component_count_map(foreground, expansion_radius=expansion_radius)
    return (~foreground) & (background_distance <= gap_radius) & (nearby_component_counts >= 2)


def _dense_detail_protection_mask(
    foreground: np.ndarray,
    gap_radius: float = 2.4,
    expansion_radius: int = 2,
) -> np.ndarray:
    if not np.any(foreground):
        return np.zeros_like(foreground, dtype=bool)

    crowded_gaps = _crowded_gap_mask(foreground, gap_radius=gap_radius, expansion_radius=expansion_radius)
    if not np.any(crowded_gaps):
        return np.zeros_like(foreground, dtype=bool)

    gap_kernel_size = expansion_radius * 2 + 1
    gap_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (gap_kernel_size, gap_kernel_size))
    expanded_gaps = cv2.dilate(crowded_gaps.astype(np.uint8) * 255, gap_kernel, iterations=1) > 0

    component_count, labels, _stats, _ = cv2.connectedComponentsWithStats(foreground.astype(np.uint8) * 255, connectivity=8)
    protected_components = np.zeros_like(foreground, dtype=bool)
    for label in range(1, component_count):
        component_mask = labels == label
        if np.any(expanded_gaps & component_mask):
            protected_components |= component_mask

    if not np.any(protected_components):
        return expanded_gaps

    expanded_components = cv2.dilate(protected_components.astype(np.uint8) * 255, gap_kernel, iterations=1) > 0
    return expanded_gaps | expanded_components


def _dense_bridge_block_mask(
    foreground: np.ndarray,
    gap_radius: float = 2.4,
    expansion_radius: int = 2,
) -> np.ndarray:
    crowded_gaps = _crowded_gap_mask(foreground, gap_radius=gap_radius, expansion_radius=expansion_radius)
    if not np.any(crowded_gaps):
        return np.zeros_like(foreground, dtype=bool)

    nearby_component_counts = _nearby_component_count_map(foreground, expansion_radius=expansion_radius)
    dense_junction_gaps = crowded_gaps & (nearby_component_counts >= 3)
    if not np.any(dense_junction_gaps):
        return np.zeros_like(foreground, dtype=bool)

    kernel_size = expansion_radius * 2 + 1
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
    return cv2.dilate(dense_junction_gaps.astype(np.uint8) * 255, kernel, iterations=1) > 0


def preprocess_binarize(gray: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    denoised = cv2.medianBlur(gray, 3)
    _, thresholded = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    foreground = thresholded == 0

    foreground_u8 = (foreground.astype(np.uint8) * 255)
    component_count, labels, stats, _ = cv2.connectedComponentsWithStats(foreground_u8, connectivity=8)
    despeckled = np.zeros_like(foreground_u8)
    min_component_area = 6
    for label in range(1, component_count):
        area = stats[label, cv2.CC_STAT_AREA]
        if area >= min_component_area:
            despeckled[labels == label] = 255

    conservative = despeckled > 0
    detail_protection_mask = _dense_detail_protection_mask(conservative)
    bridge_block_mask = _dense_bridge_block_mask(conservative)

    normalized = _normalize_stroke_width(conservative)
    normalized_u8 = normalized.astype(np.uint8) * 255
    normalized_u8 = cv2.morphologyEx(normalized_u8, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    aggressive = normalized_u8 > 0

    blended = aggressive.copy()
    blended[detail_protection_mask] = conservative[detail_protection_mask]
    return blended, detail_protection_mask, bridge_block_mask


def _normalize_stroke_width(foreground: np.ndarray, target_width: float = 5.0) -> np.ndarray:
    foreground_u8 = foreground.astype(np.uint8) * 255
    if not np.any(foreground_u8):
        return foreground

    distance = cv2.distanceTransform(foreground_u8, cv2.DIST_L2, 5)
    radii = distance[foreground]
    radii = radii[radii > 0]
    if radii.size == 0:
        return foreground

    estimated_width = float(np.median(radii) * 2.0)
    if estimated_width <= 0:
        return foreground

    width_delta = target_width - estimated_width
    operation_radius = int(np.clip(round(abs(width_delta) / 2.0), 0, 1))
    if operation_radius == 0:
        return foreground

    kernel_size = operation_radius * 2 + 1
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
    if width_delta > 0:
        adjusted = cv2.dilate(foreground_u8, kernel, iterations=1)
    else:
        adjusted = cv2.erode(foreground_u8, kernel, iterations=1)
        adjusted = cv2.morphologyEx(adjusted, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    return adjusted > 0


def skeletonize_foreground(foreground: np.ndarray) -> np.ndarray:
    foreground_u8 = foreground.astype(np.uint8) * 255
    if hasattr(cv2, "ximgproc") and hasattr(cv2.ximgproc, "thinning"):
        thinned = cv2.ximgproc.thinning(foreground_u8, thinningType=cv2.ximgproc.THINNING_ZHANGSUEN)
        return thinned > 0
    return skeletonize(foreground)


def _neighbors(pixel: Pixel, skeleton: np.ndarray) -> list[Pixel]:
    row, col = pixel
    neighbors: list[Pixel] = []
    max_row, max_col = skeleton.shape
    for row_delta in (-1, 0, 1):
        for col_delta in (-1, 0, 1):
            if row_delta == 0 and col_delta == 0:
                continue
            next_row = row + row_delta
            next_col = col + col_delta
            if 0 <= next_row < max_row and 0 <= next_col < max_col and skeleton[next_row, next_col]:
                neighbors.append((next_row, next_col))
    return neighbors


def _edge_key(a: Pixel, b: Pixel) -> tuple[Pixel, Pixel]:
    return (a, b) if a <= b else (b, a)


def _degree_map(mask: np.ndarray) -> np.ndarray:
    mask_u8 = mask.astype(np.uint8)
    padded = np.pad(mask_u8, ((1, 1), (1, 1)), mode="constant", constant_values=0)
    degree = np.zeros_like(mask_u8, dtype=np.uint8)

    for row_delta in (-1, 0, 1):
        for col_delta in (-1, 0, 1):
            if row_delta == 0 and col_delta == 0:
                continue
            row_start = 1 + row_delta
            col_start = 1 + col_delta
            degree += padded[row_start : row_start + mask_u8.shape[0], col_start : col_start + mask_u8.shape[1]]

    return degree * mask_u8


def _pixel_path_to_points(path: list[Pixel]) -> list[Point]:
    points: list[Point] = []
    for row, col in path:
        points.append((float(col), float(row)))
    deduped: list[Point] = []
    for point in points:
        if not deduped or deduped[-1] != point:
            deduped.append(point)
    return deduped


def _resample_path(points: list[Point], spacing: float = 1.0) -> list[Point]:
    if len(points) < 2 or spacing <= 0:
        return points

    samples = np.array(points, dtype=np.float32)
    deltas = samples[1:] - samples[:-1]
    segment_lengths = np.linalg.norm(deltas, axis=1)
    total_length = float(np.sum(segment_lengths))
    if total_length <= spacing:
        return points

    cumulative = np.concatenate(([0.0], np.cumsum(segment_lengths)))
    sample_positions = np.arange(0.0, total_length, spacing, dtype=np.float32)
    if not math.isclose(float(sample_positions[-1]), total_length, rel_tol=0.0, abs_tol=1e-5):
        sample_positions = np.append(sample_positions, total_length)

    resampled: list[Point] = [points[0]]
    segment_index = 0

    for position in sample_positions[1:-1]:
        while segment_index < len(segment_lengths) - 1 and cumulative[segment_index + 1] < position:
            segment_index += 1

        segment_start = cumulative[segment_index]
        segment_length = float(segment_lengths[segment_index])
        if segment_length < 1e-6:
            continue

        interpolation = float((position - segment_start) / segment_length)
        point = samples[segment_index] + interpolation * deltas[segment_index]
        resampled.append((float(point[0]), float(point[1])))

    resampled.append(points[-1])

    deduped: list[Point] = [resampled[0]]
    for point in resampled[1:]:
        if math.hypot(point[0] - deduped[-1][0], point[1] - deduped[-1][1]) >= 1e-3:
            deduped.append(point)
    return deduped


def _rescale_paths(paths: list[list[Point]], scale: float) -> list[list[Point]]:
    if scale == 1.0:
        return paths

    scaled_paths: list[list[Point]] = []
    for path in paths:
        scaled_paths.append([(x / scale, y / scale) for x, y in path])
    return scaled_paths


def _corner_indices(points: list[Point], angle_threshold_deg: float = 32.0) -> set[int]:
    corners = {0, len(points) - 1}
    if len(points) < 3:
        return corners

    vectors = np.array(points, dtype=np.float32)
    for index in range(1, len(vectors) - 1):
        incoming = vectors[index] - vectors[index - 1]
        outgoing = vectors[index + 1] - vectors[index]
        incoming_norm = float(np.linalg.norm(incoming))
        outgoing_norm = float(np.linalg.norm(outgoing))
        if incoming_norm < 1e-6 or outgoing_norm < 1e-6:
            continue
        cosine = float(np.dot(incoming, outgoing) / (incoming_norm * outgoing_norm))
        cosine = float(np.clip(cosine, -1.0, 1.0))
        angle = math.degrees(math.acos(cosine))
        if angle >= angle_threshold_deg:
            corners.add(max(0, index - 1))
            corners.add(index)
            corners.add(min(len(points) - 1, index + 1))
    return corners


def _smooth_path(points: list[Point], iterations: int = 1) -> list[Point]:
    if iterations <= 0 or len(points) < 5:
        return points

    smoothed = np.array(points, dtype=np.float32)
    locked = np.zeros(len(points), dtype=bool)
    for index in _corner_indices(points):
        locked[index] = True

    for _ in range(iterations):
        updated = smoothed.copy()
        for index in range(1, len(smoothed) - 1):
            if locked[index]:
                continue
            updated[index] = (smoothed[index - 1] + 2.0 * smoothed[index] + smoothed[index + 1]) / 4.0
        smoothed = updated
    return [(float(x), float(y)) for x, y in smoothed]


def _smooth_closed_path(points: list[Point], iterations: int = 1) -> list[Point]:
    if iterations <= 0 or len(points) < 4:
        return points

    smoothed = np.array(points, dtype=np.float32)
    for _ in range(iterations):
        updated = smoothed.copy()
        updated = (
            np.roll(smoothed, 1, axis=0) + 2.0 * smoothed + np.roll(smoothed, -1, axis=0)
        ) / 4.0
        smoothed = updated
    return [(float(x), float(y)) for x, y in smoothed]


def _simplify_path(points: list[Point], epsilon: float) -> list[Point]:
    if len(points) < 3 or epsilon <= 0:
        return points

    contour = np.array(points, dtype=np.float32).reshape(-1, 1, 2)
    simplified = cv2.approxPolyDP(contour, epsilon=epsilon, closed=False).reshape(-1, 2)
    result = [(float(x), float(y)) for x, y in simplified]
    result[0] = points[0]
    result[-1] = points[-1]
    if len(result) < 2:
        return points
    return result


def _collapse_nearly_straight_path(points: list[Point]) -> list[Point]:
    if len(points) < 3 or not _is_nearly_straight(points):
        return points

    samples = np.array(points, dtype=np.float32).reshape(-1, 1, 2)
    fit = cv2.fitLine(samples, cv2.DIST_L2, 0, 0.01, 0.01)
    vx, vy, x0, y0 = fit.flatten()
    direction = np.array((float(vx), float(vy)), dtype=np.float32)
    origin = np.array((float(x0), float(y0)), dtype=np.float32)

    norm = float(np.linalg.norm(direction))
    if norm < 1e-6:
        return [points[0], points[-1]]
    direction /= norm

    vectors = np.array(points, dtype=np.float32)
    parameters = np.dot(vectors - origin, direction)
    start = origin + direction * float(np.min(parameters))
    end = origin + direction * float(np.max(parameters))

    source_direction = np.array(points[-1], dtype=np.float32) - np.array(points[0], dtype=np.float32)
    if float(np.dot(source_direction, end - start)) < 0:
        start, end = end, start

    return [(float(start[0]), float(start[1])), (float(end[0]), float(end[1]))]


def _simplify_closed_path(points: list[Point], epsilon: float) -> list[Point]:
    if len(points) < 4 or epsilon <= 0:
        return points

    contour = np.array(points, dtype=np.float32).reshape(-1, 1, 2)
    simplified = cv2.approxPolyDP(contour, epsilon=epsilon, closed=True).reshape(-1, 2)
    result = [(float(x), float(y)) for x, y in simplified]
    if len(result) < 3:
        return points
    return result


def _points_attr(points: list[Point]) -> str:
    return " ".join(f"{x:.2f},{y:.2f}" for x, y in points)


def _turn_angles(points: list[Point]) -> list[float]:
    if len(points) < 3:
        return []

    vectors = np.array(points, dtype=np.float32)
    turns: list[float] = []
    for index in range(1, len(vectors) - 1):
        incoming = vectors[index] - vectors[index - 1]
        outgoing = vectors[index + 1] - vectors[index]
        incoming_norm = float(np.linalg.norm(incoming))
        outgoing_norm = float(np.linalg.norm(outgoing))
        if incoming_norm < 1e-6 or outgoing_norm < 1e-6:
            continue
        cosine = float(np.dot(incoming, outgoing) / (incoming_norm * outgoing_norm))
        cosine = float(np.clip(cosine, -1.0, 1.0))
        turns.append(math.degrees(math.acos(cosine)))
    return turns


def _is_nearly_straight(points: list[Point], deviation_ratio: float = 0.02) -> bool:
    if len(points) < 3:
        return True

    vectors = np.array(points, dtype=np.float32)
    start = vectors[0]
    end = vectors[-1]
    baseline = end - start
    baseline_norm = float(np.linalg.norm(baseline))
    if baseline_norm < 1e-6:
        return False

    offsets = vectors - start
    cross = np.abs(offsets[:, 0] * baseline[1] - offsets[:, 1] * baseline[0])
    distances = cross / baseline_norm
    max_deviation = float(np.max(distances))
    tolerance = max(1.0, baseline_norm * deviation_ratio)
    return max_deviation <= tolerance


def _centerline_kind(points: list[Point], export_mode: ExportMode) -> Literal["polyline", "spline"]:
    if export_mode == "polyline":
        return "polyline"
    if export_mode == "spline":
        return "spline"

    if len(points) <= 4 or _is_nearly_straight(points):
        return "polyline"

    turns = _turn_angles(points)
    if not turns:
        return "polyline"

    sharp_turns = sum(1 for turn in turns if turn >= 28.0)
    strong_turns = sum(1 for turn in turns if turn >= 45.0)
    if strong_turns >= max(2, math.ceil(len(turns) * 0.12)):
        return "polyline"

    if sharp_turns >= max(3, math.ceil(len(turns) * 0.22)):
        return "polyline"

    return "spline"


def _catmull_rom_controls(
    points: list[Point],
    index: int,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    vectors = [np.array(point, dtype=np.float32) for point in points]
    p0 = vectors[index - 1] if index > 0 else vectors[index]
    p1 = vectors[index]
    p2 = vectors[index + 1]
    p3 = vectors[index + 2] if index + 2 < len(vectors) else vectors[index + 1]
    control1 = p1 + (p2 - p0) / 6.0
    control2 = p2 - (p3 - p1) / 6.0
    return p0, p1, p2, p3, control1, control2


def _clamp_control_point(control: np.ndarray, anchors: Iterable[np.ndarray]) -> np.ndarray:
    anchor_stack = np.stack(tuple(anchors), axis=0)
    minimum = np.min(anchor_stack, axis=0)
    maximum = np.max(anchor_stack, axis=0)
    return np.clip(control, minimum, maximum)


def _spline_has_overshoot_risk(points: list[Point], tolerance: float = 0.35) -> bool:
    if len(points) < 4:
        return False

    for index in range(len(points) - 1):
        p0, p1, p2, p3, control1, control2 = _catmull_rom_controls(points, index)
        minimum = np.min(np.stack((p0, p1, p2, p3), axis=0), axis=0) - tolerance
        maximum = np.max(np.stack((p0, p1, p2, p3), axis=0), axis=0) + tolerance
        if np.any(control1 < minimum) or np.any(control1 > maximum):
            return True
        if np.any(control2 < minimum) or np.any(control2 > maximum):
            return True
    return False


def _centerline_entities(paths: list[list[Point]], export_mode: ExportMode) -> list[CenterlineEntity]:
    entities: list[CenterlineEntity] = []
    for path in paths:
        if len(path) < 2:
            continue
        kind = _centerline_kind(path, export_mode)
        if export_mode == "hybrid" and kind == "spline" and _spline_has_overshoot_risk(path):
            kind = "polyline"
        entities.append(CenterlineEntity(kind=kind, points=path))
    return entities


def _extract_fill_paths_from_centerlines(
    centerline_paths: list[list[Point]],
    width: int,
    height: int,
    epsilon: float,
) -> list[list[Point]]:
    if not centerline_paths:
        return []

    centerline_mask = np.zeros((height, width), dtype=np.uint8)
    for path in centerline_paths:
        if len(path) < 2:
            continue
        rounded = np.round(np.array(path, dtype=np.float32)).astype(np.int32).reshape(-1, 1, 2)
        cv2.polylines(centerline_mask, [rounded], isClosed=False, color=255, thickness=1, lineType=cv2.LINE_8)

    centerline_mask = cv2.morphologyEx(centerline_mask, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    white_regions = np.where(centerline_mask == 0, 255, 0).astype(np.uint8)

    component_count, labels, stats, _ = cv2.connectedComponentsWithStats(white_regions, connectivity=8)
    fill_mask = np.zeros_like(white_regions)
    min_fill_area = 64

    for label in range(1, component_count):
        x = int(stats[label, cv2.CC_STAT_LEFT])
        y = int(stats[label, cv2.CC_STAT_TOP])
        component_width = int(stats[label, cv2.CC_STAT_WIDTH])
        component_height = int(stats[label, cv2.CC_STAT_HEIGHT])
        area = int(stats[label, cv2.CC_STAT_AREA])
        touches_border = (
            x == 0
            or y == 0
            or x + component_width >= width
            or y + component_height >= height
        )
        if touches_border or area < min_fill_area:
            continue
        fill_mask[labels == label] = 255

    contours, _ = cv2.findContours(fill_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    fill_paths: list[list[Point]] = []

    for contour in contours:
        if cv2.contourArea(contour) < min_fill_area:
            continue
        points = [(float(x), float(y)) for [[x, y]] in contour]
        points = _simplify_closed_path(points, epsilon=max(0.35, epsilon * 0.5))
        if len(points) >= 3:
            fill_paths.append(points)

    fill_paths.sort(key=lambda path: cv2.contourArea(np.array(path, dtype=np.float32)), reverse=True)
    return fill_paths


def _estimate_stroke_radius(foreground: np.ndarray, skeleton: np.ndarray | None = None) -> float:
    foreground_u8 = foreground.astype(np.uint8) * 255
    if not np.any(foreground_u8):
        return 1.0

    distance = cv2.distanceTransform(foreground_u8, cv2.DIST_L2, 5)
    if skeleton is not None and np.any(skeleton):
        radii = distance[skeleton]
    else:
        radii = distance[foreground]

    radii = radii[radii > 0]
    if radii.size == 0:
        return 1.0
    return float(np.median(radii))


def _extract_fill_paths_from_foreground(
    foreground: np.ndarray,
    epsilon: float,
    expansion_radius: int,
) -> list[list[Point]]:
    stroke_mask = foreground.astype(np.uint8) * 255
    sealed = cv2.morphologyEx(stroke_mask, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    white_regions = np.where(sealed == 0, 255, 0).astype(np.uint8)

    component_count, labels, stats, _ = cv2.connectedComponentsWithStats(white_regions, connectivity=8)
    fill_mask = np.zeros_like(white_regions)
    height, width = white_regions.shape
    min_fill_area = 64

    for label in range(1, component_count):
        x = int(stats[label, cv2.CC_STAT_LEFT])
        y = int(stats[label, cv2.CC_STAT_TOP])
        component_width = int(stats[label, cv2.CC_STAT_WIDTH])
        component_height = int(stats[label, cv2.CC_STAT_HEIGHT])
        area = int(stats[label, cv2.CC_STAT_AREA])
        touches_border = (
            x == 0
            or y == 0
            or x + component_width >= width
            or y + component_height >= height
        )
        if touches_border or area < min_fill_area:
            continue
        fill_mask[labels == label] = 255

    if expansion_radius > 0:
        kernel_size = expansion_radius * 2 + 1
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
        fill_mask = cv2.dilate(fill_mask, kernel, iterations=1)

    contours, _ = cv2.findContours(fill_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    fill_paths: list[list[Point]] = []
    for contour in contours:
        if cv2.contourArea(contour) < min_fill_area:
            continue
        points = [(float(x), float(y)) for [[x, y]] in contour]
        points = _simplify_closed_path(points, epsilon=max(0.35, epsilon * 0.5))
        if len(points) >= 3:
            fill_paths.append(points)

    fill_paths.sort(key=lambda path: cv2.contourArea(np.array(path, dtype=np.float32)), reverse=True)
    return fill_paths


def _angle_between(vector_a: np.ndarray, vector_b: np.ndarray) -> float:
    norm_a = float(np.linalg.norm(vector_a))
    norm_b = float(np.linalg.norm(vector_b))
    if norm_a < 1e-6 or norm_b < 1e-6:
        return 180.0
    cosine = float(np.dot(vector_a, vector_b) / (norm_a * norm_b))
    cosine = float(np.clip(cosine, -1.0, 1.0))
    return math.degrees(math.acos(cosine))


def _endpoint_direction(endpoint: Pixel, skeleton: np.ndarray, max_steps: int = 6) -> np.ndarray | None:
    prev: Pixel | None = None
    curr = endpoint
    for _ in range(max_steps):
        neighbors = _neighbors(curr, skeleton)
        if prev is not None:
            neighbors = [candidate for candidate in neighbors if candidate != prev]
        if not neighbors:
            break
        nxt = neighbors[0]
        direction = np.array((nxt[0] - endpoint[0], nxt[1] - endpoint[1]), dtype=np.float32)
        if float(np.linalg.norm(direction)) >= 1.5:
            return direction
        prev, curr = curr, nxt
    return None


def _bridge_endpoint_gaps(
    skeleton: np.ndarray,
    max_gap: float = 10.0,
    max_angle_deg: float = 40.0,
    iterations: int = 2,
    blocked_mask: np.ndarray | None = None,
) -> np.ndarray:
    bridged = skeleton.copy().astype(np.uint8)
    blocked = blocked_mask.astype(bool) if blocked_mask is not None else None

    for _ in range(iterations):
        degree = _degree_map(bridged > 0)
        endpoints = [tuple(pixel) for pixel in np.argwhere((bridged > 0) & (degree == 1))]
        if len(endpoints) < 2:
            break

        directions = {endpoint: _endpoint_direction(endpoint, bridged > 0) for endpoint in endpoints}
        used: set[Pixel] = set()
        connections: list[tuple[Pixel, Pixel]] = []

        for index, start in enumerate(endpoints):
            if start in used:
                continue

            start_dir = directions.get(start)
            if start_dir is None:
                continue

            best_score: float | None = None
            best_candidate: Pixel | None = None

            for end in endpoints[index + 1 :]:
                if end in used:
                    continue

                distance = float(np.hypot(end[0] - start[0], end[1] - start[1]))
                if distance <= 1.5 or distance > max_gap:
                    continue

                if blocked is not None:
                    if blocked[start] or blocked[end]:
                        continue
                    connector_mask = np.zeros_like(bridged, dtype=np.uint8)
                    cv2.line(connector_mask, (start[1], start[0]), (end[1], end[0]), color=1, thickness=1)
                    if np.any(blocked & (connector_mask > 0)):
                        continue

                end_dir = directions.get(end)
                if end_dir is None:
                    continue

                connector = np.array((end[0] - start[0], end[1] - start[1]), dtype=np.float32)
                start_angle = _angle_between(-start_dir, connector)
                end_angle = _angle_between(-end_dir, -connector)
                if start_angle > max_angle_deg or end_angle > max_angle_deg:
                    continue

                score = distance + start_angle * 0.2 + end_angle * 0.2
                if best_score is None or score < best_score:
                    best_score = score
                    best_candidate = end

            if best_candidate is not None:
                connections.append((start, best_candidate))
                used.add(start)
                used.add(best_candidate)

        if not connections:
            break

        for start, end in connections:
            cv2.line(bridged, (start[1], start[0]), (end[1], end[0]), color=1, thickness=1)

    return bridged > 0


def _prune_short_spurs(skeleton: np.ndarray, max_spur_length: int = 3) -> np.ndarray:
    pruned = skeleton.copy()
    for _ in range(2):
        degree = _degree_map(pruned)
        endpoints = [tuple(pixel) for pixel in np.argwhere(pruned & (degree == 1))]
        junction_mask = pruned & (degree >= 3)
        to_remove: set[Pixel] = set()

        for endpoint in endpoints:
            chain: list[Pixel] = [endpoint]
            prev: Pixel | None = None
            curr = endpoint
            while True:
                neighbors = _neighbors(curr, pruned)
                if prev is not None:
                    neighbors = [candidate for candidate in neighbors if candidate != prev]
                if not neighbors:
                    break
                nxt = neighbors[0]
                chain.append(nxt)

                if junction_mask[nxt]:
                    if len(chain) - 1 <= max_spur_length:
                        to_remove.update(chain[:-1])
                    break

                if degree[nxt] != 2:
                    break
                prev, curr = curr, nxt

        if not to_remove:
            break
        for row, col in to_remove:
            pruned[row, col] = False
    return pruned


def _trace_graph_runs(skeleton: np.ndarray) -> tuple[list[list[Pixel]], set[Pixel], set[Pixel]]:
    degree = _degree_map(skeleton)
    endpoint_mask = skeleton & (degree == 1)
    junction_mask = skeleton & (degree >= 3)
    node_mask = endpoint_mask | junction_mask

    endpoints: set[Pixel] = {tuple(pixel) for pixel in np.argwhere(endpoint_mask)}
    junctions: set[Pixel] = {tuple(pixel) for pixel in np.argwhere(junction_mask)}
    nodes: set[Pixel] = endpoints | junctions

    visited_edges: set[tuple[Pixel, Pixel]] = set()
    runs: list[list[Pixel]] = []

    for node in nodes:
        for next_pixel in _neighbors(node, skeleton):
            edge = _edge_key(node, next_pixel)
            if edge in visited_edges:
                continue

            run = [node, next_pixel]
            visited_edges.add(edge)
            prev = node
            curr = next_pixel

            while curr not in nodes:
                candidates = [candidate for candidate in _neighbors(curr, skeleton) if candidate != prev]
                if not candidates:
                    break
                nxt = candidates[0]
                edge = _edge_key(curr, nxt)
                if edge in visited_edges:
                    break
                visited_edges.add(edge)
                run.append(nxt)
                prev, curr = curr, nxt

            if len(run) >= 2:
                runs.append(run)

    for pixel in [tuple(p) for p in np.argwhere(skeleton)]:
        for next_pixel in _neighbors(pixel, skeleton):
            edge = _edge_key(pixel, next_pixel)
            if edge in visited_edges:
                continue

            loop = [pixel, next_pixel]
            visited_edges.add(edge)
            prev = pixel
            curr = next_pixel
            while True:
                candidates = [candidate for candidate in _neighbors(curr, skeleton) if candidate != prev]
                if not candidates:
                    break
                nxt = candidates[0]
                edge = _edge_key(curr, nxt)
                if edge in visited_edges:
                    break
                visited_edges.add(edge)
                loop.append(nxt)
                prev, curr = curr, nxt
                if curr == pixel:
                    break
            if len(loop) >= 3:
                runs.append(loop)

    normalized_runs: list[list[Pixel]] = []
    for run in runs:
        compacted = [run[0]]
        for pixel in run[1:]:
            if pixel != compacted[-1]:
                compacted.append(pixel)
        if len(compacted) >= 2:
            normalized_runs.append(compacted)

    return normalized_runs, endpoints, junctions


def _direction_away(path: list[Pixel], shared: Pixel) -> np.ndarray | None:
    if len(path) < 2:
        return None
    if path[0] == shared:
        anchor = np.array(path[0], dtype=np.float32)
        sample = np.array(path[1], dtype=np.float32)
    elif path[-1] == shared:
        anchor = np.array(path[-1], dtype=np.float32)
        sample = np.array(path[-2], dtype=np.float32)
    else:
        return None

    direction = sample - anchor
    norm = float(np.linalg.norm(direction))
    if norm < 1e-6:
        return None
    return direction / norm


def _merge_collinear_runs(paths: list[list[Pixel]], junctions: set[Pixel], collinear_deg: float = 12.0) -> list[list[Pixel]]:
    if len(paths) < 2:
        return paths

    cos_limit = float(np.cos(np.deg2rad(collinear_deg)))
    working = [path[:] for path in paths]

    changed = True
    while changed:
        changed = False
        endpoint_index: dict[Pixel, list[int]] = {}
        for idx, path in enumerate(working):
            if len(path) < 2:
                continue
            endpoint_index.setdefault(path[0], []).append(idx)
            endpoint_index.setdefault(path[-1], []).append(idx)

        for shared, idxs in endpoint_index.items():
            if shared in junctions or len(idxs) != 2:
                continue

            first_idx, second_idx = idxs
            if first_idx == second_idx:
                continue

            first = working[first_idx]
            second = working[second_idx]
            first_dir = _direction_away(first, shared)
            second_dir = _direction_away(second, shared)
            if first_dir is None or second_dir is None:
                continue

            cosine = float(np.dot(first_dir, second_dir))
            if cosine > -cos_limit:
                continue

            first_oriented = first if first[-1] == shared else list(reversed(first))
            second_oriented = second if second[0] == shared else list(reversed(second))
            merged = first_oriented + second_oriented[1:]

            keep: list[list[Pixel]] = []
            for idx, path in enumerate(working):
                if idx not in {first_idx, second_idx}:
                    keep.append(path)
            keep.append(merged)
            working = keep
            changed = True
            break

    return [path for path in working if len(path) >= 2]


def _merge_through_junctions(
    paths: list[list[Pixel]],
    junctions: set[Pixel],
    min_opposition_deg: float = 150.0,
) -> list[list[Pixel]]:
    if len(paths) < 2 or not junctions:
        return paths

    cosine_limit = float(np.cos(np.deg2rad(min_opposition_deg)))
    working = [path[:] for path in paths]

    changed = True
    while changed:
        changed = False

        for junction in junctions:
            incident: list[tuple[int, np.ndarray]] = []
            for idx, path in enumerate(working):
                if len(path) < 2:
                    continue
                if path[0] != junction and path[-1] != junction:
                    continue
                direction = _direction_away(path, junction)
                if direction is None:
                    continue
                incident.append((idx, direction))

            if len(incident) < 2:
                continue

            best_pair: tuple[int, int] | None = None
            best_score: tuple[float, float] | None = None

            for left_index in range(len(incident) - 1):
                first_idx, first_dir = incident[left_index]
                for right_index in range(left_index + 1, len(incident)):
                    second_idx, second_dir = incident[right_index]
                    cosine = float(np.dot(first_dir, second_dir))
                    if cosine > cosine_limit:
                        continue

                    combined_length = float(len(working[first_idx]) + len(working[second_idx]))
                    score = (cosine, -combined_length)
                    if best_score is None or score < best_score:
                        best_score = score
                        best_pair = (first_idx, second_idx)

            if best_pair is None:
                continue

            first_idx, second_idx = best_pair
            first = working[first_idx]
            second = working[second_idx]

            first_oriented = first if first[-1] == junction else list(reversed(first))
            second_oriented = second if second[0] == junction else list(reversed(second))
            merged = first_oriented + second_oriented[1:]

            keep: list[list[Pixel]] = []
            for idx, path in enumerate(working):
                if idx not in {first_idx, second_idx}:
                    keep.append(path)
            keep.append(merged)
            working = keep
            changed = True
            break

    return [path for path in working if len(path) >= 2]


def _cluster_junction_anchors(junctions: set[Pixel], shape: tuple[int, int]) -> tuple[dict[Pixel, Pixel], set[Pixel]]:
    if not junctions:
        return {}, set()

    mask = np.zeros(shape, dtype=np.uint8)
    for row, col in junctions:
        mask[row, col] = 1

    component_count, labels, _, centroids = cv2.connectedComponentsWithStats(mask, connectivity=8)
    mapping: dict[Pixel, Pixel] = {}
    anchors: set[Pixel] = set()
    for label in range(1, component_count):
        centroid_col, centroid_row = centroids[label]
        anchor = (
            int(np.clip(round(float(centroid_row)), 0, shape[0] - 1)),
            int(np.clip(round(float(centroid_col)), 0, shape[1] - 1)),
        )
        anchors.add(anchor)
        pixels = np.argwhere(labels == label)
        for row, col in pixels:
            mapping[(int(row), int(col))] = anchor
    return mapping, anchors


def _snap_path_terminals_to_junctions(paths: list[list[Pixel]], junction_mapping: dict[Pixel, Pixel]) -> list[list[Pixel]]:
    snapped: list[list[Pixel]] = []
    for path in paths:
        if len(path) < 2:
            continue
        updated = path[:]
        updated[0] = junction_mapping.get(updated[0], updated[0])
        updated[-1] = junction_mapping.get(updated[-1], updated[-1])
        compacted = [updated[0]]
        for pixel in updated[1:]:
            if pixel != compacted[-1]:
                compacted.append(pixel)
        if len(compacted) >= 2:
            snapped.append(compacted)
    return snapped


def _remove_tiny_intra_junction_runs(paths: list[list[Pixel]], junction_anchors: set[Pixel], max_pixels: int = 3) -> list[list[Pixel]]:
    filtered: list[list[Pixel]] = []
    for path in paths:
        if len(path) < 2:
            continue
        start, end = path[0], path[-1]
        if start in junction_anchors and end in junction_anchors and len(path) <= max_pixels:
            continue
        filtered.append(path)
    return filtered


def _remove_tiny_connector_runs(paths: list[list[Pixel]], max_pixels: int = 3, max_span: float = 2.2) -> list[list[Pixel]]:
    endpoint_counts: dict[Pixel, int] = {}
    for path in paths:
        if len(path) < 2:
            continue
        endpoint_counts[path[0]] = endpoint_counts.get(path[0], 0) + 1
        endpoint_counts[path[-1]] = endpoint_counts.get(path[-1], 0) + 1

    filtered: list[list[Pixel]] = []
    for path in paths:
        if len(path) < 2:
            continue
        start = path[0]
        end = path[-1]
        span = float(np.hypot(end[0] - start[0], end[1] - start[1]))
        if len(path) <= max_pixels and span <= max_span and endpoint_counts.get(start, 0) >= 2 and endpoint_counts.get(end, 0) >= 2:
            continue
        filtered.append(path)
    return filtered


def _infer_terminal_graph_stats(paths: list[list[Pixel]], junction_radius: float = 3.0) -> tuple[int, int]:
    terminals: list[Pixel] = []
    for path in paths:
        if len(path) < 2:
            continue
        terminals.append(path[0])
        terminals.append(path[-1])

    if not terminals:
        return 0, 0

    radius_sq = junction_radius * junction_radius
    clusters: list[list[Pixel]] = []
    for terminal in terminals:
        assigned = False
        for cluster in clusters:
            anchor_row = sum(pixel[0] for pixel in cluster) / len(cluster)
            anchor_col = sum(pixel[1] for pixel in cluster) / len(cluster)
            distance_sq = (terminal[0] - anchor_row) ** 2 + (terminal[1] - anchor_col) ** 2
            if distance_sq <= radius_sq:
                cluster.append(terminal)
                assigned = True
                break
        if not assigned:
            clusters.append([terminal])

    endpoint_count = sum(1 for cluster in clusters if len(cluster) == 1)
    junction_count = sum(1 for cluster in clusters if len(cluster) >= 3)
    return endpoint_count, junction_count


def _build_svg(
    centerline_entities: Iterable[CenterlineEntity],
    fill_paths: Iterable[list[Point]],
    width: int,
    height: int,
) -> str:
    path_tags: list[str] = []
    for path in fill_paths:
        if len(path) < 3:
            continue
        path_tags.append(
            f'<polygon points="{_points_attr(path)}" fill="#ffffff" stroke="none" '
            'stroke-linecap="round" stroke-linejoin="round" />'
        )

    for entity in centerline_entities:
        if len(entity.points) < 2:
            continue
        if entity.kind == "polyline":
            path_tags.append(
                f'<polyline points="{_points_attr(entity.points)}" fill="none" stroke="#d10000" stroke-width="1" '
                'stroke-linecap="round" stroke-linejoin="round" />'
            )
        else:
            svg_path = _build_open_svg_path_data(entity.points)
            path_tags.append(
                f'<path d="{svg_path}" fill="none" stroke="#d10000" stroke-width="1" '
                'stroke-linecap="round" stroke-linejoin="round" />'
            )

    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
        f'viewBox="0 0 {width} {height}">'
        + "".join(path_tags)
        + "</svg>"
    )


def _build_open_svg_path_data(points: list[Point]) -> str:
    if len(points) < 2:
        raise ValueError("Need at least two points to build a spline path")

    if len(points) == 2:
        start_x, start_y = points[0]
        end_x, end_y = points[1]
        return f"M {start_x:.2f} {start_y:.2f} L {end_x:.2f} {end_y:.2f}"

    vectors = [np.array(point, dtype=np.float32) for point in points]
    segments = [f"M {vectors[0][0]:.2f} {vectors[0][1]:.2f}"]

    for index in range(len(vectors) - 1):
        p0, p1, p2, p3, control1, control2 = _catmull_rom_controls(points, index)
        control1 = _clamp_control_point(control1, (p0, p1, p2))
        control2 = _clamp_control_point(control2, (p1, p2, p3))
        segments.append(
            "C "
            f"{control1[0]:.2f} {control1[1]:.2f}, "
            f"{control2[0]:.2f} {control2[1]:.2f}, "
            f"{p2[0]:.2f} {p2[1]:.2f}"
        )

    return " ".join(segments)

def _build_dxf(centerline_entities: Iterable[CenterlineEntity], fill_paths: Iterable[list[Point]], height: int) -> str:
    doc = ezdxf.new("R2010")
    modelspace = doc.modelspace()
    _ensure_dxf_layers(doc)

    for path in fill_paths:
        if len(path) < 3:
            continue
        transformed_2d = [(x, float(height) - y) for x, y in path]

        hatch = modelspace.add_hatch(color=7, dxfattribs={"layer": "FILL"})
        hatch.set_solid_fill(color=7)
        hatch.rgb = (255, 255, 255)
        hatch.paths.add_polyline_path(transformed_2d, is_closed=True)

    for entity in centerline_entities:
        if len(entity.points) < 2:
            continue
        transformed = [(x, float(height) - y) for x, y in entity.points]
        if entity.kind == "polyline":
            modelspace.add_lwpolyline(transformed, format="xy", dxfattribs={"layer": "CENTERLINES", "color": 1})
        else:
            degree = max(1, min(3, len(transformed) - 1))
            modelspace.add_spline(transformed, degree=degree, dxfattribs={"layer": "CENTERLINES", "color": 1})

    output = io.StringIO()
    doc.write(output)
    return output.getvalue()


def _ensure_dxf_layers(doc: ezdxf.EzDxf) -> None:
    layer_specs = [
        ("FILL", {"color": 7}),
        ("CENTERLINES", {"color": 1}),
    ]
    for name, attrs in layer_specs:
        if name not in doc.layers:
            doc.layers.add(name, dxfattribs=attrs)


def vectorize_from_array(
    gray: np.ndarray,
    simplify_epsilon: float = 0.8,
    smooth_iterations: int = 1,
    export_mode: ExportMode = "hybrid",
) -> VectorizationResult:
    if gray.ndim != 2:
        raise ValueError("Input must be grayscale")

    height, width = gray.shape
    if WORK_SCALE != 1.0:
        working_gray = cv2.resize(gray, dsize=None, fx=WORK_SCALE, fy=WORK_SCALE, interpolation=cv2.INTER_CUBIC)
    else:
        working_gray = gray

    foreground, _detail_protection_mask, bridge_block_mask = preprocess_binarize(working_gray)
    skeleton = skeletonize_foreground(foreground)
    skeleton = _prune_short_spurs(skeleton, max_spur_length=3)
    skeleton = _bridge_endpoint_gaps(
        skeleton,
        max_gap=10.0 * WORK_SCALE,
        max_angle_deg=40.0,
        iterations=2,
        blocked_mask=bridge_block_mask,
    )
    skeleton = _prune_short_spurs(skeleton, max_spur_length=2)
    estimated_stroke_radius = _estimate_stroke_radius(foreground, skeleton=skeleton)

    pixel_paths, _endpoints_raw, junctions = _trace_graph_runs(skeleton)
    edge_run_count = len(pixel_paths)
    junction_mapping, junction_anchors = _cluster_junction_anchors(junctions, skeleton.shape)
    pixel_paths = _snap_path_terminals_to_junctions(pixel_paths, junction_mapping)
    pixel_paths = _remove_tiny_intra_junction_runs(pixel_paths, junction_anchors)
    pixel_paths = _remove_tiny_connector_runs(pixel_paths)
    pixel_paths = _merge_through_junctions(pixel_paths, junctions=junction_anchors)
    merge_blockers = junction_anchors if junction_anchors else junctions
    pixel_paths = _merge_collinear_runs(pixel_paths, junctions=merge_blockers)

    endpoint_count, junction_count = _infer_terminal_graph_stats(pixel_paths, junction_radius=3.0)

    vector_paths: list[list[Point]] = []
    for pixel_path in pixel_paths:
        points = _pixel_path_to_points(pixel_path)
        points = _resample_path(points, spacing=1.0)
        points = _smooth_path(points, iterations=max(1, smooth_iterations))
        points = _simplify_path(points, epsilon=simplify_epsilon)
        points = _collapse_nearly_straight_path(points)
        if len(points) >= 2:
            vector_paths.append(points)

    vector_paths = _rescale_paths(vector_paths, scale=WORK_SCALE)

    fill_paths = _extract_fill_paths_from_centerlines(
        vector_paths,
        width=width,
        height=height,
        epsilon=simplify_epsilon,
    )
    if not fill_paths:
        fill_paths = _extract_fill_paths_from_foreground(
            foreground,
            epsilon=simplify_epsilon,
            expansion_radius=max(1, int(round(estimated_stroke_radius))),
        )
        fill_paths = _rescale_paths(fill_paths, scale=WORK_SCALE)
    centerline_entities = _centerline_entities(vector_paths, export_mode=export_mode)
    spline_count = sum(1 for entity in centerline_entities if entity.kind == "spline")
    polyline_count = sum(1 for entity in centerline_entities if entity.kind == "polyline")

    svg_text = _build_svg(centerline_entities, fill_paths=fill_paths, width=width, height=height)
    dxf_text = _build_dxf(centerline_entities, fill_paths=fill_paths, height=height)

    return VectorizationResult(
        width=width,
        height=height,
        paths_px=vector_paths,
        fill_paths_px=fill_paths,
        centerline_entities=centerline_entities,
        dxf_text=dxf_text,
        svg_text=svg_text,
        graph_stats={
            "endpoint_count": endpoint_count,
            "junction_count": junction_count,
            "edge_run_count": edge_run_count,
            "merged_path_count": len(vector_paths),
            "spline_count": spline_count,
            "polyline_count": polyline_count,
        },
    )


def vectorize_from_image_bytes(
    image_bytes: bytes,
    simplify_epsilon: float = 0.8,
    smooth_iterations: int = 1,
    export_mode: ExportMode = "hybrid",
) -> VectorizationResult:
    gray = _decode_grayscale(image_bytes)
    return vectorize_from_array(
        gray,
        simplify_epsilon=simplify_epsilon,
        smooth_iterations=smooth_iterations,
        export_mode=export_mode,
    )
