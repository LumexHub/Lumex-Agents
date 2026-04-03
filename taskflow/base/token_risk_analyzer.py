import math
from typing import Dict, Any

def calculate_risk_score(price_change_pct: float, liquidity_usd: float, flags_mask: int) -> float:
    """
    Compute a normalized 0–100 risk score for a token or market.
    
    Components:
      • Volatility: price swings increase risk (up to 50 points).
      • Liquidity: deeper liquidity reduces risk (up to 30 points penalty).
      • Flags: each set bit in flags_mask adds 5 penalty points.
    
    Args:
        price_change_pct: Percent change over the observed period (e.g. +5.0 for +5%).
        liquidity_usd: Liquidity depth in USD.
        flags_mask: Integer bitmask of risk flags (each bit = a triggered condition).
    
    Returns:
        A float score between 0 and 100 (inclusive).
    """
    # volatility component (max 50 points)
    vol_score = min(abs(price_change_pct) / 10.0, 1.0) * 50.0

    # liquidity component (max 30 points, lower if liquidity is high)
    if liquidity_usd > 0:
        liq_score = max(0.0, 30.0 - (math.log10(liquidity_usd) * 5.0))
    else:
        liq_score = 30.0

    # flags component (5 points per set bit)
    flag_count = bin(flags_mask).count("1")
    flag_score = flag_count * 5.0

    raw_score = vol_score + liq_score + flag_score
    return min(round(raw_score, 2), 100.0)


def breakdown_risk(price_change_pct: float, liquidity_usd: float, flags_mask: int) -> Dict[str, Any]:
    """
    Return a detailed breakdown of the risk score components.
    Useful for debugging or UI display.
    """
    vol_score = min(abs(price_change_pct) / 10.0, 1.0) * 50.0
    liq_score = max(0.0, 30.0 - (math.log10(liquidity_usd) * 5.0)) if liquidity_usd > 0 else 30.0
    flag_count = bin(flags_mask).count("1")
    flag_score = flag_count * 5.0

    total = min(round(vol_score + liq_score + flag_score, 2), 100.0)
    return {
        "volatility_score": round(vol_score, 2),
        "liquidity_score": round(liq_score, 2),
        "flag_score": round(flag_score, 2),
        "flag_count": flag_count,
        "final_score": total,
    }


def classify_risk_level(score: float) -> str:
    """
    Classify a numeric risk score into qualitative buckets.
    """
    if score < 25:
        return "Low"
    elif score < 50:
        return "Moderate"
    elif score < 75:
        return "High"
    else:
        return "Critical"
