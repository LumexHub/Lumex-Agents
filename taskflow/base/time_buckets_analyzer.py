from typing import List, Tuple, Dict, Any


def generate_activity_heatmap(
    timestamps: List[int],
    counts: List[int],
    buckets: int = 10,
    normalize: bool = True
) -> List[float]:
    """
    Bucket activity counts into fixed 'buckets' time intervals,
    returning either raw counts or normalized values [0.0–1.0].

    Args:
        timestamps: List of epoch ms timestamps.
        counts: List of integer counts per timestamp.
        buckets: Number of intervals to divide the data into.
        normalize: If True, scale values into [0.0, 1.0].

    Returns:
        List of bucket values (length == buckets).
    """
    if not timestamps or not counts:
        return [0.0] * buckets if normalize else [0] * buckets

    if len(timestamps) != len(counts):
        raise ValueError("timestamps and counts must be of equal length")

    t_min, t_max = min(timestamps), max(timestamps)
    span = t_max - t_min or 1
    bucket_size = span / buckets

    agg = [0] * buckets
    for t, c in zip(timestamps, counts):
        idx = min(buckets - 1, int((t - t_min) / bucket_size))
        agg[idx] += c

    if normalize:
        m = max(agg) or 1
        return [round(val / m, 4) for val in agg]

    return agg


def heatmap_with_edges(
    timestamps: List[int],
    counts: List[int],
    buckets: int = 10,
    normalize: bool = True
) -> List[Tuple[Tuple[int, int], float]]:
    """
    Like generate_activity_heatmap, but returns bucket ranges and values.
    Example: [((start, end), value), ...]
    """
    if not timestamps:
        return []

    t_min, t_max = min(timestamps), max(timestamps)
    span = t_max - t_min or 1
    bucket_size = span / buckets

    values = generate_activity_heatmap(timestamps, counts, buckets, normalize)
    result: List[Tuple[Tuple[int, int], float]] = []

    for i, val in enumerate(values):
        start = int(t_min + i * bucket_size)
        end = int(t_min + (i + 1) * bucket_size)
        result.append(((start, end), val))

    return result


def summarize_heatmap(values: List[float]) -> Dict[str, Any]:
    """
    Provide quick statistics on a heatmap array.
    """
    if not values:
        return {"min": 0, "max": 0, "avg": 0, "nonzero": 0}

    nonzero = sum(1 for v in values if v > 0)
    return {
        "min": min(values),
        "max": max(values),
        "avg": round(sum(values) / len(values), 4),
        "nonzero": nonzero,
    }
