# Gingles chart data: preprocess precinct GeoJSON to extract relevant fields, compute.
# chart-ready samples, and precompute regression metadata for the backend.
# 2024 Presidential election results and CVAP demographics (2024 ACS).

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
GROUP_LABELS = {"white_pct": "White", "latino_pct": "Latino"}
TREND_DEGREE = 3
TREND_POINT_COUNT = 90

# Convert raw property values safely into finite numbers.
# Keep share values in [0, 1] so downstream chart math stays stable.

def to_number(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None

# Find valid keys for a desired numeric property, since different sources use different schemas.
def pick_number(props, keys):
    for key in keys:
        number = to_number(props.get(key))
        if number is not None:
            return number
    return None

# Range: 0~1.
def clamp01(value):
    return max(0.0, min(1.0, value))
  
# Return all rows for chart rendering (GUI-9 requires plotting all precinct points).
def rows_for_render(rows):
    if not isinstance(rows, list):
        return []
    return list(rows)

# Build cubic regression curves for Dem/Rep shares against group CVAP share.
# Uses a small linear-system solver so preprocessing remains self-contained.

# This function solves the normal-equation system used to fit the polynomial trend line coefficients.
# It uses Gaussian elimination.
def solve_linear_system(matrix, vector):
    n = len(vector)
    augmented = [list(row) + [vector[index]] for index, row in enumerate(matrix)]

    for pivot in range(n):
        max_row = pivot
        max_abs = abs(augmented[pivot][pivot])
        for row in range(pivot + 1, n):
            abs_value = abs(augmented[row][pivot])
            if abs_value > max_abs:
                max_abs = abs_value
                max_row = row

        if max_abs <= 1e-12:
            return None

        if max_row != pivot:
            augmented[pivot], augmented[max_row] = augmented[max_row], augmented[pivot]

        pivot_value = augmented[pivot][pivot]
        for col in range(pivot, n + 1):
            augmented[pivot][col] /= pivot_value

        for row in range(n):
            if row == pivot:
                continue
            factor = augmented[row][pivot]
            for col in range(pivot, n + 1):
                augmented[row][col] -= factor * augmented[pivot][col]

    return [augmented[row][n] for row in range(n)]

# Fit a polynomial of the given degree to the points, using the specified value key for y-values.
def fit_polynomial(points, value_key, degree):
    size = degree + 1
    matrix = [[0.0 for _ in range(size)] for _ in range(size)]
    vector = [0.0 for _ in range(size)]

    for point in points:
        x = point["x"]
        y = point[value_key]
        powers = [1.0]
        for _ in range(1, size * 2):
            powers.append(powers[-1] * x)

        for row in range(size):
            for col in range(size):
                matrix[row][col] += powers[row + col]
            vector[row] += y * powers[row]

    return solve_linear_system(matrix, vector)


def evaluate_polynomial(coefficients, x):
    result = 0.0
    power = 1.0
    for coefficient in coefficients:
        result += coefficient * power
        power *= x
    return result

# Build trend rows for a state/group by fitting polynomial curves and evaluating them at regular x intervals.
# This helps the frontend render smooth trend lines without needing to fit polynomials in-browser, which can be expensive.
def build_trend_rows(rows, group):
    fit_points = []
    for row in rows:
        x = to_number(row.get(group))
        dem = to_number(row.get("dem_share"))
        rep = to_number(row.get("rep_share"))
        if x is None or dem is None or rep is None:
            continue
        fit_points.append({"x": x, "dem": dem, "rep": rep})

    if len(fit_points) < TREND_DEGREE + 1:
        return {"dem_coefficients": [], "rep_coefficients": [], "trend_rows": []}

    dem_coefficients = fit_polynomial(fit_points, "dem", TREND_DEGREE)
    rep_coefficients = fit_polynomial(fit_points, "rep", TREND_DEGREE)
    if dem_coefficients is None or rep_coefficients is None:
        return {"dem_coefficients": [], "rep_coefficients": [], "trend_rows": []}

    trend_rows = []
    for index in range(TREND_POINT_COUNT):
        x = index / (TREND_POINT_COUNT - 1)
        dem_trend = clamp01(evaluate_polynomial(dem_coefficients, x)) * 100.0
        rep_trend = clamp01(evaluate_polynomial(rep_coefficients, x)) * 100.0
        trend_rows.append(
            {
                "x": x * 100.0,
                "demTrendPct": dem_trend,
                "repTrendPct": rep_trend,
            }
        )

    return {
        "dem_coefficients": dem_coefficients,
        "rep_coefficients": rep_coefficients,
        "trend_rows": trend_rows,
    }

# Convert full precinct points + trend rows into API-ready state/group objects.
# Output shape matches backend Gingles response contract.

def build_backend_group(rows, group):
    render_rows = rows_for_render(rows)
    points = []
    for row in render_rows:
        x = to_number(row.get(group))
        dem_share = to_number(row.get("dem_share"))
        rep_share = to_number(row.get("rep_share"))
        pid = row.get("pid")
        if x is None or dem_share is None or rep_share is None:
            continue
        points.append(
            {
                "pid": pid,
                "x": x * 100.0,
                "demSharePct": dem_share * 100.0,
                "repSharePct": rep_share * 100.0,
            }
        )

    trend = build_trend_rows(rows, group)
    return {
        "label": GROUP_LABELS.get(group, group),
        "modelType": "cubic_polynomial",
        "totalPointCount": len(rows),
        "renderPointCount": len(points),
        "demCoefficients": trend["dem_coefficients"],
        "repCoefficients": trend["rep_coefficients"],
        "points": points,
        "trendRows": trend["trend_rows"],
    }

# Make sure backend payload is structured by state and group, with sampled points and pre-fitted trend data for each group.
def build_backend_payload(states):
    payload = {}
    for state_code, state in sorted(states.items()):
        rows = state["points"]
        payload[state_code] = {
            "groups": {
                group: build_backend_group(rows, group)
                for group in GROUPS
            }
        }
    return payload

# GeoJSON property extraction
# Resolve IDs/state codes from heterogeneous source field names.
# Compute one normalized precinct row used by all downstream outputs.

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

# Compute row values for a precinct, extracting and normalizing vote shares and CVAP demographics.
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

# Handle stable JSON writing and flexible input path resolution.
# Support file, directory, and glob inputs.

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
    parser.add_argument(
        "--backend-output",
        default="backend/src/main/resources/gingles-analysis.json",
        help="Backend output JSON file for precomputed Gingles analysis.",
    )
    return parser.parse_args(argv)


def new_state_bucket():
    return {
        "points": [],
        "inputs": set(),
        "counts": {"features_in_input": 0, "kept": 0, "dropped": 0},
    }

# Main preprocessing pipeline
# 1. Resolve input GeoJSON files
# 2. Parse and normalize precinct rows
# 3. Emit compact point/meta artifacts for frontend inspection
# 4. Emit backend analysis payload used by API responses

def main(argv=None):
    args = parse_args(argv)
    outdir = Path(args.outdir)
    backend_output = Path(args.backend_output)
    input_paths = resolve_input_paths(args.inputs or [DEFAULT_INPUT])
    if not input_paths:
        print(f"[error] No input files resolved from: {args.inputs or [DEFAULT_INPUT]}", file=sys.stderr)
        return 1

    points = []
    states = {}
    total_features = 0
    dropped = 0

    for input_path in input_paths:
        # Load one GeoJSON input and stream features into state buckets.
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
        # Write per-state summary metadata to help validate preprocessing quality.
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

    write_json(
        backend_output,
        {
            "generated_at_utc": generated_at,
            "states": build_backend_payload(states),
        },
    )

    print(f"[ok] Wrote {len(points)} rows -> {outdir / 'gingles_points.json'}")
    print(f"[ok] Wrote meta -> {outdir / 'gingles_meta.json'}")
    for state_code in sorted(states):
        print(f"[ok] Wrote state meta ({state_code}) -> {outdir / f'gingles_meta_{state_code}.json'}")
    print(f"[ok] Wrote backend analysis -> {backend_output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
