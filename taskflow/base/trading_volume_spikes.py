from typing import List, Dict, Any


def detect_volume_bursts(
    volumes: List[float],
    threshold_ratio: float = 1.5,
    min_interval: int = 1
) -> List[Dict[str, Any]]:
    """
    Identify indices where trading volume increases sharply relative to the
    previous data point. A "burst" is defined when the current volume is at
    least `threshold_ratio` times the previous volume, and the event is at
    least `min_interval` steps away from the last recorded burst.

    Args:
        volumes: List of volume values (floats).
        threshold_ratio: Minimum multiplier relative to the previous volume.
        min_interval: Minimum index gap allowed between consecutive bursts.

    Returns:
        List of event dicts with details:
        {
          "index": int,
          "previous": float,
          "current": float,
          "ratio": float,
          "delta": float
        }
    """
    if not volumes or len(volumes) < 2:
        return []

    if threshold_ratio <= 1.0:
        raise ValueError("threshold_ratio must be > 1.0")

    events: List[Dict[str, Any]] = []
    last_idx = -min_interval

    for i in range(1, len(volumes)):
        prev, curr = volumes[i - 1], volumes[i]

        # handle zero or negative previous volume
        if prev <= 0:
            ratio = float("inf") if curr > 0 else 1.0
        else:
            ratio = curr / prev

        if ratio >= threshold_ratio and (i - last_idx) >= min_interval:
            event = {
                "index": i,
                "previous": round(prev, 4),
                "current": round(curr, 4),
                "ratio": round(ratio, 4),
                "delta": round(curr - prev, 4),
            }
            events.append(event)
            last_idx = i

    return events


def summarize_bursts(events: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Provide summary statistics of detected bursts.
    """
    if not events:
        return {"count": 0, "avg_ratio": 0.0, "max_ratio": 0.0}

    ratios = [e["ratio"] for e in events]
    return {
        "count": len(events),
        "avg_ratio": round(sum(ratios) / len(ratios), 4),
        "max_ratio": max(ratios),
    }
