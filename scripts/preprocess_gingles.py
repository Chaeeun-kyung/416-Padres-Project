# Gingles chart data: preprocess precinct GeoJSON to extract relevant fields and compute shares
# 2024 Presidential election results and CVAP demographics (2024 ACS)

import argparse
import glob
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path


STATE_FIPS_TO_CODE = {"04": "AZ", "08": "CO"}
DEFAULT_INPUT = "public/geojson/*-precincts-with-results-cvap.geojson"
GROUPS = ["white_pct", "latino_pct"]


def to_number(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def pick_number(props, keys):
    for key in keys:
        number = to_number(props.get(key))
        if number is not None:
            return number
    return None


def clamp01(value):
    return max(0.0, min(1.0, value))


def resolve_pid(props, index):
    for key in ("GEOID", "geoid", "PRECINCT", "precinct", "precinct_id", "pid", "id"):
        value = props.get(key)
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return f"precinct-{index}"


def resolve_state(props):
    for key in ("state", "STATE", "state_code", "STATE_CODE", "postal"):
        value = props.get(key)
        if value is None:
            continue
        code = str(value).strip().upper()
        if len(code) == 2:
            return code
    fips = props.get("STATEFP") or props.get("statefp")
    if fips is None:
        return None
    return STATE_FIPS_TO_CODE.get(str(fips).zfill(2))


def compute_point(props, index, state_code=None):
    dem_votes = pick_number(props, ("votes_dem", "dem_votes", "DEM_VOTES"))
    rep_votes = pick_number(props, ("votes_rep", "rep_votes", "REP_VOTES"))
    if dem_votes is None or rep_votes is None:
        return None

    total_votes = dem_votes + rep_votes
    if total_votes <= 0:
        return None

    total_cvap = pick_number(props, ("CVAP_TOT24", "total_cvap", "CVAP_TOTAL", "TOT_CVAP"))
    white_cvap = pick_number(props, ("CVAP_WHT24", "white_cvap", "CVAP_WHITE"))
    latino_cvap = pick_number(props, ("CVAP_HSP24", "latino_cvap", "CVAP_LATINO", "CVAP_HISP"))
    if total_cvap is None or total_cvap <= 0 or white_cvap is None or latino_cvap is None:
        return None
    if white_cvap < 0 or latino_cvap < 0:
        return None

    row = {
        "pid": resolve_pid(props, index),
        "dem_share": clamp01(dem_votes / total_votes),
        "rep_share": clamp01(rep_votes / total_votes),
        "white_pct": clamp01(white_cvap / total_cvap),
        "latino_pct": clamp01(latino_cvap / total_cvap),
    }
    if state_code is None:
        state_code = resolve_state(props)
    if state_code:
        row["state"] = state_code
    return row


def value_range(rows, field):
    values = [to_number(row.get(field)) for row in rows]
    values = [value for value in values if value is not None]
    if not values:
        return {"min": None, "max": None}
    return {"min": min(values), "max": max(values)}


def write_json(path, payload, compact=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        if compact:
            json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
        else:
            json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def resolve_input_paths(patterns):
    paths = []
    seen = set()
    for raw in patterns:
        pattern = str(raw).strip()
        if not pattern:
            continue

        if any(token in pattern for token in ("*", "?", "[")):
            candidates = [Path(path_text) for path_text in sorted(glob.glob(pattern))]
        else:
            candidate = Path(pattern)
            candidates = sorted(candidate.glob("*.geojson")) if candidate.is_dir() else [candidate]

        for path in candidates:
            key = str(path.resolve()) if path.exists() else str(path)
            if key in seen:
                continue
            seen.add(key)
            paths.append(path)
    return paths


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="Preprocess precinct GeoJSON for Gingles chart.")
    parser.add_argument(
        "--input",
        action="append",
        dest="inputs",
        default=None,
        help=f"Input GeoJSON file/dir/glob (repeatable). Default: {DEFAULT_INPUT}",
    )
    parser.add_argument("--outdir", default="public/data", help="Output directory.")
    return parser.parse_args(argv)


def new_state_bucket():
    return {
        "points": [],
        "inputs": set(),
        "counts": {"features_in_input": 0, "kept": 0, "dropped": 0},
    }


def main(argv=None):
    args = parse_args(argv)
    outdir = Path(args.outdir)
    input_paths = resolve_input_paths(args.inputs or [DEFAULT_INPUT])
    if not input_paths:
        print(f"[error] No input files resolved from: {args.inputs or [DEFAULT_INPUT]}", file=sys.stderr)
        return 1

    points = []
    states = {}
    total_features = 0
    dropped = 0

    for input_path in input_paths:
        if not input_path.exists():
            print(f"[warn] Input file not found (skipping): {input_path}", file=sys.stderr)
            continue
        try:
            with input_path.open("r", encoding="utf-8") as handle:
                geojson = json.load(handle)
        except json.JSONDecodeError as exc:
            print(f"[warn] Invalid JSON in {input_path} (skipping): {exc}", file=sys.stderr)
            continue

        features = geojson.get("features") if isinstance(geojson, dict) else None
        if not isinstance(features, list):
            print(f"[warn] Expected FeatureCollection.features array in {input_path}", file=sys.stderr)
            continue

        total_features += len(features)
        for index, feature in enumerate(features):
            props = feature.get("properties") if isinstance(feature, dict) else None
            if not isinstance(props, dict):
                dropped += 1
                continue

            state_code = resolve_state(props) or "UNKNOWN"
            bucket = states.setdefault(state_code, new_state_bucket())
            bucket["counts"]["features_in_input"] += 1
            bucket["inputs"].add(str(input_path))

            row = compute_point(props, index, None if state_code == "UNKNOWN" else state_code)
            if row is None:
                dropped += 1
                bucket["counts"]["dropped"] += 1
                continue

            bucket["counts"]["kept"] += 1
            bucket["points"].append(row)
            points.append(row)

    if total_features == 0:
        print("[error] No valid GeoJSON features were loaded from input files.", file=sys.stderr)
        return 1

    generated_at = datetime.now(timezone.utc).isoformat()
    write_json(outdir / "gingles_points.json", points, compact=True)
    write_json(
        outdir / "gingles_meta.json",
        {
            "generated_at_utc": generated_at,
            "inputs": [str(path) for path in input_paths],
            "counts": {"features_in_input": total_features, "kept": len(points), "dropped": dropped},
            "ranges": {group: value_range(points, group) for group in ("dem_share", "rep_share", *GROUPS)},
            "groups": GROUPS,
        },
    )

    for state_code in sorted(states):
        state = states[state_code]
        write_json(
            outdir / f"gingles_meta_{state_code}.json",
            {
                "generated_at_utc": generated_at,
                "state": state_code,
                "inputs": sorted(state["inputs"]),
                "counts": state["counts"],
                "ranges": {group: value_range(state["points"], group) for group in ("dem_share", "rep_share", *GROUPS)},
                "groups": GROUPS,
            },
        )

    print(f"[ok] Wrote {len(points)} rows -> {outdir / 'gingles_points.json'}")
    print(f"[ok] Wrote meta -> {outdir / 'gingles_meta.json'}")
    for state_code in sorted(states):
        print(f"[ok] Wrote state meta ({state_code}) -> {outdir / f'gingles_meta_{state_code}.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
