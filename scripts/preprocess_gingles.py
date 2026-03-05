# Gingles chart data: preprocess precinct GeoJSON to extract relevant fields and compute shares
# 2024 Presidential election results and CVAP demographics (2024 ACS)

from __future__ import annotations

import argparse
import glob
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Optional


STATE_FIPS_TO_CODE = {
    "04": "AZ",
    "08": "CO",
}
DEFAULT_INPUT = "public/geojson/*-precincts-with-results-cvap.geojson"


def safe_float(value: object) -> Optional[float]:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(number) or math.isinf(number):
        return None
    return number


def first_number(props: Dict[str, object], keys: Iterable[str]) -> Optional[float]:
    for key in keys:
        if key not in props:
            continue
        number = safe_float(props.get(key))
        if number is not None:
            return number
    return None


def clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def resolve_pid(props: Dict[str, object], index: int) -> str:
    for key in ("GEOID", "geoid", "PRECINCT", "precinct", "precinct_id", "pid", "id"):
        raw = props.get(key)
        if raw is None:
            continue
        text = str(raw).strip()
        if text:
            return text
    return f"precinct-{index}"


def resolve_state(props: Dict[str, object]) -> Optional[str]:
    for key in ("state", "STATE", "state_code", "STATE_CODE", "postal"):
        raw = props.get(key)
        if raw is None:
            continue
        text = str(raw).strip().upper()
        if len(text) == 2:
            return text

    state_fips = props.get("STATEFP") or props.get("statefp")
    if state_fips is not None:
        return STATE_FIPS_TO_CODE.get(str(state_fips).zfill(2))
    return None


def compute_point(props: Dict[str, object], index: int) -> Optional[Dict[str, object]]:
    dem_votes = first_number(props, ("votes_dem", "dem_votes", "DEM_VOTES"))
    rep_votes = first_number(props, ("votes_rep", "rep_votes", "REP_VOTES"))
    if dem_votes is None or rep_votes is None:
        return None

    total_votes = dem_votes + rep_votes
    if total_votes <= 0:
        return None

    total_cvap = first_number(props, ("CVAP_TOT24", "total_cvap", "CVAP_TOTAL", "TOT_CVAP"))
    if total_cvap is None or total_cvap <= 0:
        return None

    white_cvap = first_number(props, ("CVAP_WHT24", "white_cvap", "CVAP_WHITE"))
    latino_cvap = first_number(props, ("CVAP_HSP24", "latino_cvap", "CVAP_LATINO", "CVAP_HISP"))
    if white_cvap is None or latino_cvap is None:
        return None
    if white_cvap < 0 or latino_cvap < 0:
        return None

    row: Dict[str, object] = {
        "pid": resolve_pid(props, index),
        "dem_share": clamp01(dem_votes / total_votes),
        "rep_share": clamp01(rep_votes / total_votes),
        "white_pct": clamp01(white_cvap / total_cvap),
        "latino_pct": clamp01(latino_cvap / total_cvap),
    }

    state_code = resolve_state(props)
    if state_code:
        row["state"] = state_code
    return row


def value_range(rows: List[Dict[str, object]], field: str) -> Dict[str, Optional[float]]:
    values: List[float] = []
    for row in rows:
        number = safe_float(row.get(field))
        if number is not None:
            values.append(number)
    if not values:
        return {"min": None, "max": None}
    return {"min": min(values), "max": max(values)}


def write_json(path: Path, payload: object, pretty: bool = True) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        if pretty:
            json.dump(payload, handle, indent=2, ensure_ascii=False)
        else:
            json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
        handle.write("\n")


def normalize_state_code(value: object) -> str:
    text = str(value or "").strip().upper()
    return text if len(text) == 2 else "UNKNOWN"


def resolve_input_paths(input_patterns: List[str]) -> List[Path]:
    paths: List[Path] = []
    seen: set[str] = set()

    for pattern in input_patterns:
        pattern = str(pattern).strip()
        if not pattern:
            continue

        matched_paths: List[Path] = []
        wildcard_hit = any(token in pattern for token in ("*", "?", "["))
        if wildcard_hit:
            matched_paths = [Path(path_text) for path_text in sorted(glob.glob(pattern))]
        else:
            candidate = Path(pattern)
            if candidate.is_dir():
                matched_paths = sorted(candidate.glob("*.geojson"))
            else:
                matched_paths = [candidate]

        for path in matched_paths:
            key = str(path.resolve()) if path.exists() else str(path)
            if key in seen:
                continue
            seen.add(key)
            paths.append(path)

    return paths


def load_geojson_features(path: Path) -> List[Dict[str, object]]:
    with path.open("r", encoding="utf-8") as handle:
        geojson = json.load(handle)
    features = geojson.get("features") if isinstance(geojson, dict) else None
    if not isinstance(features, list):
        raise ValueError(f"Expected FeatureCollection.features array in {path}")
    return features


def parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Preprocess precinct GeoJSON for Gingles chart.")
    parser.add_argument(
        "--input",
        action="append",
        dest="inputs",
        default=None,
        help=(
            "Input precinct GeoJSON file, directory, or glob pattern. "
            f"Repeatable. Default: {DEFAULT_INPUT}"
        ),
    )
    parser.add_argument(
        "--outdir",
        default="public/data",
        help="Output directory (default: public/data).",
    )
    return parser.parse_args(argv)


def main(argv: Optional[List[str]] = None) -> int:
    args = parse_args(argv)
    outdir = Path(args.outdir)
    input_patterns = args.inputs if args.inputs else [DEFAULT_INPUT]
    input_paths = resolve_input_paths(input_patterns)

    if not input_paths:
        print(f"[error] No input files resolved from: {input_patterns}", file=sys.stderr)
        return 1

    points: List[Dict[str, object]] = []
    points_by_state: Dict[str, List[Dict[str, object]]] = {}
    state_inputs: Dict[str, set[str]] = {}
    total_features_in_input = 0
    dropped = 0
    state_counts: Dict[str, Dict[str, int]] = {}

    def ensure_state_bucket(state_code: str) -> None:
        if state_code not in state_counts:
            state_counts[state_code] = {
                "features_in_input": 0,
                "kept": 0,
                "dropped": 0,
            }
        if state_code not in points_by_state:
            points_by_state[state_code] = []
        if state_code not in state_inputs:
            state_inputs[state_code] = set()

    for input_path in input_paths:
        if not input_path.exists():
            print(f"[warn] Input file not found (skipping): {input_path}", file=sys.stderr)
            continue
        try:
            features = load_geojson_features(input_path)
        except json.JSONDecodeError as exc:
            print(f"[warn] Invalid JSON in {input_path} (skipping): {exc}", file=sys.stderr)
            continue
        except ValueError as exc:
            print(f"[warn] {exc}", file=sys.stderr)
            continue

        total_features_in_input += len(features)
        for index, feature in enumerate(features):
            props = feature.get("properties") if isinstance(feature, dict) else None
            if not isinstance(props, dict):
                dropped += 1
                continue

            inferred_state = normalize_state_code(resolve_state(props))
            ensure_state_bucket(inferred_state)
            state_counts[inferred_state]["features_in_input"] += 1
            state_inputs[inferred_state].add(str(input_path))

            row = compute_point(props, index)
            if row is None:
                dropped += 1
                state_counts[inferred_state]["dropped"] += 1
                continue
            row_state = normalize_state_code(row.get("state") if isinstance(row, dict) else inferred_state)
            ensure_state_bucket(row_state)
            state_counts[row_state]["kept"] += 1
            state_inputs[row_state].add(str(input_path))
            points_by_state[row_state].append(row)
            points.append(row)

    if total_features_in_input == 0:
        print("[error] No valid GeoJSON features were loaded from input files.", file=sys.stderr)
        return 1

    points_path = outdir / "gingles_points.json"
    meta_path = outdir / "gingles_meta.json"

    write_json(points_path, points, pretty=False)
    generated_at_utc = datetime.now(timezone.utc).isoformat()
    meta = {
        "generated_at_utc": generated_at_utc,
        "inputs": [str(path) for path in input_paths],
        "counts": {
            "features_in_input": total_features_in_input,
            "kept": len(points),
            "dropped": dropped,
        },
        "ranges": {
            "dem_share": value_range(points, "dem_share"),
            "rep_share": value_range(points, "rep_share"),
            "white_pct": value_range(points, "white_pct"),
            "latino_pct": value_range(points, "latino_pct"),
        },
        "groups": ["white_pct", "latino_pct"],
    }
    write_json(meta_path, meta, pretty=True)

    for state_code in sorted(state_counts.keys()):
        state_points = points_by_state.get(state_code, [])
        state_meta_path = outdir / f"gingles_meta_{state_code}.json"
        state_meta = {
            "generated_at_utc": generated_at_utc,
            "state": state_code,
            "inputs": sorted(state_inputs.get(state_code, [])),
            "counts": state_counts[state_code],
            "ranges": {
                "dem_share": value_range(state_points, "dem_share"),
                "rep_share": value_range(state_points, "rep_share"),
                "white_pct": value_range(state_points, "white_pct"),
                "latino_pct": value_range(state_points, "latino_pct"),
            },
            "groups": ["white_pct", "latino_pct"],
        }
        write_json(state_meta_path, state_meta, pretty=True)

    print(f"[ok] Wrote {len(points)} rows -> {points_path}")
    print(f"[ok] Wrote meta -> {meta_path}")
    for state_code in sorted(state_counts.keys()):
        print(f"[ok] Wrote state meta ({state_code}) -> {outdir / f'gingles_meta_{state_code}.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
