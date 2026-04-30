from __future__ import annotations

# Prepro-9 + GUI-12 preprocessing:
# Run PyEI statewide 2x2 ecological inference for feasible groups and emit
# backend-ready EI density rows plus a metadata/validation report.

import argparse
import json
import math
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

import numpy as np
from pyei import TwoByTwoEI
from scipy.stats import gaussian_kde

try:
    import arviz as az
except Exception:  # pragma: no cover - optional runtime dependency behavior
    az = None


DEFAULT_STATES = ("AZ", "CO")
DEFAULT_INPUT_TEMPLATE = "results/seawulf_inputs/{state}/{state}_precinct_attributes.json"
DEFAULT_OUTPUT = "backend/src/main/resources/ei-analysis.json"
DEFAULT_VALIDATION_OUTPUT = "results/meta_ei.json"
DEFAULT_MODEL = "king99_pareto_modification"
DEFAULT_DEM_CANDIDATE_LABEL = "Kamala Harris"
DEFAULT_REP_CANDIDATE_LABEL = "Donald Trump"
DEFAULT_MIN_STATEWIDE_GROUP_CVAP = 400_000.0
DEFAULT_GRID_POINTS = 121
DEFAULT_TUNE = 350
DEFAULT_DRAWS = 350
DEFAULT_CHAINS = 2
DEFAULT_CORES = 1
DEFAULT_TARGET_ACCEPT = 0.99
DEFAULT_RANDOM_SEED = 416
EPSILON = 1e-6


@dataclass(frozen=True)
class GroupSpec:
    key: str
    label: str
    pct_column: str
    cvap_column: str


GROUP_SPECS = (
    GroupSpec("white_pct", "White", "PCT_CVAP_WHT", "CVAP_WHT24"),
    GroupSpec("latino_pct", "Latino", "PCT_CVAP_HSP", "CVAP_HSP24"),
)


def parse_args(argv: Iterable[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run PyEI on precinct data and write backend EI JSON."
    )
    parser.add_argument(
        "--states",
        default=",".join(DEFAULT_STATES),
        help=f"Comma-separated state codes (default: {','.join(DEFAULT_STATES)}).",
    )
    parser.add_argument(
        "--input-template",
        default=DEFAULT_INPUT_TEMPLATE,
        help=f"Input path template with {{state}} (default: {DEFAULT_INPUT_TEMPLATE}).",
    )
    parser.add_argument(
        "--output",
        default=DEFAULT_OUTPUT,
        help=f"Output EI JSON path (default: {DEFAULT_OUTPUT}).",
    )
    parser.add_argument(
        "--validation-output",
        default=DEFAULT_VALIDATION_OUTPUT,
        help=f"Metadata/validation report JSON path (default: {DEFAULT_VALIDATION_OUTPUT}).",
    )
    parser.add_argument(
        "--meta-output",
        dest="validation_output",
        help="Alias of --validation-output.",
    )
    parser.add_argument(
        "--model",
        default=DEFAULT_MODEL,
        help=f"PyEI TwoByTwo model name (default: {DEFAULT_MODEL}).",
    )
    parser.add_argument(
        "--dem-candidate-label",
        default=DEFAULT_DEM_CANDIDATE_LABEL,
        help=f"Label for demRows candidate (default: {DEFAULT_DEM_CANDIDATE_LABEL}).",
    )
    parser.add_argument(
        "--rep-candidate-label",
        default=DEFAULT_REP_CANDIDATE_LABEL,
        help=f"Label for repRows candidate (default: {DEFAULT_REP_CANDIDATE_LABEL}).",
    )
    parser.add_argument(
        "--min-statewide-group-cvap",
        type=float,
        default=DEFAULT_MIN_STATEWIDE_GROUP_CVAP,
        help=(
            "Feasibility threshold for statewide group CVAP "
            f"(default: {DEFAULT_MIN_STATEWIDE_GROUP_CVAP})."
        ),
    )
    parser.add_argument(
        "--grid-points",
        type=int,
        default=DEFAULT_GRID_POINTS,
        help=f"Density x-grid size in [0,1] (default: {DEFAULT_GRID_POINTS}).",
    )
    parser.add_argument(
        "--tune",
        type=int,
        default=DEFAULT_TUNE,
        help=f"PyMC tune iterations (default: {DEFAULT_TUNE}).",
    )
    parser.add_argument(
        "--draws",
        type=int,
        default=DEFAULT_DRAWS,
        help=f"Posterior draws per chain (default: {DEFAULT_DRAWS}).",
    )
    parser.add_argument(
        "--chains",
        type=int,
        default=DEFAULT_CHAINS,
        help=f"Number of chains (default: {DEFAULT_CHAINS}).",
    )
    parser.add_argument(
        "--cores",
        type=int,
        default=DEFAULT_CORES,
        help=f"Number of sampling cores (default: {DEFAULT_CORES}).",
    )
    parser.add_argument(
        "--target-accept",
        type=float,
        default=DEFAULT_TARGET_ACCEPT,
        help=f"NUTS target_accept (default: {DEFAULT_TARGET_ACCEPT}).",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=DEFAULT_RANDOM_SEED,
        help=f"Base random seed (default: {DEFAULT_RANDOM_SEED}).",
    )
    parser.add_argument(
        "--progressbar",
        action="store_true",
        help="Show sampling progress bars.",
    )
    return parser.parse_args(argv)


def to_number(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def clip_for_model(value: float) -> float:
    bounded = clamp01(value)
    if bounded <= EPSILON:
        return EPSILON
    if bounded >= 1.0 - EPSILON:
        return 1.0 - EPSILON
    return bounded


def parse_states(raw_states: str) -> list[str]:
    values = []
    for token in (raw_states or "").split(","):
        code = token.strip().upper()
        if len(code) == 2 and code.isalpha():
            values.append(code)
    return values


def load_rows(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    if not isinstance(payload, list):
        raise ValueError(f"Expected list payload in {path}")
    rows = [row for row in payload if isinstance(row, dict)]
    return rows


def feasible_groups(rows: list[dict], threshold: float) -> tuple[list[GroupSpec], dict[str, float]]:
    statewide_cvap: dict[str, float] = {}
    feasible: list[GroupSpec] = []

    for spec in GROUP_SPECS:
        total = 0.0
        for row in rows:
            value = to_number(row.get(spec.cvap_column))
            if value is None or value <= 0:
                continue
            total += value
        statewide_cvap[spec.key] = total
        if total >= threshold:
            feasible.append(spec)

    return feasible, statewide_cvap


def build_fit_arrays(rows: list[dict], group_spec: GroupSpec):
    group_fraction = []
    dem_fraction = []
    precinct_pops = []
    dropped = 0

    for row in rows:
        dem_votes = to_number(row.get("votes_dem"))
        rep_votes = to_number(row.get("votes_rep"))
        group_pct = to_number(row.get(group_spec.pct_column))
        if dem_votes is None or rep_votes is None or group_pct is None:
            dropped += 1
            continue

        total_two_party = dem_votes + rep_votes
        if total_two_party <= 0:
            dropped += 1
            continue

        g = clip_for_model(group_pct)
        dem = clip_for_model(dem_votes / total_two_party)
        pop = int(round(total_two_party))
        if pop <= 0:
            dropped += 1
            continue

        group_fraction.append(g)
        dem_fraction.append(dem)
        precinct_pops.append(pop)

    if not group_fraction:
        raise ValueError(f"No usable precinct rows for group {group_spec.key}")

    return (
        np.asarray(group_fraction, dtype=float),
        np.asarray(dem_fraction, dtype=float),
        np.asarray(precinct_pops, dtype=int),
        dropped,
    )


def compute_density(samples: np.ndarray, xs: np.ndarray) -> np.ndarray:
    values = np.asarray(samples, dtype=float)
    values = values[np.isfinite(values)]
    if values.size == 0:
        return np.zeros_like(xs)
    values = np.clip(values, 0.0, 1.0)

    if values.size < 2 or float(np.std(values)) < 1e-8:
        mean = float(np.mean(values))
        sigma = 0.015
        z = (xs - mean) / sigma
        density = np.exp(-0.5 * z * z) / (sigma * math.sqrt(2.0 * math.pi))
    else:
        try:
            kde = gaussian_kde(values)
            density = kde(xs)
        except Exception:
            mean = float(np.mean(values))
            sigma = max(float(np.std(values)), 0.015)
            z = (xs - mean) / sigma
            density = np.exp(-0.5 * z * z) / (sigma * math.sqrt(2.0 * math.pi))

    density = np.clip(density, 0.0, None)
    area = float(np.trapezoid(density, xs))
    if area > 0:
        density = density / area
    return density


def rows_for_chart(xs: np.ndarray, group_density: np.ndarray, non_group_density: np.ndarray) -> list[dict]:
    rows: list[dict] = []
    for index in range(xs.size):
        rows.append(
            {
                "x": float(xs[index]),
                "group": float(group_density[index]),
                "nonGroup": float(non_group_density[index]),
            }
        )
    return rows


def safe_diag_stats(model: TwoByTwoEI) -> dict[str, float | None]:
    if az is None:
        return {"rhatMax": None, "essBulkMin": None}

    try:
        rhat = az.rhat(model.sim_trace, var_names=["b_1", "b_2"])
        ess = az.ess(model.sim_trace, var_names=["b_1", "b_2"], method="bulk")
        rhat_values = np.asarray(list(rhat.to_array().values)).astype(float).reshape(-1)
        ess_values = np.asarray(list(ess.to_array().values)).astype(float).reshape(-1)
        rhat_values = rhat_values[np.isfinite(rhat_values)]
        ess_values = ess_values[np.isfinite(ess_values)]
        return {
            "rhatMax": float(np.max(rhat_values)) if rhat_values.size else None,
            "essBulkMin": float(np.min(ess_values)) if ess_values.size else None,
        }
    except Exception:
        return {"rhatMax": None, "essBulkMin": None}


def fit_group(
    state_code: str,
    group_spec: GroupSpec,
    group_fraction: np.ndarray,
    dem_fraction: np.ndarray,
    precinct_pops: np.ndarray,
    args: argparse.Namespace,
    seed: int,
):
    model = TwoByTwoEI(args.model)
    model.fit(
        group_fraction=group_fraction,
        votes_fraction=dem_fraction,
        precinct_pops=precinct_pops,
        demographic_group_name=group_spec.label,
        candidate_name=args.dem_candidate_label,
        target_accept=args.target_accept,
        tune=args.tune,
        draws=args.draws,
        chains=args.chains,
        cores=args.cores,
        random_seed=seed,
        progressbar=args.progressbar,
    )

    sampled = model.sampled_voting_prefs
    dem_group = np.asarray(sampled[0], dtype=float)
    dem_non_group = np.asarray(sampled[1], dtype=float)
    rep_group = 1.0 - dem_group
    rep_non_group = 1.0 - dem_non_group

    xs = np.linspace(0.0, 1.0, args.grid_points)
    dem_rows = rows_for_chart(
        xs,
        compute_density(dem_group, xs),
        compute_density(dem_non_group, xs),
    )
    rep_rows = rows_for_chart(
        xs,
        compute_density(rep_group, xs),
        compute_density(rep_non_group, xs),
    )

    statewide_group_share = float(np.average(group_fraction, weights=precinct_pops))
    observed_dem_share = float(np.average(dem_fraction, weights=precinct_pops))
    mean_group_dem = float(np.mean(dem_group))
    mean_non_group_dem = float(np.mean(dem_non_group))
    reconstructed_dem_share = (
        statewide_group_share * mean_group_dem
        + (1.0 - statewide_group_share) * mean_non_group_dem
    )
    balance_error = abs(observed_dem_share - reconstructed_dem_share)

    diag = safe_diag_stats(model)
    group_ci = np.percentile(dem_group, [2.5, 97.5]).tolist()
    non_group_ci = np.percentile(dem_non_group, [2.5, 97.5]).tolist()

    validation = {
        "state": state_code,
        "groupKey": group_spec.key,
        "groupLabel": group_spec.label,
        "demCandidateLabel": args.dem_candidate_label,
        "repCandidateLabel": args.rep_candidate_label,
        "usedPrecincts": int(group_fraction.size),
        "observedDemShare": observed_dem_share,
        "reconstructedDemShare": float(reconstructed_dem_share),
        "balanceErrorAbs": float(balance_error),
        "statewideGroupShareWeightedByVotes": statewide_group_share,
        "groupDemSupportMean": mean_group_dem,
        "groupDemSupportCI95": [float(group_ci[0]), float(group_ci[1])],
        "nonGroupDemSupportMean": mean_non_group_dem,
        "nonGroupDemSupportCI95": [float(non_group_ci[0]), float(non_group_ci[1])],
        "rhatMax": diag["rhatMax"],
        "essBulkMin": diag["essBulkMin"],
        "warnings": build_warnings(balance_error, diag),
    }

    return dem_rows, rep_rows, validation


def build_warnings(balance_error: float, diag: dict[str, float | None]) -> list[str]:
    warnings: list[str] = []
    if balance_error > 0.03:
        warnings.append("statewide balance error > 0.03")
    rhat_max = diag.get("rhatMax")
    ess_bulk_min = diag.get("essBulkMin")
    if rhat_max is not None and rhat_max > 1.05:
        warnings.append("rhatMax > 1.05")
    if ess_bulk_min is not None and ess_bulk_min < 200:
        warnings.append("essBulkMin < 200")
    return warnings


def write_json(path: Path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def run(args: argparse.Namespace):
    states = parse_states(args.states)
    if not states:
        raise ValueError("No valid --states values were provided")
    if args.grid_points < 25:
        raise ValueError("--grid-points must be >= 25")
    if args.chains < 2:
        raise ValueError("--chains must be >= 2 for convergence diagnostics")

    output: dict[str, dict] = {}
    validation_entries: list[dict] = []

    for state_index, state_code in enumerate(states):
        input_path = Path(args.input_template.format(state=state_code))
        rows = load_rows(input_path)
        feasible, statewide_cvap = feasible_groups(rows, args.min_statewide_group_cvap)

        groups_payload: dict[str, dict] = {}
        for group_index, group_spec in enumerate(feasible):
            group_fraction, dem_fraction, precinct_pops, dropped = build_fit_arrays(rows, group_spec)

            seed = args.seed + (state_index * 1000) + (group_index * 100)
            dem_rows, rep_rows, validation = fit_group(
                state_code=state_code,
                group_spec=group_spec,
                group_fraction=group_fraction,
                dem_fraction=dem_fraction,
                precinct_pops=precinct_pops,
                args=args,
                seed=seed,
            )

            groups_payload[group_spec.key] = {
                "label": group_spec.label,
                "demCandidateLabel": args.dem_candidate_label,
                "repCandidateLabel": args.rep_candidate_label,
                "demRows": dem_rows,
                "repRows": rep_rows,
            }

            validation["inputPath"] = str(input_path)
            validation["rawPrecinctRows"] = int(len(rows))
            validation["droppedRows"] = int(dropped)
            validation["statewideGroupCvap"] = float(statewide_cvap.get(group_spec.key, 0.0))
            validation_entries.append(validation)

        output[state_code] = {"groups": groups_payload}

    report = {
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "config": {
            "states": states,
            "inputTemplate": args.input_template,
            "model": args.model,
            "demCandidateLabel": args.dem_candidate_label,
            "repCandidateLabel": args.rep_candidate_label,
            "minStatewideGroupCvap": args.min_statewide_group_cvap,
            "gridPoints": args.grid_points,
            "tune": args.tune,
            "draws": args.draws,
            "chains": args.chains,
            "cores": args.cores,
            "targetAccept": args.target_accept,
            "seed": args.seed,
        },
        "validation": validation_entries,
    }

    write_json(Path(args.output), output)
    write_json(Path(args.validation_output), report)

    print(f"[EI] Wrote: {args.output}")
    print(f"[EI] Wrote: {args.validation_output}")
    for entry in validation_entries:
        warnings = entry.get("warnings") or []
        warning_text = " | ".join(warnings) if warnings else "OK"
        print(
            "[EI] "
            f"{entry['state']} {entry['groupKey']} "
            f"used={entry['usedPrecincts']} "
            f"obs_dem={entry['observedDemShare']:.4f} "
            f"recon_dem={entry['reconstructedDemShare']:.4f} "
            f"err={entry['balanceErrorAbs']:.4f} "
            f"rhat={entry['rhatMax'] if entry['rhatMax'] is not None else 'n/a'} "
            f"ess_min={entry['essBulkMin'] if entry['essBulkMin'] is not None else 'n/a'} "
            f"-> {warning_text}"
        )


def main(argv: Iterable[str] | None = None):
    args = parse_args(argv)
    run(args)


if __name__ == "__main__":
    main()

