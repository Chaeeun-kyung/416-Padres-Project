#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Iterable


DEFAULT_INPUT_GLOB = "public/geojson/*-precincts-with-results-cvap-with-enacted-districts.geojson"
DEFAULT_OUTPUT = "backend/src/main/resources/enacted-boxplot.json"
DEFAULT_MIN_STATEWIDE_GROUP_POPULATION = 400_000.0

GROUP_SPECS = [
    {
        "key": "white_pct",
        "label": "White",
        "count_keys": ("CVAP_WHT24", "CVAP_WHITE", "white_cvap"),
        "pct_keys": ("PCT_CVAP_WHT", "white_pct"),
    },
    {
        "key": "black_pct",
        "label": "Black",
        "count_keys": ("CVAP_BLA24", "CVAP_BLACK", "black_cvap"),
        "pct_keys": ("PCT_CVAP_BLA", "black_pct"),
    },
    {
        "key": "latino_pct",
        "label": "Latino",
        "count_keys": ("CVAP_HSP24", "CVAP_HISP", "CVAP_LATINO", "latino_cvap"),
        "pct_keys": ("PCT_CVAP_HSP", "latino_pct"),
    },
    {
        "key": "asian_pct",
        "label": "Asian",
        "count_keys": ("CVAP_ASI24", "CVAP_ASIAN", "asian_cvap"),
        "pct_keys": ("PCT_CVAP_ASI", "asian_pct"),
    },
]

GROUP_BY_KEY = {spec["key"]: spec for spec in GROUP_SPECS}


def parse_args(argv: Iterable[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Prepro-11: compute enacted-plan district minority percentages for boxplot dots."
    )
    parser.add_argument(
        "--input-glob",
        default=DEFAULT_INPUT_GLOB,
        help=f"Glob pattern for enacted precinct geojson files (default: {DEFAULT_INPUT_GLOB}).",
    )
    parser.add_argument(
        "--output",
        default=DEFAULT_OUTPUT,
        help=f"Output JSON path (default: {DEFAULT_OUTPUT}).",
    )
    parser.add_argument(
        "--min-statewide-group-population",
        type=float,
        default=DEFAULT_MIN_STATEWIDE_GROUP_POPULATION,
        help=(
            "Minimum statewide group CVAP count for feasibility "
            f"(default: {DEFAULT_MIN_STATEWIDE_GROUP_POPULATION})."
        ),
    )
    return parser.parse_args(argv)


def to_number(value):
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        number = float(value)
    else:
        try:
            number = float(str(value).strip())
        except Exception:
            return None
    if number != number:
        return None
    if number in (float("inf"), float("-inf")):
        return None
    return number


def clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def pick_number(props, keys):
    for key in keys:
        number = to_number(props.get(key))
        if number is not None:
            return number
    return None


def pick_share(props, keys):
    for key in keys:
        number = to_number(props.get(key))
        if number is None:
            continue
        if 1.0 < number <= 100.0:
            number /= 100.0
        return clamp01(number)
    return None


def normalize_state_code(path: Path, props: dict) -> str | None:
    raw_state = str(props.get("state") or "").strip().upper()
    if len(raw_state) == 2 and raw_state.isalpha():
        return raw_state
    stem = path.name.split("-", 1)[0].strip().upper()
    if len(stem) == 2 and stem.isalpha():
        return stem
    return None


def normalize_district_number(value) -> str | None:
    text = str(value or "").strip()
    if not text:
        return None
    digits = "".join(ch for ch in text if ch.isdigit())
    if digits:
        return digits[-2:].zfill(2)
    return None


def infer_district_number(props: dict) -> str | None:
    district_number = normalize_district_number(props.get("district_number"))
    if district_number:
        return district_number

    district_id = normalize_district_number(props.get("district_id"))
    if district_id:
        return district_id

    district_name = str(props.get("district_name") or "").strip()
    if district_name:
        extracted = normalize_district_number(district_name)
        if extracted:
            return extracted
    return None


def district_label(state_code: str, district_number: str) -> str:
    return f"{state_code}-{district_number}"


def resolve_group_population(props: dict, total_cvap: float, spec: dict) -> float:
    count = pick_number(props, spec["count_keys"])
    share = pick_share(props, spec["pct_keys"])

    if count is None and share is not None:
        count = share * total_cvap
    if count is None:
        count = 0.0
    return max(0.0, min(float(count), total_cvap))


def choose_feasible_groups(statewide_group_population: dict[str, float], threshold: float) -> list[str]:
    feasible = [
        key
        for key in GROUP_BY_KEY
        if statewide_group_population.get(key, 0.0) >= threshold
    ]
    if feasible:
        return feasible

    ranked = sorted(
        GROUP_BY_KEY,
        key=lambda key: statewide_group_population.get(key, 0.0),
        reverse=True,
    )
    fallback = [key for key in ranked if statewide_group_population.get(key, 0.0) > 0.0]
    return fallback[:2]


def process_file(path: Path, threshold: float):
    with path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)

    features = payload.get("features") or []
    district_totals: dict[str, dict] = {}
    statewide_group_population = {key: 0.0 for key in GROUP_BY_KEY}
    state_code = None

    for feature in features:
        props = feature.get("properties") or {}
        current_state = normalize_state_code(path, props)
        if current_state:
            state_code = current_state
        if not current_state:
            continue

        district_number = infer_district_number(props)
        if not district_number:
            continue
        district_id = district_label(current_state, district_number)

        total_cvap = pick_number(props, ("CVAP_TOT24", "CVAP_TOTAL", "TOT_CVAP", "total_cvap"))
        if total_cvap is None or total_cvap <= 0:
            continue

        district_bucket = district_totals.setdefault(
            district_id,
            {
                "total_cvap": 0.0,
                "group_population": {key: 0.0 for key in GROUP_BY_KEY},
            },
        )
        district_bucket["total_cvap"] += float(total_cvap)

        for spec in GROUP_SPECS:
            key = spec["key"]
            count = resolve_group_population(props, float(total_cvap), spec)
            district_bucket["group_population"][key] += count
            statewide_group_population[key] += count

    if not state_code:
        return None, None

    feasible_groups = choose_feasible_groups(statewide_group_population, max(0.0, threshold))
    groups_payload = {}

    for group_key in feasible_groups:
        enacted = {}
        for district_id, totals in district_totals.items():
            total = float(totals["total_cvap"])
            if total <= 0:
                continue
            group_total = float(totals["group_population"].get(group_key, 0.0))
            enacted[district_id] = clamp01(group_total / total)

        district_order = [
            district_id
            for district_id, _ in sorted(
                enacted.items(),
                key=lambda item: (item[1], item[0]),
            )
        ]

        groups_payload[group_key] = {
            "label": GROUP_BY_KEY[group_key]["label"],
            "districtOrder": district_order,
            "enacted": {district_id: enacted[district_id] for district_id in district_order},
        }

    return state_code, {"groups": groups_payload}


def main(argv: Iterable[str] | None = None) -> int:
    args = parse_args(argv)
    input_paths = sorted(Path().glob(args.input_glob))
    if not input_paths:
        print(f"[error] No files matched: {args.input_glob}")
        return 1

    result = {}
    for path in input_paths:
        state_code, state_payload = process_file(path, args.min_statewide_group_population)
        if not state_code or not state_payload:
            print(f"[warn] Skipped: {path}")
            continue
        result[state_code] = state_payload
        print(f"[ok] {state_code}: {len(state_payload['groups'])} feasible group(s)")

    if not result:
        print("[error] No enacted boxplot data generated.")
        return 1

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as handle:
        json.dump(result, handle, indent=2)
        handle.write("\n")

    print(f"[ok] Wrote Prepro-11 enacted boxplot dots -> {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
