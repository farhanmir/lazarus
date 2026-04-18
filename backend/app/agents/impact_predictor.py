"""Impact Predictor agent — deterministic patient population, breakthrough & commercial value estimation."""

from __future__ import annotations

from backend.app.agents.types import ImpactPredictorInput, ImpactPredictorOutput


# Rough disease prevalence (US) for common repurposing targets
_POPULATION_MAP: dict[str, int] = {
    "lupus": 1_500_000,
    "rheumatoid arthritis": 1_300_000,
    "fibromyalgia": 4_000_000,
    "pulmonary fibrosis": 200_000,
    "psoriasis": 7_500_000,
    "multiple sclerosis": 1_000_000,
    "crohn's disease": 780_000,
    "ulcerative colitis": 900_000,
}
_DEFAULT_POPULATION = 500_000


def _patient_population(proposed_indication: str) -> int:
    key = proposed_indication.strip().lower()
    return _POPULATION_MAP.get(key, _DEFAULT_POPULATION)


def _breakthrough_score(confidence: float, risk_level: str, evidence_count: int) -> float:
    """Higher confidence + lower risk + more evidence → higher breakthrough potential."""
    base = confidence * 0.5
    risk_bonus = {"Low": 0.25, "Medium": 0.15, "High": 0.05}.get(risk_level, 0.10)
    evidence_bonus = min(evidence_count * 0.03, 0.25)
    return round(min(1.0, base + risk_bonus + evidence_bonus), 3)


def _commercial_value(population: int, confidence: float) -> str:
    estimated_revenue = population * 2500 * confidence  # rough $2500/patient/year
    if estimated_revenue >= 5_000_000_000:
        return "Blockbuster (>$5B)"
    if estimated_revenue >= 1_000_000_000:
        return "High ($1B–$5B)"
    if estimated_revenue >= 250_000_000:
        return "Medium ($250M–$1B)"
    return "Niche (<$250M)"


def _impact_score(breakthrough: float, population: int) -> float:
    """0 = no impact, 1 = transformative."""
    pop_factor = min(population / 5_000_000, 1.0) * 0.4
    return round(min(1.0, breakthrough * 0.6 + pop_factor), 3)


def run_impact_predictor(inp: ImpactPredictorInput) -> ImpactPredictorOutput:
    population = _patient_population(inp.proposed_indication)
    breakthrough = _breakthrough_score(inp.confidence, inp.risk_level, inp.evidence_count)
    commercial = _commercial_value(population, inp.confidence)
    impact = _impact_score(breakthrough, population)

    return ImpactPredictorOutput(
        patient_population_size=population,
        expected_breakthrough_score=breakthrough,
        commercial_value_estimate=commercial,
        impact_score=impact,
    )
