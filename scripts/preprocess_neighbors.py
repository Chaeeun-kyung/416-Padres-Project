# Precinct neighbor preprocessing
# If two precincts share a common boundary of at least 200 feet and the edges of each precinct are within 200 feet of its neighbors’ edges, then they are considered neighbors.
# This script computes neighbor lists for each precinct and writes them back into the GeoJSON properties.

import argparse
from pathlib import Path

import geopandas as gpd
from validate_neighbors import validate_file

FT_TO_M = 0.3048
DEFAULT_THRESHOLD_FT = 200.0
DEFAULT_NEIGHBOR_FIELD = "neighbors_200ft"
DEFAULT_NEIGHBOR_COUNT_FIELD = "neighbor_count_200ft"


def parse_args() -> argparse.Namespace:
    # Keep the script flexible so the same script can run for AZ/CO or future states without changing code.
    parser = argparse.ArgumentParser(
        description=(
            "Compute precinct neighbors from polygon boundaries and write them back into GeoJSON feature properties."
        )
    )
    parser.add_argument(
        "--inputs",
        nargs="+",
        required=True,
        help="Input precinct GeoJSON file path(s).",
    )
    parser.add_argument(
        "--id-col",
        default="GEOID",
        help="Unique precinct ID column name.",
    )
    parser.add_argument(
        "--threshold-ft",
        type=float,
        default=DEFAULT_THRESHOLD_FT,
        help="Neighbor threshold in feet (default: 200).",
    )
    parser.add_argument(
        "--neighbor-field",
        default=DEFAULT_NEIGHBOR_FIELD,
        help=f"Output property name for neighbor GEOID arrays (default: {DEFAULT_NEIGHBOR_FIELD}).",
    )
    parser.add_argument(
        "--neighbor-count-field",
        default=DEFAULT_NEIGHBOR_COUNT_FIELD,
        help=(
            "Output property name for neighbor counts "
            f"(default: {DEFAULT_NEIGHBOR_COUNT_FIELD})."
        ),
    )
    parser.add_argument(
        "--suffix",
        default="-neighbors",
        help="Suffix inserted before .geojson in output file names.",
    )
    parser.add_argument(
        "--output-dir",
        default=None,
        help="Optional output directory. Defaults to each input file's parent directory.",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite outputs when they already exist.",
    )
    parser.add_argument(
        "--skip-validate",
        action="store_true",
        help="Skip post-write validation step.",
    )
    return parser.parse_args()


def output_path_for(input_path: Path, suffix: str, output_dir: str | None) -> Path:
    # Default to saving near the input file to keep data-integration flow simple.
    target_dir = Path(output_dir) if output_dir else input_path.parent
    return target_dir / f"{input_path.stem}{suffix}.geojson"


def compute_neighbors(
    gdf: gpd.GeoDataFrame,
    id_col: str,
    threshold_ft: float,
) -> dict:
    # Check ID column exists, has no nulls, and is unique.
    if id_col not in gdf.columns:
        raise ValueError(f"Missing ID column: {id_col}")

    if gdf[id_col].isna().any():
        raise ValueError(f"Null values found in ID column: {id_col}")

    if not gdf[id_col].is_unique:
        raise ValueError(f"ID column must be unique: {id_col}")

    # Convert feet threshold to meters for spatial operations.
    threshold_m = threshold_ft * FT_TO_M

    # Repair invalid polygons, then drop empty geometries.
    # This avoids topology errors when computing boundaries/intersections.
    work = gdf[[id_col, "geometry"]].copy()
    work["geometry"] = work["geometry"].buffer(0)
    valid = work[work.geometry.notnull() & (~work.geometry.is_empty)].copy()

    # If there are no valid geometries, return empty neighbor sets.
    if valid.empty:
        return {pid: [] for pid in gdf[id_col].tolist()}

    # Project to a local metric CRS (UTM) so distances/lengths are in meters.
    projected = valid.to_crs(valid.estimate_utm_crs())
    boundaries = projected.geometry.boundary
    bounds = projected.geometry.bounds
    sindex = projected.sindex

    # Start with empty neighbor sets for every precinct (including isolated ones).
    neighbors = {pid: set() for pid in gdf[id_col].tolist()}
    bounds_rows = list(bounds.itertuples(index=False, name=None))
    ids = projected[id_col].tolist()

    # Candidate pruning: Query the spatial index using each precinct boundingbox expanded by threshold.
    # This avoids an O(n^2) all-pairs scan - more efficient for large precinct sets with sparse neighbors.
    for i, (minx, miny, maxx, maxy) in enumerate(bounds_rows):
        query_box = (
            minx - threshold_m,
            miny - threshold_m,
            maxx + threshold_m,
            maxy + threshold_m,
        )
        for j in sindex.intersection(query_box):
            # To avoid redundant checks.
            if j <= i:
                continue

            bi = boundaries.iloc[i]
            bj = boundaries.iloc[j]
            # Edges of each precinct must be within 200 feet.
            if bi.distance(bj) > threshold_m:
                continue

            # Shared boundary must be at least 200 feet.
            shared_len_m = bi.intersection(bj).length
            if shared_len_m + 1e-9 < threshold_m:
                continue

            # Store undirected adjacency symmetrically.
            a = ids[i]
            b = ids[j]
            neighbors[a].add(b)
            neighbors[b].add(a)

    # Serialize sets as sorted lists for deterministic output.
    return {pid: sorted(list(adj)) for pid, adj in neighbors.items()}

# To process a single file: compute neighbors and write them back into GeoJSON properties.
def process_file(
    input_path: Path,
    output_path: Path,
    id_col: str,
    threshold_ft: float,
    neighbor_field: str,
    neighbor_count_field: str,
    overwrite: bool,
) -> None:
    if output_path.exists() and not overwrite:
        raise FileExistsError(f"Output exists: {output_path} (use --overwrite to replace)")

    # Compute neighbor map from geometry, then attach it as GeoJSON properties.
    gdf = gpd.read_file(input_path)
    neighbor_map = compute_neighbors(gdf, id_col=id_col, threshold_ft=threshold_ft)

    gdf[neighbor_field] = gdf[id_col].map(neighbor_map)
    gdf[neighbor_count_field] = gdf[neighbor_field].map(len)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    gdf.to_file(output_path, driver="GeoJSON")

    total_edges = int(gdf[neighbor_count_field].sum() // 2)
    print(
        f"[done] {input_path} -> {output_path} | precincts={len(gdf)} "
        f"| undirected_edges={total_edges}"
    )


def main() -> None:
    args = parse_args()
    for input_raw in args.inputs:
        input_path = Path(input_raw)
        output_path = output_path_for(input_path, args.suffix, args.output_dir)
        process_file(
            input_path=input_path,
            output_path=output_path,
            id_col=args.id_col,
            threshold_ft=args.threshold_ft,
            neighbor_field=args.neighbor_field,
            neighbor_count_field=args.neighbor_count_field,
            overwrite=args.overwrite,
        )
        # Safety net: validate written output unless explicitly skipped.
        if not args.skip_validate:
            ok = validate_file(
                path=output_path,
                id_col=args.id_col,
                neighbor_field=args.neighbor_field,
                count_field=args.neighbor_count_field,
                threshold_ft=args.threshold_ft,
            )
            if not ok:
                raise SystemExit(f"Validation failed: {output_path}")


if __name__ == "__main__":
    main()
