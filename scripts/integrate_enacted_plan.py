#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path
from typing import Iterable

import geopandas as gpd
import pandas as pd


DEFAULT_STATES = ("AZ", "CO")
DEFAULT_GEOJSON_DIR = Path("public/geojson")
TARGET_CRS = "EPSG:5070"


def parse_args() -> argparse.Namespace:
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
    return parser.parse_args()


def normalize_states(raw_states: Iterable[str] | None) -> list[str]:
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


def enrich_state(state: str, geojson_dir: Path, suffix: str, overwrite: bool) -> Path:
    precinct_path = resolve_precinct_path(state, geojson_dir)
    district_path = resolve_district_path(state, geojson_dir)
    output_path = resolve_output_path(precinct_path, suffix, overwrite)

    if not precinct_path.exists():
        raise FileNotFoundError(f"Precinct file not found: {precinct_path}")
    if not district_path.exists():
        raise FileNotFoundError(f"District file not found: {district_path}")

    precincts = gpd.read_file(precinct_path)
    districts = gpd.read_file(district_path)

    require_columns(precincts, ["GEOID", "geometry"], f"{state} precinct")
    require_columns(
        districts,
        ["GEOID", "CD119FP", "NAMELSAD", "geometry"],
        f"{state} district",
    )

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
    districts = districts[
        ["district_id", "district_number", "district_name", "geometry"]
    ]

    precincts_projected = precincts.to_crs(TARGET_CRS)
    districts_projected = districts.to_crs(TARGET_CRS)

    joined = gpd.sjoin(
        precincts_projected,
        districts_projected,
        how="left",
        predicate="intersects",
    )

    joined["intersection_area"] = joined.geometry.area
    joined = joined.sort_values(
        by=["GEOID", "intersection_area", "district_id"],
        ascending=[True, False, True],
    )
    joined = joined.drop_duplicates(subset=["GEOID"], keep="first")
    joined = joined.drop(columns=["index_right", "intersection_area"], errors="ignore")

    joined["plan_type"] = "enacted"
    joined["plan_source_file"] = district_path.name

    missing_matches = int(joined["district_id"].isna().sum())
    if missing_matches:
        print(
            f"[warn] {state}: {missing_matches} precincts were not matched to a district."
        )

    output = gpd.GeoDataFrame(joined, geometry="geometry", crs=precincts_projected.crs)
    output = output.to_crs(precincts.crs)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output.to_file(output_path, driver="GeoJSON")

    print(
        f"[ok] {state}: wrote {len(output)} precincts with enacted districts -> {output_path}"
    )
    return output_path


def main() -> int:
    args = parse_args()
    states = normalize_states(args.states)

    for state in states:
        enrich_state(
            state=state,
            geojson_dir=args.geojson_dir,
            suffix=args.suffix,
            overwrite=args.overwrite,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
