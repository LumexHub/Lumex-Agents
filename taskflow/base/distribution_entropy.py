import math
from typing import List, Dict, Any


def compute_shannon_entropy(addresses: List[str]) -> float:
    """
    Compute Shannon entropy (bits) of a list of addresses (or arbitrary strings).

    Entropy measures unpredictability: higher values = more diverse distribution.

    Args:
        addresses: List of string identifiers.

    Returns:
        Shannon entropy in bits (rounded to 4 decimals).
    """
    if not addresses:
        return 0.0

    freq: Dict[str, int] = {}
    for a in addresses:
        freq[a] = freq.get(a, 0) + 1

    total = len(addresses)
    entropy = 0.0
    for count in freq.values():
        p = count / total
        if p > 0:
            entropy -= p * math.log2(p)

    return round(entropy, 4)


def entropy_breakdown(addresses: List[str]) -> Dict[str, Any]:
    """
    Provide a detailed breakdown: frequencies, probabilities, and contribution
    of each unique address to total entropy.
    """
    if not addresses:
        return {"total": 0, "details": []}

    freq: Dict[str, int] = {}
    for a in addresses:
        freq[a] = freq.get(a, 0) + 1

    total = len(addresses)
    details = []
    entropy = 0.0

    for addr, count in freq.items():
        p = count / total
        contrib = -(p * math.log2(p)) if p > 0 else 0
        entropy += contrib
        details.append({
            "address": addr,
            "count": count,
            "probability": round(p, 6),
            "entropy_contribution": round(contrib, 6)
        })

    return {"total": round(entropy, 4), "details": details}


def classify_entropy(entropy: float, max_bits: int) -> str:
    """
    Classify entropy relative to maximum possible bits.
    """
    if max_bits <= 0:
        return "undefined"

    ratio = entropy / max_bits
    if ratio < 0.3:
        return "low"
    elif ratio < 0.7:
        return "medium"
    else:
        return "high"
