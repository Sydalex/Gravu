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
CENTERLINE_RGB = (0, 0, 0)
CENTERLINE_SVG_STROKE = "#000000"


@dataclass
class CenterlineEntity:
    kind: Literal["line", "arc", "polyline", "spline", "ellipse"]
    points: list[Point]
    center: Point | None = None
    major_axis: Point | None = None
    ratio: float | None = None
    radius: float | None = None
    start_angle_deg: float | None = None
    end_angle_deg: float | None = None
    start_param: float | None = None
    end_param: float | None = None
    rotation_deg: float = 0.0


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


def preprocess_binarize(
    gray: np.ndarray,
    preserve_detail: bool = False,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
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

    if preserve_detail:
        preserved = _fill_narrow_enclosed_stroke_cavities(conservative)
        return preserved, detail_protection_mask, bridge_block_mask

    normalized = _normalize_stroke_width(conservative)
    normalized_u8 = normalized.astype(np.uint8) * 255
    normalized_u8 = cv2.morphologyEx(normalized_u8, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    aggressive = normalized_u8 > 0

    blended = aggressive.copy()
    blended[detail_protection_mask] = conservative[detail_protection_mask]
    blended = _fill_narrow_enclosed_stroke_cavities(blended)
    closed = cv2.morphologyEx(
        blended.astype(np.uint8) * 255,
        cv2.MORPH_CLOSE,
        np.ones((3, 3), np.uint8),
    ) > 0
    closed[detail_protection_mask] = conservative[detail_protection_mask]
    return closed, detail_protection_mask, bridge_block_mask


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


def _fill_narrow_enclosed_stroke_cavities(
    foreground: np.ndarray,
    max_minor_axis: int = 16,
    max_area: int = 2400,
) -> np.ndarray:
    """Collapse hollow stroked-outline cavities into solid strokes.

    This targets narrow enclosed white regions created by outlined feather/line
    shapes while leaving large intended interiors, such as a body cavity or a
    large framed opening, untouched.
    """

    if not np.any(foreground):
        return foreground

    background_u8 = np.where(foreground, 0, 255).astype(np.uint8)
    component_count, labels, stats, _ = cv2.connectedComponentsWithStats(background_u8, connectivity=8)
    filled = foreground.copy()

    for label in range(1, component_count):
        x = int(stats[label, cv2.CC_STAT_LEFT])
        y = int(stats[label, cv2.CC_STAT_TOP])
        component_width = int(stats[label, cv2.CC_STAT_WIDTH])
        component_height = int(stats[label, cv2.CC_STAT_HEIGHT])
        area = int(stats[label, cv2.CC_STAT_AREA])

        touches_border = (
            x == 0
            or y == 0
            or x + component_width >= foreground.shape[1]
            or y + component_height >= foreground.shape[0]
        )
        if touches_border:
            continue

        if min(component_width, component_height) > max_minor_axis:
            continue

        if area > max_area:
            continue

        filled[labels == label] = True

    return filled


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


def _prune_nearly_collinear_vertices(
    points: list[Point],
    max_distance: float,
    max_angle_deg: float = 12.0,
    iterations: int = 2,
) -> list[Point]:
    if len(points) < 3:
        return points

    current = points
    for _ in range(iterations):
        if len(current) < 3:
            break

        locked = _corner_indices(current, angle_threshold_deg=26.0)
        reduced: list[Point] = [current[0]]
        changed = False

        for index in range(1, len(current) - 1):
            if index in locked:
                reduced.append(current[index])
                continue

            prev = np.array(reduced[-1], dtype=np.float32)
            curr = np.array(current[index], dtype=np.float32)
            nxt = np.array(current[index + 1], dtype=np.float32)

            baseline = nxt - prev
            baseline_norm = float(np.linalg.norm(baseline))
            if baseline_norm < 1e-6:
                reduced.append(current[index])
                continue

            incoming = curr - prev
            outgoing = nxt - curr
            incoming_norm = float(np.linalg.norm(incoming))
            outgoing_norm = float(np.linalg.norm(outgoing))
            if incoming_norm < 1e-6 or outgoing_norm < 1e-6:
                changed = True
                continue

            cross = abs(float(incoming[0] * baseline[1] - incoming[1] * baseline[0]))
            distance = cross / baseline_norm
            cosine = float(np.dot(incoming, outgoing) / (incoming_norm * outgoing_norm))
            cosine = float(np.clip(cosine, -1.0, 1.0))
            angle = math.degrees(math.acos(cosine))

            span_scale = 1.35 if baseline_norm >= 12.0 else 1.0
            effective_distance = max_distance * span_scale
            effective_angle = max_angle_deg + (3.0 if baseline_norm >= 12.0 else 0.0)

            if distance <= effective_distance and angle <= effective_angle:
                changed = True
                continue

            reduced.append(current[index])

        reduced.append(current[-1])
        current = reduced
        if not changed:
            break

    return current


def _reduce_path_for_cad(points: list[Point], epsilon: float) -> list[Point]:
    if len(points) < 3:
        return points

    effective_epsilon = epsilon
    if len(points) >= 24:
        effective_epsilon *= 1.5
    elif len(points) >= 12:
        effective_epsilon *= 1.3

    reduced = _simplify_path(points, epsilon=effective_epsilon)
    reduced = _prune_nearly_collinear_vertices(
        reduced,
        max_distance=max(0.7, effective_epsilon * 1.05),
        max_angle_deg=12.0,
        iterations=2,
    )
    reduced = _collapse_nearly_straight_path(reduced)
    return reduced


def _path_length(points: list[Point]) -> float:
    if len(points) < 2:
        return 0.0
    return float(
        sum(
            math.hypot(end[0] - start[0], end[1] - start[1])
            for start, end in zip(points, points[1:])
        )
    )


def _path_span(points: list[Point]) -> float:
    if not points:
        return 0.0
    xs = [point[0] for point in points]
    ys = [point[1] for point in points]
    return float(math.hypot(max(xs) - min(xs), max(ys) - min(ys)))


def _cleanup_micro_feature_path(points: list[Point]) -> list[Point] | None:
    if len(points) < 2:
        return None

    point_count = len(points)
    length = _path_length(points)
    span = _path_span(points)
    straight_ratio = span / max(length, 1e-6)
    turns = _turn_angles(points)
    sharp_turns = sum(1 for turn in turns if turn >= 30.0)
    strong_turns = sum(1 for turn in turns if turn >= 50.0)

    if length <= 3.0 or span <= 2.5:
        return None

    if point_count == 2:
        if length <= 14.0:
            return None
        return points

    if point_count == 3 and length <= 18.0 and span <= 14.0:
        if sharp_turns >= 1 or straight_ratio <= 0.82:
            return None
        return [points[0], points[-1]]

    if point_count <= 3 and length <= 6.5:
        return None

    if length <= 10.0 and span <= 8.0 and (sharp_turns >= 1 or point_count >= 4):
        return None

    if length <= 18.0 and span <= 14.0:
        if straight_ratio >= 0.72:
            return [points[0], points[-1]]
        if strong_turns >= 1 or sharp_turns >= 2 or point_count >= 5:
            return None

    if length <= 26.0 and span <= 18.0 and point_count >= 5:
        if straight_ratio >= 0.78:
            return [points[0], points[-1]]
        if strong_turns >= 2 or sharp_turns >= 3:
            return None

    return points


def _path_signature(points: list[Point]) -> tuple[tuple[float, float], ...]:
    rounded = tuple((round(x, 1), round(y, 1)) for x, y in points)
    reversed_rounded = tuple(reversed(rounded))
    return min(rounded, reversed_rounded)


def _dedupe_near_duplicate_paths(paths: list[list[Point]]) -> list[list[Point]]:
    deduped: list[list[Point]] = []
    seen: set[tuple[tuple[float, float], ...]] = set()
    for path in paths:
        key = _path_signature(path)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(path)
    return deduped


def _cleanup_micro_feature_paths(paths: list[list[Point]]) -> list[list[Point]]:
    cleaned: list[list[Point]] = []
    for path in paths:
        updated = _cleanup_micro_feature_path(path)
        if updated is None or len(updated) < 2:
            continue
        cleaned.append(updated)
    return _dedupe_near_duplicate_paths(cleaned)


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


def _normalize_closed_path(points: list[Point]) -> list[Point]:
    if len(points) >= 2:
        start = np.array(points[0], dtype=np.float32)
        end = np.array(points[-1], dtype=np.float32)
        if float(np.linalg.norm(end - start)) < 1e-6:
            return points[:-1]
    return points


def _smooth_closed_path(points: list[Point], iterations: int = 1) -> list[Point]:
    current = _normalize_closed_path(points)
    if len(current) < 4 or iterations <= 0:
        return current

    for _ in range(iterations):
        if len(current) < 4:
            break
        vectors = np.array(current, dtype=np.float32)
        smoothed = (
            np.roll(vectors, 1, axis=0)
            + 2.0 * vectors
            + np.roll(vectors, -1, axis=0)
        ) / 4.0
        current = [(float(x), float(y)) for x, y in smoothed]

    return current


def _prepare_fill_path(points: list[Point], epsilon: float) -> list[Point]:
    prepared = _simplify_closed_path(points, epsilon=max(0.55, epsilon * 0.85))
    prepared = _smooth_closed_path(prepared, iterations=1)
    if len(prepared) < 3:
        return points
    return prepared


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

    if len(points) <= 3 or _is_nearly_straight(points):
        return "polyline"

    turns = _turn_angles(points)
    if not turns:
        return "polyline"

    sharp_turns = sum(1 for turn in turns if turn >= 30.0)
    strong_turns = sum(1 for turn in turns if turn >= 50.0)
    if strong_turns >= max(3, math.ceil(len(turns) * 0.18)):
        return "polyline"

    if sharp_turns >= max(5, math.ceil(len(turns) * 0.3)):
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


def _fit_straight_line(points: list[Point]) -> list[Point] | None:
    if len(points) < 2:
        return None

    if len(points) == 2:
        return points

    span = _path_span(points)
    length = _path_length(points)
    straightness_threshold = 0.94 if span >= 55.0 else 0.965
    if span < 10.0 or length <= 0.0 or span / length < straightness_threshold:
        return None

    samples = np.array(points, dtype=np.float32).reshape(-1, 1, 2)
    fit = cv2.fitLine(samples, cv2.DIST_L2, 0, 0.01, 0.01)
    vx, vy, x0, y0 = fit.flatten()
    direction = np.array((float(vx), float(vy)), dtype=np.float32)
    origin = np.array((float(x0), float(y0)), dtype=np.float32)
    norm = float(np.linalg.norm(direction))
    if norm < 1e-6:
        return None
    direction /= norm

    vectors = np.array(points, dtype=np.float32)
    offsets = vectors - origin
    parameters = np.dot(offsets, direction)
    projected = origin + np.outer(parameters, direction)
    deviations = np.linalg.norm(vectors - projected, axis=1)
    max_deviation = float(np.max(deviations))
    mean_deviation = float(np.mean(deviations))
    if span >= 55.0:
        max_tolerance = max(1.8, span * 0.018)
        mean_tolerance = max(0.75, span * 0.006)
    else:
        max_tolerance = max(1.25, span * 0.012)
        mean_tolerance = max(0.55, span * 0.004)
    if max_deviation > max_tolerance or mean_deviation > mean_tolerance:
        return None

    start = origin + direction * float(parameters[0])
    end = origin + direction * float(parameters[-1])
    endpoint_tolerance = max(2.25, span * 0.01) if span >= 55.0 else max(1.5, span * 0.006)
    if (
        float(np.linalg.norm(start - vectors[0])) > endpoint_tolerance
        or float(np.linalg.norm(end - vectors[-1])) > endpoint_tolerance
    ):
        return None

    source_direction = np.array(points[-1], dtype=np.float32) - np.array(points[0], dtype=np.float32)
    if float(np.dot(source_direction, end - start)) < 0:
        start, end = end, start

    return [(float(start[0]), float(start[1])), (float(end[0]), float(end[1]))]


def _ellipse_angle_coverage(
    points: list[Point],
    center: Point,
    major_axis: Point,
    ratio: float,
) -> float:
    angles = _ellipse_local_parameters(points, center=center, major_axis=major_axis, ratio=ratio)
    if len(angles) < 2:
        return 0.0

    sorted_angles = sorted((value + math.tau) % math.tau for value in angles)
    gaps = [
        sorted_angles[index + 1] - sorted_angles[index]
        for index in range(len(sorted_angles) - 1)
    ]
    gaps.append((sorted_angles[0] + math.tau) - sorted_angles[-1])
    return float(math.tau - max(gaps))


def _ellipse_local_parameters(
    points: list[Point],
    center: Point,
    major_axis: Point,
    ratio: float,
) -> list[float]:
    cx, cy = center
    major_x, major_y = major_axis
    major_radius = float(math.hypot(major_x, major_y))
    minor_radius = major_radius * ratio
    if major_radius <= 0.0 or minor_radius <= 0.0:
        return []

    angle = math.atan2(major_y, major_x)
    cos_a = math.cos(-angle)
    sin_a = math.sin(-angle)
    angles: list[float] = []
    for x, y in points:
        dx = x - cx
        dy = y - cy
        local_x = dx * cos_a - dy * sin_a
        local_y = dx * sin_a + dy * cos_a
        angles.append(math.atan2(local_y / minor_radius, local_x / major_radius))
    return angles


def _ellipse_fit_error(points: list[Point], center: Point, major_axis: Point, ratio: float) -> tuple[float, float]:
    cx, cy = center
    major_x, major_y = major_axis
    major_radius = float(math.hypot(major_x, major_y))
    minor_radius = major_radius * ratio
    if major_radius <= 0.0 or minor_radius <= 0.0:
        return float("inf"), float("inf")

    angle = math.atan2(major_y, major_x)
    cos_a = math.cos(-angle)
    sin_a = math.sin(-angle)
    errors: list[float] = []
    for x, y in points:
        dx = x - cx
        dy = y - cy
        local_x = dx * cos_a - dy * sin_a
        local_y = dx * sin_a + dy * cos_a
        radius = math.hypot(local_x / major_radius, local_y / minor_radius)
        errors.append(abs(radius - 1.0))
    return float(np.mean(errors)), float(np.max(errors))


def _ellipse_radius_value(point: Point, center: Point, major_axis: Point, ratio: float) -> float:
    cx, cy = center
    major_x, major_y = major_axis
    major_radius = float(math.hypot(major_x, major_y))
    minor_radius = major_radius * ratio
    if major_radius <= 0.0 or minor_radius <= 0.0:
        return float("inf")

    angle = math.atan2(major_y, major_x)
    cos_a = math.cos(-angle)
    sin_a = math.sin(-angle)
    dx = point[0] - cx
    dy = point[1] - cy
    local_x = dx * cos_a - dy * sin_a
    local_y = dx * sin_a + dy * cos_a
    return math.hypot(local_x / major_radius, local_y / minor_radius)


def _fit_ellipse_entity(
    points: list[Point],
    *,
    require_closed: bool,
) -> CenterlineEntity | None:
    fit_points = _normalize_closed_path(points)
    if len(fit_points) < 8:
        return None

    xs = [point[0] for point in fit_points]
    ys = [point[1] for point in fit_points]
    width = max(xs) - min(xs)
    height = max(ys) - min(ys)
    if width < 12.0 or height < 12.0:
        return None

    closure_distance = float(np.linalg.norm(np.array(points[0], dtype=np.float32) - np.array(points[-1], dtype=np.float32)))
    if require_closed and closure_distance > max(5.0, min(width, height) * 0.18):
        return None
    if not require_closed and closure_distance > max(18.0, min(width, height) * 0.55):
        return None

    contour = np.array(fit_points, dtype=np.float32).reshape(-1, 1, 2)
    (cx, cy), (axis_a, axis_b), angle_deg = cv2.fitEllipse(contour)
    if axis_a <= 0.0 or axis_b <= 0.0:
        return None

    if axis_a >= axis_b:
        major_diameter = float(axis_a)
        minor_diameter = float(axis_b)
        major_angle_deg = float(angle_deg)
    else:
        major_diameter = float(axis_b)
        minor_diameter = float(axis_a)
        major_angle_deg = float(angle_deg) + 90.0

    major_radius = major_diameter / 2.0
    minor_radius = minor_diameter / 2.0
    ratio = minor_radius / major_radius
    if major_radius < 6.0 or minor_radius < 4.0 or ratio < 0.16:
        return None

    theta = math.radians(major_angle_deg)
    major_axis = (math.cos(theta) * major_radius, math.sin(theta) * major_radius)
    mean_error, max_error = _ellipse_fit_error(
        fit_points,
        center=(float(cx), float(cy)),
        major_axis=major_axis,
        ratio=ratio,
    )
    mean_limit = 0.08 if require_closed else 0.1
    max_limit = 0.24 if require_closed else 0.3
    if mean_error > mean_limit or max_error > max_limit:
        return None

    if require_closed:
        contour_area = abs(float(cv2.contourArea(contour)))
        ellipse_area = math.pi * major_radius * minor_radius
        area_ratio = contour_area / max(ellipse_area, 1e-6)
        if area_ratio < 0.9 or area_ratio > 1.12:
            return None
    else:
        turns = _turn_angles(fit_points)
        sharp_turns = sum(1 for turn in turns if turn >= 24.0)
        strong_turns = sum(1 for turn in turns if turn >= 38.0)
        if strong_turns >= 1 or sharp_turns >= max(3, math.ceil(len(turns) * 0.12)):
            return None

        coverage = _ellipse_angle_coverage(
            fit_points,
            center=(float(cx), float(cy)),
            major_axis=major_axis,
            ratio=ratio,
        )
        if coverage < math.radians(245.0):
            return None

    return CenterlineEntity(
        kind="ellipse",
        points=fit_points,
        center=(float(cx), float(cy)),
        major_axis=(float(major_axis[0]), float(major_axis[1])),
        ratio=float(ratio),
        rotation_deg=float(major_angle_deg),
    )


def _fit_closed_ellipse_entity(points: list[Point]) -> CenterlineEntity | None:
    return _fit_ellipse_entity(points, require_closed=True)


def _fit_near_closed_ellipse_entity(points: list[Point]) -> CenterlineEntity | None:
    return _fit_ellipse_entity(points, require_closed=False)


def _fit_open_ellipse_arc_entity(points: list[Point]) -> CenterlineEntity | None:
    if len(points) < 7:
        return None

    span = _path_span(points)
    length = _path_length(points)
    chord = float(np.linalg.norm(np.array(points[-1], dtype=np.float32) - np.array(points[0], dtype=np.float32)))
    if span < 20.0 or length < 32.0 or chord < 8.0:
        return None

    turns = _turn_angles(points)
    if any(turn >= 55.0 for turn in turns):
        return None

    contour = np.array(points, dtype=np.float32).reshape(-1, 1, 2)
    try:
        (cx, cy), (axis_a, axis_b), angle_deg = cv2.fitEllipse(contour)
    except cv2.error:
        return None

    if axis_a <= 0.0 or axis_b <= 0.0:
        return None

    if axis_a >= axis_b:
        major_diameter = float(axis_a)
        minor_diameter = float(axis_b)
        major_angle_deg = float(angle_deg)
    else:
        major_diameter = float(axis_b)
        minor_diameter = float(axis_a)
        major_angle_deg = float(angle_deg) + 90.0

    major_radius = major_diameter / 2.0
    minor_radius = minor_diameter / 2.0
    ratio = minor_radius / major_radius
    if major_radius < 12.0 or minor_radius < 5.0 or ratio < 0.16:
        return None
    if major_radius > span * 1.25:
        return None

    theta = math.radians(major_angle_deg)
    major_axis = (math.cos(theta) * major_radius, math.sin(theta) * major_radius)
    mean_error, max_error = _ellipse_fit_error(
        points,
        center=(float(cx), float(cy)),
        major_axis=major_axis,
        ratio=ratio,
    )
    if mean_error > 0.08 or max_error > 0.22:
        return None

    parameters = np.unwrap(
        np.array(
            _ellipse_local_parameters(
                points,
                center=(float(cx), float(cy)),
                major_axis=major_axis,
                ratio=ratio,
            ),
            dtype=np.float64,
        )
    )
    if len(parameters) < 2:
        return None

    delta = float(parameters[-1] - parameters[0])
    total_angle = abs(delta)
    if total_angle < math.radians(22.0) or total_angle > math.radians(155.0):
        return None

    direction = 1.0 if delta >= 0.0 else -1.0
    steps = np.diff(parameters)
    backwards = float(np.sum(np.abs(steps[steps * direction < -1e-3])))
    if backwards > total_angle * 0.2:
        return None

    return CenterlineEntity(
        kind="ellipse",
        points=[points[0], points[-1]],
        center=(float(cx), float(cy)),
        major_axis=(float(major_axis[0]), float(major_axis[1])),
        ratio=float(ratio),
        start_param=float(parameters[0]),
        end_param=float(parameters[-1]),
        rotation_deg=float(major_angle_deg),
    )


def _split_path_at_corners(
    points: list[Point],
    angle_threshold_deg: float = 24.0,
    min_segment_length: float = 12.0,
) -> list[list[Point]]:
    if len(points) < 5:
        return [points]

    split_indices = [0]
    for index in range(1, len(points) - 1):
        incoming = np.array(points[index], dtype=np.float32) - np.array(points[index - 1], dtype=np.float32)
        outgoing = np.array(points[index + 1], dtype=np.float32) - np.array(points[index], dtype=np.float32)
        incoming_norm = float(np.linalg.norm(incoming))
        outgoing_norm = float(np.linalg.norm(outgoing))
        if incoming_norm < 1e-6 or outgoing_norm < 1e-6:
            continue

        cosine = float(np.dot(incoming, outgoing) / (incoming_norm * outgoing_norm))
        angle = math.degrees(math.acos(float(np.clip(cosine, -1.0, 1.0))))
        if angle < angle_threshold_deg:
            continue

        before_length = _path_length(points[split_indices[-1] : index + 1])
        after_length = _path_length(points[index:])
        if before_length >= min_segment_length and after_length >= min_segment_length:
            split_indices.append(index)

    split_indices.append(len(points) - 1)
    segments: list[list[Point]] = []
    for start, end in zip(split_indices, split_indices[1:]):
        segment = points[start : end + 1]
        if len(segment) >= 2:
            segments.append(segment)

    return segments or [points]


def _fit_circular_arc_entity(points: list[Point]) -> CenterlineEntity | None:
    if len(points) < 4:
        return None

    vectors = np.array(points, dtype=np.float64)
    span = _path_span(points)
    length = _path_length(points)
    chord = float(np.linalg.norm(vectors[-1] - vectors[0]))
    if span < 10.0 or length < 14.0 or chord < 6.0:
        return None

    chord_ratio = chord / max(length, 1e-6)
    if chord_ratio > 0.985 or chord_ratio < 0.25:
        return None

    x = vectors[:, 0]
    y = vectors[:, 1]
    design = np.column_stack((2.0 * x, 2.0 * y, np.ones(len(vectors))))
    target = x * x + y * y
    try:
        center_x, center_y, constant = np.linalg.lstsq(design, target, rcond=None)[0]
    except np.linalg.LinAlgError:
        return None

    radius_sq = float(center_x * center_x + center_y * center_y + constant)
    if radius_sq <= 0.0:
        return None
    radius = math.sqrt(radius_sq)
    if radius < max(6.0, span * 0.35) or radius > span * 8.0:
        return None

    distances = np.hypot(x - center_x, y - center_y)
    radial_errors = np.abs(distances - radius)
    mean_error = float(np.mean(radial_errors))
    max_error = float(np.max(radial_errors))
    if mean_error > max(0.8, radius * 0.018) or max_error > max(2.2, radius * 0.06):
        return None

    angles = np.unwrap(np.arctan2(y - center_y, x - center_x))
    delta = float(angles[-1] - angles[0])
    total_angle = abs(delta)
    if total_angle < math.radians(16.0) or total_angle > math.radians(210.0):
        return None

    angle_steps = np.diff(angles)
    direction = 1.0 if delta >= 0.0 else -1.0
    backwards = float(np.sum(np.abs(angle_steps[angle_steps * direction < -1e-3])))
    if backwards > total_angle * 0.18:
        return None

    arc_length = radius * total_angle
    if abs(arc_length - length) / max(length, 1e-6) > 0.28:
        return None

    return CenterlineEntity(
        kind="arc",
        points=[points[0], points[-1]],
        center=(float(center_x), float(center_y)),
        radius=float(radius),
        start_angle_deg=float(math.degrees(angles[0])),
        end_angle_deg=float(math.degrees(angles[-1])),
    )


def _sample_entity_points(entity: CenterlineEntity, sample_count: int = 18) -> list[Point]:
    if entity.kind == "arc":
        if entity.center is None or entity.radius is None or entity.start_angle_deg is None or entity.end_angle_deg is None:
            return entity.points
        start = math.radians(entity.start_angle_deg)
        end = math.radians(entity.end_angle_deg)
        angles = np.linspace(start, end, max(2, sample_count))
        return [
            (
                float(entity.center[0] + math.cos(angle) * entity.radius),
                float(entity.center[1] + math.sin(angle) * entity.radius),
            )
            for angle in angles
        ]

    if entity.kind == "ellipse":
        if entity.center is None or entity.major_axis is None or entity.ratio is None:
            return entity.points
        major_radius = float(math.hypot(entity.major_axis[0], entity.major_axis[1]))
        minor_radius = major_radius * entity.ratio
        if major_radius <= 0.0 or minor_radius <= 0.0:
            return entity.points
        rotation = math.atan2(entity.major_axis[1], entity.major_axis[0])
        start = entity.start_param if entity.start_param is not None else 0.0
        end = entity.end_param if entity.end_param is not None else math.tau
        parameters = np.linspace(start, end, max(8, sample_count))
        cos_r = math.cos(rotation)
        sin_r = math.sin(rotation)
        samples: list[Point] = []
        for parameter in parameters:
            local_x = math.cos(parameter) * major_radius
            local_y = math.sin(parameter) * minor_radius
            samples.append(
                (
                    float(entity.center[0] + local_x * cos_r - local_y * sin_r),
                    float(entity.center[1] + local_x * sin_r + local_y * cos_r),
                )
            )
        return samples

    return entity.points


def _fit_wheel_ring_ellipse(seed: CenterlineEntity, points: list[Point]) -> CenterlineEntity | None:
    if seed.center is None or seed.major_axis is None or seed.ratio is None or len(points) < 10:
        return None

    seed_major = float(math.hypot(seed.major_axis[0], seed.major_axis[1]))
    seed_minor = seed_major * seed.ratio
    if seed_major < 28.0 or seed_minor < 8.0 or seed.ratio < 0.18 or seed.ratio > 0.75:
        return None

    unique: list[Point] = []
    seen: set[tuple[float, float]] = set()
    for point in points:
        key = (round(point[0], 1), round(point[1], 1))
        if key in seen:
            continue
        seen.add(key)
        unique.append(point)
    if len(unique) < 10:
        return None

    contour = np.array(unique, dtype=np.float32).reshape(-1, 1, 2)
    try:
        (cx, cy), (axis_a, axis_b), angle_deg = cv2.fitEllipse(contour)
    except cv2.error:
        return None

    if axis_a <= 0.0 or axis_b <= 0.0:
        return None

    if axis_a >= axis_b:
        major_diameter = float(axis_a)
        minor_diameter = float(axis_b)
        major_angle_deg = float(angle_deg)
    else:
        major_diameter = float(axis_b)
        minor_diameter = float(axis_a)
        major_angle_deg = float(angle_deg) + 90.0

    major_radius = major_diameter / 2.0
    minor_radius = minor_diameter / 2.0
    ratio = minor_radius / major_radius
    if ratio < 0.16 or ratio > 0.82:
        return None
    if major_radius < seed_major * 1.18 or major_radius > seed_major * 2.8:
        return None
    if minor_radius < seed_minor * 1.12 or minor_radius > seed_minor * 3.2:
        return None

    center_distance = math.hypot(float(cx) - seed.center[0], float(cy) - seed.center[1])
    if center_distance > max(18.0, seed_major * 0.38):
        return None

    theta = math.radians(major_angle_deg)
    major_axis = (math.cos(theta) * major_radius, math.sin(theta) * major_radius)
    mean_error, max_error = _ellipse_fit_error(
        unique,
        center=(float(cx), float(cy)),
        major_axis=major_axis,
        ratio=ratio,
    )
    if mean_error > 0.12 or max_error > 0.38:
        return None

    coverage = _ellipse_angle_coverage(
        unique,
        center=(float(cx), float(cy)),
        major_axis=major_axis,
        ratio=ratio,
    )
    if coverage < math.radians(175.0):
        return None

    return CenterlineEntity(
        kind="ellipse",
        points=unique,
        center=(float(cx), float(cy)),
        major_axis=(float(major_axis[0]), float(major_axis[1])),
        ratio=float(ratio),
        rotation_deg=float(major_angle_deg),
    )


def _ellipse_arc_from_samples(samples: list[Point], ellipse: CenterlineEntity) -> CenterlineEntity | None:
    if (
        len(samples) < 2
        or ellipse.center is None
        or ellipse.major_axis is None
        or ellipse.ratio is None
    ):
        return None

    parameters = np.unwrap(
        np.array(
            _ellipse_local_parameters(
                samples,
                center=ellipse.center,
                major_axis=ellipse.major_axis,
                ratio=ellipse.ratio,
            ),
            dtype=np.float64,
        )
    )
    if len(parameters) < 2:
        return None

    delta = float(parameters[-1] - parameters[0])
    total_angle = abs(delta)
    if total_angle < math.radians(7.0) or total_angle > math.radians(230.0):
        return None

    return CenterlineEntity(
        kind="ellipse",
        points=[samples[0], samples[-1]],
        center=ellipse.center,
        major_axis=ellipse.major_axis,
        ratio=ellipse.ratio,
        start_param=float(parameters[0]),
        end_param=float(parameters[-1]),
        rotation_deg=ellipse.rotation_deg,
    )


def _entity_matches_seed_annulus(entity: CenterlineEntity, seed: CenterlineEntity) -> tuple[bool, list[Point]]:
    if entity.kind in {"line", "ellipse"}:
        return False, []
    if seed.center is None or seed.major_axis is None or seed.ratio is None:
        return False, []

    samples = _sample_entity_points(entity)
    if len(samples) < 2:
        return False, []

    radii = [
        _ellipse_radius_value(point, seed.center, seed.major_axis, seed.ratio)
        for point in samples
    ]
    valid = [radius for radius in radii if 1.35 <= radius <= 2.35]
    if len(valid) / len(radii) < 0.68:
        return False, []

    median_radius = float(np.median(valid))
    if median_radius < 1.45 or median_radius > 2.2:
        return False, []

    return True, samples


def _promote_wheel_ring_ellipses(entities: list[CenterlineEntity]) -> list[CenterlineEntity]:
    if len(entities) < 3:
        return entities

    replacements: dict[int, CenterlineEntity] = {}
    seeds = [
        (index, entity)
        for index, entity in enumerate(entities)
        if entity.kind == "ellipse"
        and entity.center is not None
        and entity.major_axis is not None
        and entity.ratio is not None
        and entity.start_param is None
        and math.hypot(entity.major_axis[0], entity.major_axis[1]) >= 28.0
        and 0.18 <= entity.ratio <= 0.75
    ]

    for seed_index, seed in seeds:
        if seed.center is None or seed.major_axis is None or seed.ratio is None:
            continue

        candidate_points: list[Point] = []
        candidate_samples: list[tuple[int, list[Point]]] = []
        for index, entity in enumerate(entities):
            if index == seed_index or index in replacements:
                continue

            matches, samples = _entity_matches_seed_annulus(entity, seed)
            if not matches:
                continue

            candidate_points.extend(samples)
            candidate_samples.append((index, samples))

        if len(candidate_points) < 10 or not candidate_samples:
            continue

        wheel_ring = _fit_wheel_ring_ellipse(seed, candidate_points)
        if wheel_ring is None:
            continue

        for index, samples in candidate_samples:
            replacement = _ellipse_arc_from_samples(samples, wheel_ring)
            if replacement is not None:
                replacements[index] = replacement

    if not replacements:
        return entities

    promoted: list[CenterlineEntity] = []
    for index, entity in enumerate(entities):
        promoted.append(replacements.get(index, entity))

    return promoted


def _fallback_centerline_entity(segment: list[Point], export_mode: ExportMode) -> CenterlineEntity:
    kind = _centerline_kind(segment, export_mode)
    if export_mode == "hybrid" and kind == "spline" and _spline_has_overshoot_risk(segment):
        kind = "polyline"
    return CenterlineEntity(kind=kind, points=segment)


def _hybrid_segment_entities(path: list[Point]) -> list[CenterlineEntity]:
    ellipse_entity = _fit_closed_ellipse_entity(path)
    if ellipse_entity is not None:
        return [ellipse_entity]

    near_closed_ellipse_entity = _fit_near_closed_ellipse_entity(path)
    if near_closed_ellipse_entity is not None:
        return [near_closed_ellipse_entity]

    entities: list[CenterlineEntity] = []
    for segment in _split_path_at_corners(path):
        if len(segment) < 2:
            continue

        fitted_line = _fit_straight_line(segment)
        if fitted_line is not None:
            entities.append(CenterlineEntity(kind="line", points=fitted_line))
            continue

        arc_entity = _fit_circular_arc_entity(segment)
        if arc_entity is not None:
            entities.append(arc_entity)
            continue

        # Open ellipse arcs created loop artifacts in CAD; only closed loops are promoted to ellipses.
        entities.append(_fallback_centerline_entity(segment, export_mode="hybrid"))

    return _merge_adjacent_line_entities(entities)


def _line_entity_direction(entity: CenterlineEntity) -> np.ndarray | None:
    if entity.kind != "line" or len(entity.points) < 2:
        return None

    start = np.array(entity.points[0], dtype=np.float32)
    end = np.array(entity.points[-1], dtype=np.float32)
    vector = end - start
    norm = float(np.linalg.norm(vector))
    if norm < 1e-6:
        return None
    return vector / norm


def _merge_adjacent_line_entities(entities: list[CenterlineEntity]) -> list[CenterlineEntity]:
    if len(entities) < 2:
        return entities

    merged: list[CenterlineEntity] = []
    for entity in entities:
        if not merged or entity.kind != "line" or merged[-1].kind != "line":
            merged.append(entity)
            continue

        previous = merged[-1]
        previous_direction = _line_entity_direction(previous)
        current_direction = _line_entity_direction(entity)
        if previous_direction is None or current_direction is None:
            merged.append(entity)
            continue

        connection_gap = math.hypot(
            entity.points[0][0] - previous.points[-1][0],
            entity.points[0][1] - previous.points[-1][1],
        )
        if connection_gap > 1.75:
            merged.append(entity)
            continue

        alignment = abs(float(np.dot(previous_direction, current_direction)))
        if alignment < math.cos(math.radians(4.0)):
            merged.append(entity)
            continue

        candidate_points = [previous.points[0], previous.points[-1], entity.points[-1]]
        fitted_line = _fit_straight_line(candidate_points)
        if fitted_line is None:
            merged.append(entity)
            continue

        merged[-1] = CenterlineEntity(kind="line", points=fitted_line)

    return merged



def _centerline_entities(paths: list[list[Point]], export_mode: ExportMode) -> list[CenterlineEntity]:
    entities: list[CenterlineEntity] = []
    for path in paths:
        if len(path) < 2:
            continue

        if export_mode == "hybrid":
            entities.extend(_hybrid_segment_entities(path))
            continue

        entities.append(_fallback_centerline_entity(path, export_mode=export_mode))
    if export_mode == "hybrid":
        return _promote_wheel_ring_ellipses(entities)
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
        points = _prepare_fill_path(points, epsilon=epsilon)
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
    min_fill_area = int(64 * WORK_SCALE * WORK_SCALE)

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
        points = _prepare_fill_path(points, epsilon=epsilon)
        if len(points) >= 3:
            fill_paths.append(points)

    fill_paths.sort(key=lambda path: cv2.contourArea(np.array(path, dtype=np.float32)), reverse=True)
    return fill_paths


def _fill_holes(mask: np.ndarray) -> np.ndarray:
    if not np.any(mask):
        return mask

    mask_u8 = mask.astype(np.uint8) * 255
    height, width = mask_u8.shape
    flood_filled = mask_u8.copy()
    flood_mask = np.zeros((height + 2, width + 2), dtype=np.uint8)
    cv2.floodFill(flood_filled, flood_mask, (0, 0), 255)
    holes = cv2.bitwise_not(flood_filled)
    return (mask_u8 | holes) > 0


def _contour_area_sum(paths: list[list[Point]]) -> float:
    total = 0.0
    for path in paths:
        if len(path) < 3:
            continue
        total += abs(float(cv2.contourArea(np.array(path, dtype=np.float32))))
    return total


def _filter_fill_paths_by_area(paths: list[list[Point]], min_area: float = 64.0) -> list[list[Point]]:
    return [
        path
        for path in paths
        if len(path) >= 3 and abs(float(cv2.contourArea(np.array(path, dtype=np.float32)))) >= min_area
    ]


def _extract_silhouette_fill_paths_from_foreground(
    foreground: np.ndarray,
    epsilon: float,
    close_radius: int,
) -> list[list[Point]]:
    if not np.any(foreground):
        return []

    foreground_u8 = foreground.astype(np.uint8) * 255
    component_count, labels, stats, _ = cv2.connectedComponentsWithStats(foreground_u8, connectivity=8)
    filtered = np.zeros_like(foreground_u8)
    min_component_area = 48
    for label in range(1, component_count):
        if int(stats[label, cv2.CC_STAT_AREA]) >= min_component_area:
            filtered[labels == label] = 255

    if not np.any(filtered):
        return []

    kernel_size = max(3, close_radius * 2 + 1)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
    closed = cv2.morphologyEx(filtered, cv2.MORPH_CLOSE, kernel, iterations=1) > 0
    silhouette = _fill_holes(closed).astype(np.uint8) * 255

    contours, _ = cv2.findContours(silhouette, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    min_fill_area = 64
    fill_paths: list[list[Point]] = []
    for contour in contours:
        if cv2.contourArea(contour) < min_fill_area:
            continue
        points = [(float(x), float(y)) for [[x, y]] in contour]
        points = _prepare_fill_path(points, epsilon=max(0.35, epsilon * 0.8))
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
        endpoint_mask = np.logical_and(pruned, degree == 1)
        endpoints = [(int(row), int(col)) for row, col in np.argwhere(endpoint_mask)]
        junction_mask = np.logical_and(pruned, degree >= 3)
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

        active_pixels = int(pruned.sum())
        max_safe_removal = max(32, int(active_pixels * 0.2))
        if len(to_remove) > max_safe_removal:
            break

        for row, col in to_remove:
            pruned[row, col] = False
    return pruned


def _trace_graph_runs(skeleton: np.ndarray) -> tuple[list[list[Pixel]], set[Pixel], set[Pixel]]:
    degree = _degree_map(skeleton)
    endpoint_mask = np.logical_and(skeleton, degree == 1)
    junction_mask = np.logical_and(skeleton, degree >= 3)

    endpoints: set[Pixel] = {(int(row), int(col)) for row, col in np.argwhere(endpoint_mask)}
    junctions: set[Pixel] = {(int(row), int(col)) for row, col in np.argwhere(junction_mask)}
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

    for row, col in np.argwhere(skeleton):
        pixel = (int(row), int(col))
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
    include_fill: bool = True,
) -> str:
    path_tags: list[str] = []
    if include_fill:
        for path in fill_paths:
            if len(path) < 3:
                continue
            svg_path = _build_closed_svg_path_data(_reduce_fill_path_for_export(path))
            path_tags.append(
                f'<path d="{svg_path}" fill="#ffffff" stroke="none" '
                'stroke-linecap="round" stroke-linejoin="round" />'
            )

    for entity in centerline_entities:
        if len(entity.points) < 2:
            continue
        if entity.kind == "line":
            start_x, start_y = entity.points[0]
            end_x, end_y = entity.points[-1]
            path_tags.append(
                f'<line x1="{start_x:.2f}" y1="{start_y:.2f}" x2="{end_x:.2f}" y2="{end_y:.2f}" '
                f'stroke="{CENTERLINE_SVG_STROKE}" stroke-width="1" '
                'stroke-linecap="round" stroke-linejoin="round" />'
            )
        elif entity.kind == "arc":
            if entity.radius is None or entity.start_angle_deg is None or entity.end_angle_deg is None:
                continue
            start_x, start_y = entity.points[0]
            end_x, end_y = entity.points[-1]
            delta = math.radians(entity.end_angle_deg - entity.start_angle_deg)
            large_arc_flag = 1 if abs(delta) > math.pi else 0
            sweep_flag = 1 if delta >= 0.0 else 0
            svg_path = (
                f"M {start_x:.2f} {start_y:.2f} "
                f"A {entity.radius:.2f} {entity.radius:.2f} 0 {large_arc_flag} {sweep_flag} "
                f"{end_x:.2f} {end_y:.2f}"
            )
            path_tags.append(
                f'<path d="{svg_path}" fill="none" stroke="{CENTERLINE_SVG_STROKE}" stroke-width="1" '
                'stroke-linecap="round" stroke-linejoin="round" />'
            )
        elif entity.kind == "ellipse":
            if entity.center is None or entity.major_axis is None or entity.ratio is None:
                continue
            cx, cy = entity.center
            major_x, major_y = entity.major_axis
            rx = math.hypot(major_x, major_y)
            ry = rx * entity.ratio
            if entity.start_param is not None and entity.end_param is not None:
                start_x, start_y = entity.points[0]
                end_x, end_y = entity.points[-1]
                delta = entity.end_param - entity.start_param
                large_arc_flag = 1 if abs(delta) > math.pi else 0
                sweep_flag = 1 if delta >= 0.0 else 0
                svg_path = (
                    f"M {start_x:.2f} {start_y:.2f} "
                    f"A {rx:.2f} {ry:.2f} {entity.rotation_deg:.2f} {large_arc_flag} {sweep_flag} "
                    f"{end_x:.2f} {end_y:.2f}"
                )
                path_tags.append(
                    f'<path d="{svg_path}" fill="none" stroke="{CENTERLINE_SVG_STROKE}" stroke-width="1" '
                    'stroke-linecap="round" stroke-linejoin="round" />'
                )
                continue
            path_tags.append(
                f'<ellipse cx="{cx:.2f}" cy="{cy:.2f}" rx="{rx:.2f}" ry="{ry:.2f}" '
                f'transform="rotate({entity.rotation_deg:.2f} {cx:.2f} {cy:.2f})" '
                f'fill="none" stroke="{CENTERLINE_SVG_STROKE}" stroke-width="1" '
                'stroke-linecap="round" stroke-linejoin="round" />'
            )
        elif entity.kind == "polyline":
            path_tags.append(
                f'<polyline points="{_points_attr(entity.points)}" fill="none" stroke="{CENTERLINE_SVG_STROKE}" stroke-width="1" '
                'stroke-linecap="round" stroke-linejoin="round" />'
            )
        else:
            svg_path = _build_open_svg_path_data(entity.points)
            path_tags.append(
                f'<path d="{svg_path}" fill="none" stroke="{CENTERLINE_SVG_STROKE}" stroke-width="1" '
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


def _build_closed_svg_path_data(points: list[Point]) -> str:
    closed_points = _normalize_closed_path(points)
    if len(closed_points) < 3:
        raise ValueError("Need at least three points to build a closed fill path")

    if len(closed_points) == 3:
        start_x, start_y = closed_points[0]
        middle_x, middle_y = closed_points[1]
        end_x, end_y = closed_points[2]
        return (
            f"M {start_x:.2f} {start_y:.2f} "
            f"L {middle_x:.2f} {middle_y:.2f} "
            f"L {end_x:.2f} {end_y:.2f} Z"
        )

    vectors = [np.array(point, dtype=np.float32) for point in closed_points]
    total = len(vectors)
    segments = [f"M {vectors[0][0]:.2f} {vectors[0][1]:.2f}"]

    for index in range(total):
        p0 = vectors[(index - 1) % total]
        p1 = vectors[index]
        p2 = vectors[(index + 1) % total]
        p3 = vectors[(index + 2) % total]
        control1 = p1 + (p2 - p0) / 6.0
        control2 = p2 - (p3 - p1) / 6.0
        control1 = _clamp_control_point(control1, (p0, p1, p2))
        control2 = _clamp_control_point(control2, (p1, p2, p3))
        segments.append(
            "C "
            f"{control1[0]:.2f} {control1[1]:.2f}, "
            f"{control2[0]:.2f} {control2[1]:.2f}, "
            f"{p2[0]:.2f} {p2[1]:.2f}"
        )

    segments.append("Z")
    return " ".join(segments)

def _build_dxf(
    centerline_entities: Iterable[CenterlineEntity],
    fill_paths: Iterable[list[Point]],
    height: int,
    include_fill: bool = True,
) -> str:
    doc = ezdxf.new("R2010")
    modelspace = doc.modelspace()
    _ensure_dxf_layers(doc)

    if include_fill:
        for path in fill_paths:
            if len(path) < 3:
                continue

            hatch = modelspace.add_hatch(color=7, dxfattribs={"layer": "FILL"})
            hatch.set_solid_fill(color=7)
            hatch.rgb = (255, 255, 255)
            _add_hatch_fill_path(hatch, path, height=height)

    for entity in centerline_entities:
        if len(entity.points) < 2:
            continue
        transformed = [(x, float(height) - y) for x, y in entity.points]
        if entity.kind == "line":
            exported = modelspace.add_line(
                transformed[0],
                transformed[-1],
                dxfattribs={"layer": "CENTERLINES"},
            )
        elif entity.kind == "arc":
            if entity.center is None or entity.radius is None or entity.start_angle_deg is None or entity.end_angle_deg is None:
                continue
            delta = entity.end_angle_deg - entity.start_angle_deg
            exported = modelspace.add_arc(
                center=(entity.center[0], float(height) - entity.center[1]),
                radius=entity.radius,
                start_angle=-entity.start_angle_deg,
                end_angle=-entity.end_angle_deg,
                is_counter_clockwise=delta < 0.0,
                dxfattribs={"layer": "CENTERLINES"},
            )
        elif entity.kind == "ellipse":
            if entity.center is None or entity.major_axis is None or entity.ratio is None:
                continue
            center = (entity.center[0], float(height) - entity.center[1])
            major_axis = (entity.major_axis[0], -entity.major_axis[1])
            exported = modelspace.add_ellipse(
                center=center,
                major_axis=major_axis,
                ratio=entity.ratio,
                start_param=-entity.start_param if entity.start_param is not None and entity.end_param is not None else 0,
                end_param=-entity.end_param if entity.start_param is not None and entity.end_param is not None else math.tau,
                dxfattribs={"layer": "CENTERLINES"},
            )
        elif entity.kind == "polyline":
            exported = modelspace.add_lwpolyline(
                transformed,
                format="xy",
                dxfattribs={"layer": "CENTERLINES"},
            )
        else:
            degree = max(1, min(3, len(transformed) - 1))
            exported = modelspace.add_spline(
                transformed,
                degree=degree,
                dxfattribs={"layer": "CENTERLINES"},
            )
        exported.rgb = CENTERLINE_RGB

    output = io.StringIO()
    doc.write(output)
    return output.getvalue()


def _closed_path_perimeter(points: list[Point]) -> float:
    closed_points = _normalize_closed_path(points)
    if len(closed_points) < 2:
        return 0.0
    return _path_length(closed_points + [closed_points[0]])


def _reduce_fill_path_for_export(points: list[Point]) -> list[Point]:
    closed_points = _normalize_closed_path(points)
    if len(closed_points) <= 12:
        return closed_points

    perimeter = _closed_path_perimeter(closed_points)
    target_points = int(np.clip(round(perimeter / 34.0), 10, 34))
    epsilon = max(1.6, perimeter * 0.003)
    reduced = closed_points
    for _ in range(8):
        candidate = _simplify_closed_path(closed_points, epsilon=epsilon)
        if len(candidate) >= 4:
            reduced = candidate
        if len(reduced) <= target_points:
            break
        epsilon *= 1.35

    return _smooth_closed_path(reduced, iterations=1)


def _split_closed_path_at_corners(
    points: list[Point],
    angle_threshold_deg: float = 24.0,
    min_segment_length: float = 10.0,
) -> list[list[Point]]:
    closed_points = _normalize_closed_path(points)
    if len(closed_points) < 4:
        return [closed_points + closed_points[:1]]

    candidates: list[int] = []
    total = len(closed_points)
    vectors = [np.array(point, dtype=np.float32) for point in closed_points]
    for index in range(total):
        incoming = vectors[index] - vectors[(index - 1) % total]
        outgoing = vectors[(index + 1) % total] - vectors[index]
        incoming_norm = float(np.linalg.norm(incoming))
        outgoing_norm = float(np.linalg.norm(outgoing))
        if incoming_norm < 1e-6 or outgoing_norm < 1e-6:
            continue
        cosine = float(np.dot(incoming, outgoing) / (incoming_norm * outgoing_norm))
        angle = math.degrees(math.acos(float(np.clip(cosine, -1.0, 1.0))))
        if angle >= angle_threshold_deg:
            candidates.append(index)

    if len(candidates) < 2:
        return [closed_points + closed_points[:1]]

    def circular_segment(start: int, end: int) -> list[Point]:
        if start <= end:
            return closed_points[start : end + 1]
        return closed_points[start:] + closed_points[: end + 1]

    filtered: list[int] = []
    for candidate in candidates:
        if not filtered:
            filtered.append(candidate)
            continue
        if _path_length(circular_segment(filtered[-1], candidate)) >= min_segment_length:
            filtered.append(candidate)

    if len(filtered) >= 2:
        wrap_length = _path_length(circular_segment(filtered[-1], filtered[0]))
        if wrap_length < min_segment_length:
            filtered.pop()

    if len(filtered) < 2:
        return [closed_points + closed_points[:1]]

    segments: list[list[Point]] = []
    for start, end in zip(filtered, filtered[1:] + filtered[:1]):
        segment = circular_segment(start, end)
        if len(segment) >= 2:
            segments.append(segment)

    return segments or [closed_points + closed_points[:1]]


def _transform_dxf_point(point: Point, height: int) -> Point:
    return (point[0], float(height) - point[1])


def _add_hatch_line_edge(edge_path: ezdxf.entities.boundary_paths.EdgePath, points: list[Point], height: int) -> None:
    edge_path.add_line(_transform_dxf_point(points[0], height), _transform_dxf_point(points[-1], height))


def _add_hatch_arc_edge(edge_path: ezdxf.entities.boundary_paths.EdgePath, entity: CenterlineEntity, height: int) -> bool:
    if entity.center is None or entity.radius is None or entity.start_angle_deg is None or entity.end_angle_deg is None:
        return False

    delta = entity.end_angle_deg - entity.start_angle_deg
    edge_path.add_arc(
        center=_transform_dxf_point(entity.center, height),
        radius=entity.radius,
        start_angle=-entity.start_angle_deg,
        end_angle=-entity.end_angle_deg,
        ccw=delta < 0.0,
    )
    return True


def _add_hatch_ellipse_edge(edge_path: ezdxf.entities.boundary_paths.EdgePath, entity: CenterlineEntity, height: int) -> bool:
    if entity.center is None or entity.major_axis is None or entity.ratio is None:
        return False

    edge_path.add_ellipse(
        center=_transform_dxf_point(entity.center, height),
        major_axis=(entity.major_axis[0], -entity.major_axis[1]),
        ratio=entity.ratio,
        start_angle=-entity.start_param if entity.start_param is not None and entity.end_param is not None else 0.0,
        end_angle=-entity.end_param if entity.start_param is not None and entity.end_param is not None else math.tau,
        ccw=True,
    )
    return True


def _add_hatch_spline_edge(edge_path: ezdxf.entities.boundary_paths.EdgePath, points: list[Point], height: int, periodic: int = 0) -> None:
    transformed = [_transform_dxf_point(point, height) for point in points]
    edge_path.add_spline(
        fit_points=transformed,
        degree=max(1, min(3, len(transformed) - 1)),
        periodic=periodic,
    )


def _add_hatch_fill_path(hatch: ezdxf.entities.Hatch, points: list[Point], height: int) -> None:
    ellipse_entity = _fit_closed_ellipse_entity(points)
    if ellipse_entity is not None and ellipse_entity.center is not None and ellipse_entity.major_axis is not None and ellipse_entity.ratio is not None:
        edge_path = hatch.paths.add_edge_path()
        _add_hatch_ellipse_edge(edge_path, ellipse_entity, height)
        return

    reduced = _reduce_fill_path_for_export(points)
    if len(reduced) < 3:
        return

    ellipse_entity = _fit_closed_ellipse_entity(reduced)
    if ellipse_entity is not None and ellipse_entity.center is not None and ellipse_entity.major_axis is not None and ellipse_entity.ratio is not None:
        edge_path = hatch.paths.add_edge_path()
        _add_hatch_ellipse_edge(edge_path, ellipse_entity, height)
        return

    edge_path = hatch.paths.add_edge_path()
    edge_count = 0
    for segment in _split_closed_path_at_corners(reduced):
        if len(segment) < 2:
            continue

        fitted_line = _fit_straight_line(segment)
        if fitted_line is not None:
            _add_hatch_line_edge(edge_path, fitted_line, height)
            edge_count += 1
            continue

        arc_entity = _fit_circular_arc_entity(segment)
        if arc_entity is not None and _add_hatch_arc_edge(edge_path, arc_entity, height):
            edge_count += 1
            continue

        if len(segment) == 2:
            _add_hatch_line_edge(edge_path, segment, height)
        else:
            _add_hatch_spline_edge(edge_path, segment, height)
        edge_count += 1

    if edge_count > 0:
        return

    transformed = [_transform_dxf_point(point, height) for point in reduced]
    hatch.paths.add_polyline_path(transformed, is_closed=True)


def _ensure_dxf_layers(doc: ezdxf.EzDxf) -> None:
    layer_specs = [
        ("FILL", {"color": 7}),
        ("CENTERLINES", {"color": 7}),
    ]
    for name, attrs in layer_specs:
        if name not in doc.layers:
            doc.layers.add(name, dxfattribs=attrs)
    doc.layers.get("CENTERLINES").rgb = CENTERLINE_RGB


def vectorize_from_array(
    gray: np.ndarray,
    simplify_epsilon: float = 0.8,
    smooth_iterations: int = 1,
    export_mode: ExportMode = "hybrid",
    include_fill: bool = True,
    preserve_detail: bool = False,
) -> VectorizationResult:
    if gray.ndim != 2:
        raise ValueError("Input must be grayscale")

    height, width = gray.shape
    is_small_asset = max(height, width) <= 700
    line_simplify_epsilon = simplify_epsilon * (0.35 if is_small_asset else 1.0)
    fill_simplify_epsilon = simplify_epsilon * (0.75 if is_small_asset else 1.0)
    line_smooth_iterations = min(smooth_iterations, 1) if is_small_asset else smooth_iterations

    if WORK_SCALE != 1.0:
        working_gray = cv2.resize(gray, dsize=None, fx=WORK_SCALE, fy=WORK_SCALE, interpolation=cv2.INTER_CUBIC)
    else:
        working_gray = gray

    foreground, _detail_protection_mask, bridge_block_mask = preprocess_binarize(
        working_gray,
        preserve_detail=preserve_detail,
    )
    skeleton = skeletonize_foreground(foreground)
    skeleton = _prune_short_spurs(skeleton, max_spur_length=1 if preserve_detail else 3)
    skeleton = _bridge_endpoint_gaps(
        skeleton,
        max_gap=10.0 * WORK_SCALE,
        max_angle_deg=40.0,
        iterations=2,
        blocked_mask=bridge_block_mask,
    )
    skeleton = _prune_short_spurs(skeleton, max_spur_length=1 if preserve_detail else 2)
    estimated_stroke_radius = _estimate_stroke_radius(foreground, skeleton=skeleton)

    pixel_paths, _endpoints_raw, junctions = _trace_graph_runs(skeleton)
    edge_run_count = len(pixel_paths)
    junction_mapping, junction_anchors = _cluster_junction_anchors(junctions, skeleton.shape)
    pixel_paths = _snap_path_terminals_to_junctions(pixel_paths, junction_mapping)
    if not preserve_detail:
        pixel_paths = _remove_tiny_intra_junction_runs(pixel_paths, junction_anchors)
        pixel_paths = _remove_tiny_connector_runs(pixel_paths)
    pixel_paths = _merge_through_junctions(pixel_paths, junctions=junction_anchors)
    merge_blockers = junction_anchors if junction_anchors else junctions
    if not preserve_detail:
        pixel_paths = _merge_collinear_runs(pixel_paths, junctions=merge_blockers)

    endpoint_count, junction_count = _infer_terminal_graph_stats(pixel_paths, junction_radius=3.0)

    vector_paths: list[list[Point]] = []
    for pixel_path in pixel_paths:
        points = _pixel_path_to_points(pixel_path)
        points = _resample_path(points, spacing=1.0)
        if line_smooth_iterations > 0:
            points = _smooth_path(points, iterations=max(1, line_smooth_iterations))
        if not preserve_detail:
            points = _reduce_path_for_cad(points, epsilon=line_simplify_epsilon)
        elif simplify_epsilon > 0:
            points = _simplify_path(points, epsilon=min(line_simplify_epsilon, 0.05))
        if len(points) >= 2:
            vector_paths.append(points)

    vector_paths = _rescale_paths(vector_paths, scale=WORK_SCALE)
    if not preserve_detail:
        vector_paths = _cleanup_micro_feature_paths(vector_paths)

    fill_paths = _extract_fill_paths_from_centerlines(
        vector_paths,
        width=width,
        height=height,
        epsilon=fill_simplify_epsilon,
    )
    if not fill_paths:
        fill_paths = _extract_fill_paths_from_foreground(
            foreground,
            epsilon=fill_simplify_epsilon,
            expansion_radius=max(1, int(round(estimated_stroke_radius))),
        )
        fill_paths = _rescale_paths(fill_paths, scale=WORK_SCALE)
    silhouette_fill_paths = _extract_silhouette_fill_paths_from_foreground(
        foreground,
        epsilon=fill_simplify_epsilon,
        close_radius=int(np.clip(round(estimated_stroke_radius * 3.0), 4, 18)),
    )
    silhouette_fill_paths = _rescale_paths(silhouette_fill_paths, scale=WORK_SCALE)
    silhouette_fill_paths = _filter_fill_paths_by_area(silhouette_fill_paths)
    if silhouette_fill_paths:
        fill_area = _contour_area_sum(fill_paths)
        silhouette_area = _contour_area_sum(silhouette_fill_paths)
        image_area = float(width * height)
        foreground_density = float(np.mean(foreground))
        if (
            foreground_density <= 0.04
            and silhouette_area >= image_area * 0.03
            and fill_area < silhouette_area * 0.6
        ):
            fill_paths = silhouette_fill_paths
    fill_paths = _filter_fill_paths_by_area(fill_paths)

    centerline_entities = _centerline_entities(vector_paths, export_mode=export_mode)
    line_count = sum(1 for entity in centerline_entities if entity.kind == "line")
    arc_count = sum(1 for entity in centerline_entities if entity.kind == "arc")
    ellipse_count = sum(1 for entity in centerline_entities if entity.kind == "ellipse")
    spline_count = sum(1 for entity in centerline_entities if entity.kind == "spline")
    polyline_count = sum(1 for entity in centerline_entities if entity.kind == "polyline")

    svg_text = _build_svg(
        centerline_entities,
        fill_paths=fill_paths,
        width=width,
        height=height,
        include_fill=include_fill,
    )
    dxf_text = _build_dxf(
        centerline_entities,
        fill_paths=fill_paths,
        height=height,
        include_fill=include_fill,
    )

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
            "entity_count": len(centerline_entities),
            "spline_count": spline_count,
            "polyline_count": polyline_count,
            "line_count": line_count,
            "arc_count": arc_count,
            "ellipse_count": ellipse_count,
        },
    )


def vectorize_from_image_bytes(
    image_bytes: bytes,
    simplify_epsilon: float = 0.8,
    smooth_iterations: int = 1,
    export_mode: ExportMode = "hybrid",
    include_fill: bool = True,
    preserve_detail: bool = False,
) -> VectorizationResult:
    gray = _decode_grayscale(image_bytes)
    return vectorize_from_array(
        gray,
        simplify_epsilon=simplify_epsilon,
        smooth_iterations=smooth_iterations,
        export_mode=export_mode,
        include_fill=include_fill,
        preserve_detail=preserve_detail,
    )
