#!/usr/bin/env python3
"""
Generate ensemble-splits.json for the backend from merged ReCom output files.

Reads race-blind and (optionally) VRA-constrained merged plan files and
counts how many plans produced each Republican/Democratic seat split.

Run from project root:
    python scripts/generate_ensemble_splits.py
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

DEFAULT_INPUT_ROOT = "results/seawulf_inputs"
DEFAULT_OUTPUT = "backend/src/main/resources/ensemble-splits.json"
STATES = ("AZ", "CO")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate ensemble-splits.json from merged ReCom outputs.")
    parser.add_argument("--input-root", default=DEFAULT_INPUT_ROOT, help="Root directory containing per-state merged files.")
    parser.add_argument("--output", default=DEFAULT_OUTPUT, help="Output path for ensemble-splits.json.")
    parser.add_argument("--states", nargs="+", default=list(STATES), help="States to process.")
    return parser.parse_args()


def load_plans(merged_path: Path) -> list:
    with merged_path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    return data.get("plans", data) if isinstance(data, dict) else data


def compute_splits(plans: list) -> list:
    counts: Counter = Counter()
    for plan in plans:
        r_wins = plan.get("split", {}).get("R", 0)
        counts[int(r_wins)] += 1
    return [{"repWins": r, "freq": counts[r]} for r in sorted(counts)]


def main() -> None:
    args = parse_args()
    input_root = Path(args.input_root)
    output_path = Path(args.output)
    result = {}

    for state in args.states:
        state = state.upper()
        result[state] = {}

        # Race-blind
        rb_path = input_root / state / f"recom_parallel_merged_{state}.json"
        if rb_path.exists():
            plans = load_plans(rb_path)
            result[state]["raceBlind"] = compute_splits(plans)
            print(f"{state} race-blind: {len(plans)} plans, splits: {result[state]['raceBlind']}")
        else:
            print(f"WARNING: {rb_path} not found, skipping race-blind for {state}")
            result[state]["raceBlind"] = []

        # VRA-constrained (optional - only present if that run has been done)
        vra_path = input_root / state / f"recom_parallel_merged_{state}_vra.json"
        if vra_path.exists():
            plans = load_plans(vra_path)
            result[state]["vraConstrained"] = compute_splits(plans)
            print(f"{state} VRA-constrained: {len(plans)} plans, splits: {result[state]['vraConstrained']}")
        else:
            print(f"NOTE: {vra_path} not found — vraConstrained left empty for {state}")
            result[state]["vraConstrained"] = []

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)
        f.write("\n")
    print(f"\nSaved to {output_path}")


if __name__ == "__main__":
    main()
