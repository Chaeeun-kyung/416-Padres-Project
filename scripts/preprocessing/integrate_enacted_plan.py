#!/usr/bin/env python3
from __future__ import annotations

# Enacted-plan integration preprocessing (Prepro-1 support).
# Join precinct-level election/CVAP data with enacted district boundaries,
# then write precinct GeoJSON enriched with district metadata.

import argparse
from pathlib import Path
from typing import Iterable

import geopandas as gpd
import pandas as pd


DEFAULT_STATES = ("AZ", "CO")
DEFAULT_GEOJSON_DIR = Path("public/geojson")
TARGET_CRS = "EPSG:5070"
DEFAULT_ASSUME_CRS = "EPSG:4326"

# Precinct GeoJSON is expected to already include election + CVAP integration.
REQUIRED_PRECINCT_COLUMNS = (
    "GEOID",
    "votes_dem",
    "votes_rep",
    "votes_total",
    "CVAP_TOT24",
    "CVAP_HSP24",
    "CVAP_BLA24",
    "CVAP_ASI24",
    "CVAP_WHT24",
    "geometry",
)
REQUIRED_DISTRICT_COLUMNS = ("GEOID", "CD119FP", "NAMELSAD", "geometry")


def parse_args() -> argparse.Namespace:
    # Expose state/file behavior via CLI so the same flow runs for multiple states.
    parser = argparse.ArgumentParser(
        description="Assign enacted districts to precinct GeoJSON files."
    )
    parser.add_argument(
        "--state",
        action="append",
        dest="states",
        help="Two-letter state code to process. Repeatable. Default: AZ and CO.",
    )
    parser.add_argument(
        "--geojson-dir",
        type=Path,
        default=DEFAULT_GEOJSON_DIR,
        help="Directory containing district and precinct GeoJSON files.",
    )
    parser.add_argument(
        "--suffix",
        default="-with-enacted-districts",
        help="Suffix inserted before .geojson for output precinct files.",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite the input precinct file instead of writing a new file.",
    )
    parser.add_argument(
        "--assume-crs",
        default=DEFAULT_ASSUME_CRS,
        help=(
            "Fallback CRS to assign when an input file has no CRS metadata "
            f"(default: {DEFAULT_ASSUME_CRS})."
        ),
    )
    return parser.parse_args()


def normalize_states(raw_states: Iterable[str] | None) -> list[str]:
    # Normalize repeatable --state flags to unique 2-letter uppercase state codes.
    if not raw_states:
        return list(DEFAULT_STATES)
    states = []
    for value in raw_states:
        state = str(value).strip().upper()
        if len(state) != 2:
            raise ValueError(f"Invalid state code: {value!r}")
        if state not in states:
            states.append(state)
    return states


def require_columns(frame: pd.DataFrame, columns: Iterable[str], label: str) -> None:
    # Fail fast when required columns are missing, before spatial work begins.
    missing = [column for column in columns if column not in frame.columns]
    if missing:
        raise ValueError(f"Missing required {label} columns: {', '.join(missing)}")


def resolve_precinct_path(state: str, geojson_dir: Path) -> Path:
    return geojson_dir / f"{state}-precincts-with-results-cvap.geojson"


def resolve_district_path(state: str, geojson_dir: Path) -> Path:
    return geojson_dir / f"{state}-districts.geojson"


def resolve_output_path(precinct_path: Path, suffix: str, overwrite: bool) -> Path:
    if overwrite:
        return precinct_path
    return precinct_path.with_name(f"{precinct_path.stem}{suffix}{precinct_path.suffix}")


def normalize_boundary_format(path: Path, label: str) -> gpd.GeoDataFrame:
    # Read boundary files into GeoDataFrame, reporting non-GeoJSON inputs for traceability.
    if path.suffix.lower() not in {".geojson", ".json"}:
        print(
            f"[info] {label}: non-GeoJSON input detected ({path.suffix}); "
            "normalizing in memory before writing GeoJSON output."
        )
    return gpd.read_file(path)


def normalize_to_crs(
    frame: gpd.GeoDataFrame,
    label: str,
    target_crs: str,
    assume_crs: str,
) -> gpd.GeoDataFrame:
    # Ensure both layers share a projected CRS so overlap area math is valid (meters).
    normalized = frame.copy()
    if normalized.crs is None:
        print(
            f"[warn] {label}: missing CRS metadata; assuming {assume_crs} before projection."
        )
        normalized = normalized.set_crs(assume_crs, allow_override=True)
    return normalized.to_crs(target_crs)


def assign_districts_by_overlap(
    precincts_projected: gpd.GeoDataFrame,
    districts_projected: gpd.GeoDataFrame,
) -> gpd.GeoDataFrame:
    # Action 1: compute precinct x district intersections after geometry repair.
    precincts = precincts_projected.copy()
    districts = districts_projected.copy()

    # Repair invalid geometries before overlay to avoid topology errors.
    precincts["geometry"] = precincts.geometry.buffer(0)
    districts["geometry"] = districts.geometry.buffer(0)

    intersections = gpd.overlay(
        precincts[["GEOID", "geometry"]],
        districts[["district_id", "district_number", "district_name", "geometry"]],
        how="intersection",
        keep_geom_type=False,
    )

    if intersections.empty:
        # No overlaps found: preserve precinct rows and mark district fields missing.
        assigned = precincts.copy()
        assigned["district_id"] = pd.NA
        assigned["district_number"] = pd.NA
        assigned["district_name"] = pd.NA
        return assigned

    intersections = intersections[
        intersections.geometry.notnull() & (~intersections.geometry.is_empty)
    ].copy()
    intersections["overlap_area_m2"] = intersections.geometry.area
    intersections = intersections[intersections["overlap_area_m2"] > 0].copy()

    if intersections.empty:
        # Overlays existed but had no positive area after cleaning.
        assigned = precincts.copy()
        assigned["district_id"] = pd.NA
        assigned["district_number"] = pd.NA
        assigned["district_name"] = pd.NA
        return assigned

    # Action 2: winner-take-most-overlap assignment for each precinct.
    winners = intersections.sort_values(
        by=["GEOID", "overlap_area_m2", "district_id"],
        ascending=[True, False, True],
    ).drop_duplicates(subset=["GEOID"], keep="first")
    assignments = winners[["GEOID", "district_id", "district_number", "district_name"]]
    return precincts.merge(assignments, on="GEOID", how="left")


def print_quality_checks(state: str, precincts: gpd.GeoDataFrame, assigned: gpd.GeoDataFrame) -> None:
    # Emit lightweight QA counters to validate integration completeness.
    missing_geoid = int(precincts["GEOID"].isna().sum())
    unmatched_precincts = int(assigned["district_id"].isna().sum())
    message = (
        f"[qa] {state}: missing_geoid={missing_geoid}, "
        f"unmatched_precincts={unmatched_precincts}"
    )
    if "CVAP_TOT24" in precincts.columns:
        missing_cvap = int(precincts["CVAP_TOT24"].isna().sum())
        sum_cvap = float(precincts["CVAP_TOT24"].sum(skipna=True))
        message += f", missing_cvap_total={missing_cvap}, sum_cvap_total={sum_cvap}"
    print(message)


def enrich_state(
    state: str,
    geojson_dir: Path,
    suffix: str,
    overwrite: bool,
    assume_crs: str,
) -> Path:
    # Action 1: resolve state-specific input/output files.
    precinct_path = resolve_precinct_path(state, geojson_dir)
    district_path = resolve_district_path(state, geojson_dir)
    output_path = resolve_output_path(precinct_path, suffix, overwrite)

    if not precinct_path.exists():
        raise FileNotFoundError(f"Precinct file not found: {precinct_path}")
    if not district_path.exists():
        raise FileNotFoundError(f"District file not found: {district_path}")

    # Action 2: load and validate precinct/district datasets.
    precincts = normalize_boundary_format(precinct_path, f"{state} precinct")
    districts = normalize_boundary_format(district_path, f"{state} district")

    require_columns(precincts, REQUIRED_PRECINCT_COLUMNS, f"{state} precinct")
    require_columns(districts, REQUIRED_DISTRICT_COLUMNS, f"{state} district")

    # Action 3: standardize key columns used for joining/rendering.
    precincts = precincts.copy()
    precincts["GEOID"] = precincts["GEOID"].astype(str)
    if "state" in precincts.columns:
        precincts["state"] = precincts["state"].fillna(state)
    else:
        precincts["state"] = state
    precincts["state"] = precincts["state"].astype(str).str.upper()

    districts = districts.copy()
    districts["GEOID"] = districts["GEOID"].astype(str)
    districts["CD119FP"] = districts["CD119FP"].astype(str).str.zfill(2)
    districts["district_number"] = districts["CD119FP"]
    districts["district_id"] = districts["GEOID"]
    districts["district_name"] = districts["NAMELSAD"].astype(str)
    districts = districts[["district_id", "district_number", "district_name", "geometry"]]

    # Action 4: project both layers, assign enacted district by max overlap, annotate provenance.
    precinct_source_crs = precincts.crs or assume_crs
    precincts_projected = normalize_to_crs(
        precincts, f"{state} precinct", TARGET_CRS, assume_crs
    )
    districts_projected = normalize_to_crs(
        districts, f"{state} district", TARGET_CRS, assume_crs
    )

    joined = assign_districts_by_overlap(precincts_projected, districts_projected)
    joined["plan_type"] = "enacted"
    joined["plan_source_file"] = district_path.name

    print_quality_checks(state, precincts, joined)

    # Action 5: write enriched precinct GeoJSON in original CRS for downstream compatibility.
    output = gpd.GeoDataFrame(joined, geometry="geometry", crs=precincts_projected.crs)
    output = output.to_crs(precinct_source_crs)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output.to_file(output_path, driver="GeoJSON")

    print(
        f"[ok] {state}: wrote {len(output)} precincts with enacted districts -> {output_path}"
    )
    return output_path


def main() -> int:
    args = parse_args()
    states = normalize_states(args.states)

    # Run integration per state so failures are localized and retry-friendly.
    for state in states:
        enrich_state(
            state=state,
            geojson_dir=args.geojson_dir,
            suffix=args.suffix,
            overwrite=args.overwrite,
            assume_crs=args.assume_crs,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
