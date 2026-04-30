# Gingles preprocessing
# Build precinct-level race-vote/minority-share points, infer feasible groups by statewide CVAP,
# fit non-linear trend curves per group, and write frontend/backend JSON artifacts.

import argparse
import glob
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

STATE_FIPS_TO_CODE = {"04": "AZ", "08": "CO"}
DEFAULT_INPUT = "public/geojson/*-precincts-with-results-cvap.geojson"
FEASIBLE_GROUP_MIN_CVAP = 400_000.0
TREND_POINT_COUNT = 90

GROUP_DEFINITIONS = [
    {
        "key": "white_pct",
        "label": "White",
        "population_keys": ("CVAP_WHT24", "CVAP_WHT", "white_cvap", "CVAP_WHITE"),
    },
    {
        "key": "latino_pct",
        "label": "Latino",
        "population_keys": ("CVAP_HSP24", "CVAP_HSP", "latino_cvap", "CVAP_LATINO", "CVAP_HISP"),
    },
    {
        "key": "black_pct",
        "label": "Black",
        "population_keys": ("CVAP_BLA24", "CVAP_BLA", "black_cvap", "CVAP_BLACK"),
    },
    {
        "key": "asian_pct",
        "label": "Asian",
        "population_keys": ("CVAP_ASI24", "CVAP_ASI", "asian_cvap", "CVAP_ASIAN"),
    },
]

GROUPS = [group["key"] for group in GROUP_DEFINITIONS]
GROUP_LABELS = {group["key"]: group["label"] for group in GROUP_DEFINITIONS}

MODEL_KEYS = (
    "cubic_polynomial",
    "logit_linear",
)


def to_number(value):
    # Parse numeric values defensively; reject NaN/inf to avoid model instability.
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def pick_number(props, keys):
    # Field precedence resolver for heterogeneous source schemas.
    for key in keys:
        number = to_number(props.get(key))
        if number is not None:
            return number
    return None


def clamp01(value):
    return max(0.0, min(1.0, value))


def clamp_probability(value, epsilon=1e-6):
    # Keep probabilities away from exact 0/1 for logit model stability.
    bounded = clamp01(value)
    if bounded <= epsilon:
        return epsilon
    if bounded >= 1.0 - epsilon:
        return 1.0 - epsilon
    return bounded


def solve_linear_system(matrix, vector):
    # Gaussian elimination with partial pivoting for least-squares normal equations.
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


def model_basis(model_key, x):
    # Basis functions for supported non-linear regression model families.
    safe_x = clamp01(x)
    if model_key == "quadratic_polynomial":
        return [1.0, safe_x, safe_x * safe_x]
    if model_key == "cubic_polynomial":
        squared = safe_x * safe_x
        return [1.0, safe_x, squared, squared * safe_x]
    if model_key == "quartic_polynomial":
        squared = safe_x * safe_x
        cubed = squared * safe_x
        return [1.0, safe_x, squared, cubed, cubed * safe_x]
    if model_key == "logit_linear":
        return [1.0, safe_x]
    if model_key == "square_root_curve":
        return [1.0, math.sqrt(safe_x)]
    return None


def fit_model(points, y_key, model_key):
    # Fit coefficients for one party curve under a chosen model type.
    if model_key == "logit_linear":
        if len(points) < 2:
            return None

        matrix = [[0.0, 0.0], [0.0, 0.0]]
        vector = [0.0, 0.0]
        for point in points:
            x = clamp01(point["x"])
            y = clamp_probability(point[y_key])
            logit_y = math.log(y / (1.0 - y))
            basis = [1.0, x]
            for row in range(2):
                for col in range(2):
                    matrix[row][col] += basis[row] * basis[col]
                vector[row] += logit_y * basis[row]

        coefficients = solve_linear_system(matrix, vector)
        if coefficients is None:
            return None
        for value in coefficients:
            if not math.isfinite(value):
                return None
        return coefficients

    sample_basis = model_basis(model_key, 0.5)
    if not sample_basis:
        return None

    size = len(sample_basis)
    if len(points) < size:
        return None

    matrix = [[0.0 for _ in range(size)] for _ in range(size)]
    vector = [0.0 for _ in range(size)]

    for point in points:
        basis = model_basis(model_key, point["x"])
        if basis is None:
            return None

        y_value = point[y_key]
        for row in range(size):
            for col in range(size):
                matrix[row][col] += basis[row] * basis[col]
            vector[row] += y_value * basis[row]

    coefficients = solve_linear_system(matrix, vector)
    if coefficients is None:
        return None

    for value in coefficients:
        if not math.isfinite(value):
            return None
    return coefficients


def predict_model(model_key, coefficients, x):
    # Evaluate fitted model at x; returns probability in [0,1]-like range before clamping.
    if model_key == "logit_linear":
        if len(coefficients) != 2:
            return None
        safe_x = clamp01(x)
        z = coefficients[0] + coefficients[1] * safe_x
        # Stable sigmoid evaluation for large |z|.
        if z >= 0:
            exp_neg = math.exp(-z)
            return 1.0 / (1.0 + exp_neg)
        exp_pos = math.exp(z)
        return exp_pos / (1.0 + exp_pos)

    basis = model_basis(model_key, x)
    if basis is None or len(basis) != len(coefficients):
        return None

    result = 0.0
    for coefficient, term in zip(coefficients, basis):
        result += coefficient * term
    return result


def compute_rmse(points, y_key, model_key, coefficients):
    # Compute fit error to compare candidate model types.
    if not points:
        return None

    squared_error_sum = 0.0
    count = 0
    for point in points:
        predicted = predict_model(model_key, coefficients, point["x"])
        if predicted is None:
            return None

        error = point[y_key] - predicted
        squared_error_sum += error * error
        count += 1

    if count == 0:
        return None
    return math.sqrt(squared_error_sum / count)


def select_best_model(fit_points):
    # Try all enabled model families and keep the lowest combined DEM+REP RMSE.
    best_choice = None
    candidates = []

    for model_key in MODEL_KEYS:
        dem_coefficients = fit_model(fit_points, "dem", model_key)
        rep_coefficients = fit_model(fit_points, "rep", model_key)
        if dem_coefficients is None or rep_coefficients is None:
            continue

        dem_rmse = compute_rmse(fit_points, "dem", model_key, dem_coefficients)
        rep_rmse = compute_rmse(fit_points, "rep", model_key, rep_coefficients)
        if dem_rmse is None or rep_rmse is None:
            continue

        total_rmse = dem_rmse + rep_rmse
        entry = {
            "modelType": model_key,
            "demRmse": dem_rmse,
            "repRmse": rep_rmse,
            "totalRmse": total_rmse,
        }
        candidates.append(entry)

        if best_choice is None or total_rmse < best_choice["totalRmse"]:
            best_choice = {
                "modelType": model_key,
                "demCoefficients": dem_coefficients,
                "repCoefficients": rep_coefficients,
                "demRmse": dem_rmse,
                "repRmse": rep_rmse,
                "totalRmse": total_rmse,
            }

    candidates.sort(key=lambda row: row["totalRmse"])
    return best_choice, candidates


def build_trend_rows(rows, group):
    # Collect valid points for this group and select a regression model.
    fit_points = []
    for row in rows:
        x = to_number(row.get(group))
        dem = to_number(row.get("dem_share"))
        rep = to_number(row.get("rep_share"))
        if x is None or dem is None or rep is None:
            continue
        fit_points.append({"x": clamp01(x), "dem": clamp01(dem), "rep": clamp01(rep)})

    best_choice, candidates = select_best_model(fit_points)
    if best_choice is None:
        return {
            "model_type": "none",
            "dem_coefficients": [],
            "rep_coefficients": [],
            "trend_rows": [],
            "model_candidates": candidates,
        }

    # Sample the selected model on a fixed grid for chart trend rendering.
    trend_rows = []
    for index in range(TREND_POINT_COUNT):
        x = index / (TREND_POINT_COUNT - 1)
        dem_prediction = predict_model(best_choice["modelType"], best_choice["demCoefficients"], x)
        rep_prediction = predict_model(best_choice["modelType"], best_choice["repCoefficients"], x)

        if dem_prediction is None or rep_prediction is None:
            continue

        trend_rows.append(
            {
                "x": x * 100.0,
                "demTrendPct": clamp01(dem_prediction) * 100.0,
                "repTrendPct": clamp01(rep_prediction) * 100.0,
            }
        )

    return {
        "model_type": best_choice["modelType"],
        "dem_coefficients": best_choice["demCoefficients"],
        "rep_coefficients": best_choice["repCoefficients"],
        "trend_rows": trend_rows,
        "model_candidates": candidates,
    }


def winning_party(dem_votes, rep_votes):
    if dem_votes > rep_votes:
        return "DEMOCRATIC"
    if rep_votes > dem_votes:
        return "REPUBLICAN"
    return "TIE"


def normalize_group_values(props, total_cvap):
    # Convert raw group populations into bounded percentages per precinct.
    group_populations = {}
    group_percentages = {}
    for group in GROUP_DEFINITIONS:
        group_key = group["key"]
        raw_population = pick_number(props, group["population_keys"])
        population = 0.0 if raw_population is None else raw_population
        if population < 0:
            population = 0.0

        population = min(population, total_cvap)
        group_populations[group_key] = population
        group_percentages[group_key] = clamp01(population / total_cvap) if total_cvap > 0 else 0.0

    return group_populations, group_percentages


def rows_for_render(rows):
    if not isinstance(rows, list):
        return []
    return list(rows)


def build_backend_group(rows, group):
    # Build backend payload block: scatter points + fitted trend metadata for one group.
    render_rows = rows_for_render(rows)
    points = []
    for row in render_rows:
        x = to_number(row.get(group))
        dem_share = to_number(row.get("dem_share"))
        rep_share = to_number(row.get("rep_share"))
        pid = row.get("pid")
        democratic_votes = to_number(row.get("democratic_votes"))
        republican_votes = to_number(row.get("republican_votes"))
        total_population = to_number(row.get("total_population"))
        winner = row.get("winning_party")
        group_percentages = row.get("group_percentages") if isinstance(row.get("group_percentages"), dict) else {}
        group_populations = row.get("group_populations") if isinstance(row.get("group_populations"), dict) else {}

        if (
            x is None
            or dem_share is None
            or rep_share is None
            or democratic_votes is None
            or republican_votes is None
            or total_population is None
        ):
            continue

        points.append(
            {
                "pid": pid,
                "x": x * 100.0,
                "demSharePct": dem_share * 100.0,
                "repSharePct": rep_share * 100.0,
                "winningParty": winner,
                "democraticVotes": democratic_votes,
                "republicanVotes": republican_votes,
                "totalPopulation": total_population,
                "groupPercentages": {key: value * 100.0 for key, value in sorted(group_percentages.items())},
                "groupPopulations": {key: value for key, value in sorted(group_populations.items())},
            }
        )

    trend = build_trend_rows(rows, group)
    return {
        "label": GROUP_LABELS.get(group, group),
        "modelType": trend["model_type"],
        "totalPointCount": len(rows),
        "renderPointCount": len(points),
        "demCoefficients": trend["dem_coefficients"],
        "repCoefficients": trend["rep_coefficients"],
        "modelCandidates": trend["model_candidates"],
        "points": points,
        "trendRows": trend["trend_rows"],
    }


def build_backend_payload(states):
    # Build state-keyed backend payload using each state's feasible groups only.
    payload = {}
    for state_code, state in sorted(states.items()):
        rows = state["points"]
        feasible_groups = list(state["feasible_groups"])
        payload[state_code] = {
            "feasibleGroups": feasible_groups,
            "statewideGroupCvap": state["statewide_group_cvap"],
            "groups": {
                group: build_backend_group(rows, group)
                for group in feasible_groups
            },
        }
    return payload


def resolve_pid(props, index):
    # Resolve a stable precinct identifier with fallback for malformed rows.
    for key in ("GEOID", "geoid", "PRECINCT", "precinct", "precinct_id", "pid", "id"):
        value = props.get(key)
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return f"precinct-{index}"


def resolve_state(props):
    # Resolve two-letter state code from explicit code fields or STATEFP fallback.
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
    # Parse one precinct into normalized chart row; drop when required fields are invalid.
    dem_votes = pick_number(props, ("votes_dem", "dem_votes", "DEM_VOTES"))
    rep_votes = pick_number(props, ("votes_rep", "rep_votes", "REP_VOTES"))
    if dem_votes is None or rep_votes is None:
        return None

    total_votes = dem_votes + rep_votes
    if total_votes <= 0:
        return None

    total_cvap = pick_number(props, ("CVAP_TOT24", "total_cvap", "CVAP_TOTAL", "TOT_CVAP"))
    if total_cvap is None or total_cvap <= 0:
        return None

    group_populations, group_percentages = normalize_group_values(props, total_cvap)

    row = {
        "pid": resolve_pid(props, index),
        "dem_share": clamp01(dem_votes / total_votes),
        "rep_share": clamp01(rep_votes / total_votes),
        "winning_party": winning_party(dem_votes, rep_votes),
        "democratic_votes": dem_votes,
        "republican_votes": rep_votes,
        "total_population": total_cvap,
        "group_percentages": group_percentages,
        "group_populations": group_populations,
    }

    for group_key in GROUPS:
        row[group_key] = group_percentages.get(group_key, 0.0)

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
    # Expand files/directories/globs into a de-duplicated ordered input list.
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
    # Keep I/O destinations configurable for local runs and CI pipelines.
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
        "statewide_group_cvap": {group_key: 0.0 for group_key in GROUPS},
        "feasible_groups": [],
    }


def infer_feasible_groups(state_rows):
    # Feasible groups are strictly those meeting the statewide CVAP threshold.
    statewide_totals = {group_key: 0.0 for group_key in GROUPS}
    for row in state_rows:
        populations = row.get("group_populations")
        if not isinstance(populations, dict):
            continue
        for group_key in GROUPS:
            population = to_number(populations.get(group_key))
            if population is None or population < 0:
                continue
            statewide_totals[group_key] += population

    feasible = [
        group_key
        for group_key in GROUPS
        if statewide_totals[group_key] >= FEASIBLE_GROUP_MIN_CVAP
    ]

    return statewide_totals, feasible


def main(argv=None):
    args = parse_args(argv)
    outdir = Path(args.outdir)
    backend_output = Path(args.backend_output)
    # Resolve all inputs and fail early when nothing is processable.
    input_paths = resolve_input_paths(args.inputs or [DEFAULT_INPUT])
    if not input_paths:
        print(f"[error] No input files resolved from: {args.inputs or [DEFAULT_INPUT]}", file=sys.stderr)
        return 1

    points = []
    states = {}
    total_features = 0
    dropped = 0

    # Parse precinct features and accumulate normalized rows by state.
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

    # Compute statewide CVAP totals and feasible groups per state.
    for state in states.values():
        totals, feasible = infer_feasible_groups(state["points"])
        state["statewide_group_cvap"] = totals
        state["feasible_groups"] = feasible

    generated_at = datetime.now(timezone.utc).isoformat()
    # Write shared frontend artifacts (points + global metadata).
    write_json(outdir / "gingles_points.json", points, compact=False)
    write_json(
        outdir / "gingles_meta.json",
        {
            "generated_at_utc": generated_at,
            "inputs": [str(path) for path in input_paths],
            "counts": {"features_in_input": total_features, "kept": len(points), "dropped": dropped},
            "ranges": {group: value_range(points, group) for group in ("dem_share", "rep_share", *GROUPS)},
            "groups": GROUPS,
            "groupLabels": GROUP_LABELS,
            "feasibleGroupThresholdCvap": FEASIBLE_GROUP_MIN_CVAP,
            "stateFeasibleGroups": {state_code: states[state_code]["feasible_groups"] for state_code in sorted(states)},
        },
    )

    # Write per-state metadata for state-scoped UI queries.
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
                "groupLabels": GROUP_LABELS,
                "statewideGroupCvap": state["statewide_group_cvap"],
                "feasibleGroups": state["feasible_groups"],
                "feasibleGroupThresholdCvap": FEASIBLE_GROUP_MIN_CVAP,
            },
        )

    # Write backend precomputed analysis payload.
    write_json(
        backend_output,
        {
            "generated_at_utc": generated_at,
            "feasibleGroupThresholdCvap": FEASIBLE_GROUP_MIN_CVAP,
            "groupLabels": GROUP_LABELS,
            "states": build_backend_payload(states),
        },
    )

    print(f"[ok] Wrote {len(points)} rows -> {outdir / 'gingles_points.json'}")
    print(f"[ok] Wrote meta -> {outdir / 'gingles_meta.json'}")
    for state_code in sorted(states):
        feasible = states[state_code]["feasible_groups"]
        print(f"[ok] Wrote state meta ({state_code}) -> {outdir / f'gingles_meta_{state_code}.json'}")
        print(f"[ok] State {state_code} feasible groups: {feasible}")
    print(f"[ok] Wrote backend analysis -> {backend_output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
