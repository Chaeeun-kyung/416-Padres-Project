#!/usr/bin/env python3
"""
Generate ensemble-boxplot.json for the backend (SeaWulf-6, 7, 11).

For each plan in the merged ensemble:
  - Join precinct assignments with CVAP data (SeaWulf-7)
  - Compute minority % per district for each feasible group
  - Check if district exceeds effectiveness threshold (SeaWulf-6)
  - Rank districts by minority % ascending within the plan

Across all plans, collect ranked-district distributions per group (SeaWulf-11)
and write them to ensemble-boxplot.json.

Output format:
  { "AZ": { "latino_pct": { "raceBlind": { "distributions": {...}, "enacted": {...} },
                            "vraConstrained": { "distributions": {...}, "enacted": {...} } }, ... } }

Run from project root:
    python scripts/generate_ensemble_boxplot.py
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

DEFAULT_INPUT_ROOT = "results/seawulf_inputs"
DEFAULT_OUTPUT = "backend/src/main/resources/ensemble-boxplot.json"
STATES = ("AZ", "CO")
EFFECTIVENESS_THRESHOLD = 0.5
TOTAL_CVAP_FIELD = "CVAP_TOT24"

GROUP_FIELDS = {
    "latino_pct": "CVAP_HSP24",
    "white_pct":  "CVAP_WHT24",
    "black_pct":  "CVAP_BLA24",
}
FEASIBLE_MIN_STATEWIDE_CVAP = 400_000.0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate ensemble-boxplot.json from merged ReCom outputs.")
    parser.add_argument("--input-root", default=DEFAULT_INPUT_ROOT)
    parser.add_argument("--output", default=DEFAULT_OUTPUT)
    parser.add_argument("--states", nargs="+", default=list(STATES))
    parser.add_argument("--threshold", type=float, default=EFFECTIVENESS_THRESHOLD)
    return parser.parse_args()


def load_precinct_attrs(attrs_path: Path) -> list[dict]:
    with attrs_path.open("r", encoding="utf-8") as f:
        return json.load(f)


def feasible_groups(attrs: list[dict]) -> dict[str, str]:
    """Return group_key -> cvap_field for groups with statewide CVAP >= threshold."""
    totals = {key: 0.0 for key in GROUP_FIELDS}
    for row in attrs:
        for key, field in GROUP_FIELDS.items():
            totals[key] += float(row.get(field) or 0.0)
    return {key: GROUP_FIELDS[key] for key, total in totals.items() if total >= FEASIBLE_MIN_STATEWIDE_CVAP}


def build_geoid_lookup(attrs: list[dict]) -> dict[str, dict]:
    """GEOID -> {group_cvap per group, total_cvap, district_number}."""
    lookup = {}
    for row in attrs:
        geoid = str(row.get("GEOID", ""))
        if not geoid:
            continue
        lookup[geoid] = {
            "total_cvap": float(row.get(TOTAL_CVAP_FIELD) or 0.0),
            "district_number": str(row.get("district_number") or ""),
            **{key: float(row.get(field) or 0.0) for key, field in GROUP_FIELDS.items()},
        }
    return lookup


def compute_district_pcts(assignment: dict, geoid_lookup: dict, group_keys: list[str]) -> dict[str, dict[str, float]]:
    """group_key -> district -> minority %"""
    group_sums: dict[str, dict[str, float]] = {g: {} for g in group_keys}
    total_sums: dict[str, float] = {}

    for geoid, district in assignment.items():
        row = geoid_lookup.get(str(geoid))
        if row is None:
            continue
        d = str(district)
        total_sums[d] = total_sums.get(d, 0.0) + row["total_cvap"]
        for g in group_keys:
            group_sums[g][d] = group_sums[g].get(d, 0.0) + row[g]

    result = {}
    for g in group_keys:
        pcts = {}
        for d, g_sum in group_sums[g].items():
            denom = total_sums.get(d, 0.0)
            pcts[d] = g_sum / denom if denom > 0 else 0.0
        result[g] = pcts
    return result


def compute_enacted_pcts(geoid_lookup: dict, group_keys: list[str]) -> dict[str, dict[str, float]]:
    """group_key -> district_number -> minority % (from precinct attributes enacted plan)."""
    group_sums: dict[str, dict[str, float]] = {g: {} for g in group_keys}
    total_sums: dict[str, float] = {}

    for row in geoid_lookup.values():
        d = row["district_number"]
        if not d:
            continue
        total_sums[d] = total_sums.get(d, 0.0) + row["total_cvap"]
        for g in group_keys:
            group_sums[g][d] = group_sums[g].get(d, 0.0) + row[g]

    result = {}
    for g in group_keys:
        pcts = {}
        for d, g_sum in group_sums[g].items():
            denom = total_sums.get(d, 0.0)
            pcts[d] = round(g_sum / denom if denom > 0 else 0.0, 6)
        result[g] = pcts
    return result


def process_plans(state: str, plans: list, geoid_lookup: dict, group_keys: list[str],
                  enacted_pcts: dict, num_districts: int, threshold: float, label: str) -> dict:
    """Process a list of plans and return per-group {distributions, enacted}."""
    rank_values: dict[str, list[list[float]]] = {g: [[] for _ in range(num_districts)] for g in group_keys}
    effectiveness: dict[str, list[int]] = {g: [0] * num_districts for g in group_keys}

    for idx, plan in enumerate(plans):
        if idx % 500 == 0:
            print(f"  {state} [{label}]: plan {idx}/{len(plans)}...")
        assignment = plan.get("assignment", {})
        if not assignment:
            continue
        district_pcts = compute_district_pcts(assignment, geoid_lookup, group_keys)
        for g in group_keys:
            sorted_pcts = sorted(district_pcts[g].values())
            for rank_idx, pct in enumerate(sorted_pcts):
                if rank_idx >= num_districts:
                    break
                rank_values[g][rank_idx].append(round(pct, 6))
                if pct >= threshold:
                    effectiveness[g][rank_idx] += 1

    output = {}
    for g in group_keys:
        enacted_ranked = sorted(enacted_pcts[g].items(), key=lambda x: x[1])
        rank_labels = [f"{state}-{str(i+1).zfill(2)}" for i in range(len(enacted_ranked))]
        enacted_out = {rank_labels[i]: round(enacted_ranked[i][1], 6) for i in range(len(enacted_ranked))}
        distributions = {rank_labels[i]: rank_values[g][i] for i in range(num_districts)}

        print(f"\n  {state} [{label}] {g} effectiveness (threshold={threshold}):")
        for i, lbl in enumerate(rank_labels):
            count = effectiveness[g][i]
            print(f"    {lbl}: {count}/{len(plans)} plans ({count/len(plans)*100:.1f}%) >= threshold")

        output[g] = {"distributions": distributions, "enacted": enacted_out}
    return output


def load_plans_from(path: Path) -> list:
    with path.open("r", encoding="utf-8") as f:
        merged = json.load(f)
    return merged.get("plans", merged) if isinstance(merged, dict) else merged


def process_state(state: str, input_root: Path, threshold: float) -> dict:
    state_dir = input_root / state
    attrs_path = state_dir / f"{state}_precinct_attributes.json"
    rb_path = state_dir / f"recom_parallel_merged_{state}.json"
    vra_path = state_dir / f"recom_parallel_merged_{state}_vra.json"

    print(f"\n{state}: loading precinct attributes...")
    attrs = load_precinct_attrs(attrs_path)
    geoid_lookup = build_geoid_lookup(attrs)

    active_groups = feasible_groups(attrs)
    group_keys = list(active_groups.keys())
    print(f"{state}: feasible groups: {group_keys}")

    enacted_pcts = compute_enacted_pcts(geoid_lookup, group_keys)
    num_districts = len(next(iter(enacted_pcts.values())))
    print(f"{state}: {num_districts} enacted districts")

    # state output: group -> ensembleKey -> {distributions, enacted}
    state_output: dict[str, dict] = {g: {} for g in group_keys}

    # Race-blind
    print(f"{state}: loading race-blind plans...")
    rb_plans = load_plans_from(rb_path)
    print(f"{state}: {len(rb_plans)} race-blind plans")
    rb_result = process_plans(state, rb_plans, geoid_lookup, group_keys, enacted_pcts, num_districts, threshold, "raceBlind")
    for g in group_keys:
        state_output[g]["raceBlind"] = rb_result[g]

    # VRA-constrained (optional)
    if vra_path.exists():
        print(f"{state}: loading VRA-constrained plans...")
        vra_plans = load_plans_from(vra_path)
        print(f"{state}: {len(vra_plans)} VRA-constrained plans")
        vra_result = process_plans(state, vra_plans, geoid_lookup, group_keys, enacted_pcts, num_districts, threshold, "vraConstrained")
        for g in group_keys:
            state_output[g]["vraConstrained"] = vra_result[g]
    else:
        print(f"{state}: VRA merged file not found, skipping vraConstrained")
        for g in group_keys:
            state_output[g]["vraConstrained"] = {"distributions": {}, "enacted": {}}

    return state_output


def main() -> None:
    args = parse_args()
    input_root = Path(args.input_root)
    output_path = Path(args.output)

    result = {}
    for state in args.states:
        result[state.upper()] = process_state(state.upper(), input_root, args.threshold)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)
        f.write("\n")
    print(f"\nSaved to {output_path}")


if __name__ == "__main__":
    main()
