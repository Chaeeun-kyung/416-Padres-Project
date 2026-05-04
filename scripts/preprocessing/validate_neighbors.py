# This file is for neighbor validation.
# Verify that embedded neighbor fields are internally consistent and that each stored edge still satisfies the 200 ft geometric rules.

import argparse
import json
from pathlib import Path

import geopandas as gpd

FT_TO_M = 0.3048
DEFAULT_THRESHOLD_FT = 200.0
DEFAULT_ID_COL = "GEOID"
DEFAULT_NEIGHBOR_FIELD = "neighbors_200ft"
DEFAULT_COUNT_FIELD = "neighbor_count_200ft"


def parse_args() -> argparse.Namespace:
    # Keep validator reusable across files/states and custom field names.
    parser = argparse.ArgumentParser(
        description=(
            "Validate neighbor fields embedded in precinct GeoJSON files."
            "Checks schema, reciprocity, geometry constraints, and completeness."
        )
    )
    parser.add_argument(
        "--inputs",
        nargs="+",
        required=True,
        help="GeoJSON path(s) that already contain neighbor fields.",
    )
    parser.add_argument("--id-col", default=DEFAULT_ID_COL)
    parser.add_argument("--neighbor-field", default=DEFAULT_NEIGHBOR_FIELD)
    parser.add_argument("--count-field", default=DEFAULT_COUNT_FIELD)
    parser.add_argument("--threshold-ft", type=float, default=DEFAULT_THRESHOLD_FT)
    return parser.parse_args()


def edge_key(a, b):
    # Canonical undirected edge representation so (A,B) == (B,A).
    return (a, b) if a <= b else (b, a)


def build_edge_set_from_field(
    property_rows: list, ids: set, id_col: str, neighbor_field: str, count_field: str
):
    # Field-level consistency checks: list type, duplicates, self-reference, unknown IDs, reciprocity, count mismatch.
    neighbor_map = {}
    issues = {
        "missing_field_rows": 0,
        "non_list_rows": 0,
        "duplicate_neighbors_rows": 0,
        "self_neighbor_count": 0,
        "unknown_neighbor_refs": 0,
        "asymmetric_pairs": 0,
        "count_mismatch_rows": 0,
    }

    for row in property_rows:
        pid = row[id_col]
        raw = row.get(neighbor_field, [])
        if raw is None:
            raw = []
            issues["missing_field_rows"] += 1
        if not isinstance(raw, list):
            issues["non_list_rows"] += 1
            raw = list(raw) if hasattr(raw, "__iter__") else []

        unique = set(raw)
        if len(unique) != len(raw):
            issues["duplicate_neighbors_rows"] += 1

        if pid in unique:
            issues["self_neighbor_count"] += 1

        unknown = [n for n in unique if n not in ids]
        issues["unknown_neighbor_refs"] += len(unknown)
        cleaned = sorted([n for n in unique if n in ids and n != pid])
        neighbor_map[pid] = cleaned

        if count_field in row and row.get(count_field) != len(raw):
            issues["count_mismatch_rows"] += 1

    # Build undirected edge set from neighbor arrays.
    edges = set()
    for a, nbs in neighbor_map.items():
        for b in nbs:
            edges.add(edge_key(a, b))

    for a, nbs in neighbor_map.items():
        for b in nbs:
            if a not in neighbor_map.get(b, []):
                issues["asymmetric_pairs"] += 1

    return neighbor_map, edges, issues


def load_property_rows(path: Path, id_col: str):
    # Read raw GeoJSON properties directly so array fields remain true lists.
    with path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    features = payload.get("features") if isinstance(payload, dict) else None
    if not isinstance(features, list):
        raise ValueError(f"{path}: invalid GeoJSON features")

    rows = []
    for feat in features:
        props = feat.get("properties") if isinstance(feat, dict) else None
        if not isinstance(props, dict):
            continue
        if id_col not in props:
            continue
        rows.append(props)
    return rows


def recompute_edges(gdf: gpd.GeoDataFrame, id_col: str, threshold_ft: float):
    # Recompute expected neighbor edges from geometry only, using the same threshold rules as preprocessing.
    threshold_m = threshold_ft * FT_TO_M
    work = gdf[[id_col, "geometry"]].copy()
    work["geometry"] = work["geometry"].buffer(0)
    work = work[work.geometry.notnull() & (~work.geometry.is_empty)].copy()
    if work.empty:
        return set()

    projected = work.to_crs(work.estimate_utm_crs())
    boundaries = projected.geometry.boundary
    bounds = projected.geometry.bounds
    sindex = projected.sindex
    ids = projected[id_col].tolist()

    recomputed = set()
    bounds_rows = list(bounds.itertuples(index=False, name=None))
    for i, (minx, miny, maxx, maxy) in enumerate(bounds_rows):
        # Spatial index pruning avoids expensive all-pairs checks.
        query_box = (
            minx - threshold_m,
            miny - threshold_m,
            maxx + threshold_m,
            maxy + threshold_m,
        )
        for j in sindex.intersection(query_box):
            if j <= i:
                continue
            bi = boundaries.iloc[i]
            bj = boundaries.iloc[j]
            # Checking whether boundary distance <= 200 ft.
            if bi.distance(bj) > threshold_m:
                continue
            # Checking whether shared boundary length >= 200 ft.
            shared = bi.intersection(bj).length
            if shared + 1e-9 < threshold_m:
                continue
            recomputed.add(edge_key(ids[i], ids[j]))
    return recomputed


def verify_geometry_for_field_edges(
    gdf: gpd.GeoDataFrame, edges: set, id_col: str, threshold_ft: float
):
    # Re-check geometric constraints for each stored edge and report diagnostics.
    threshold_m = threshold_ft * FT_TO_M
    work = gdf[[id_col, "geometry"]].copy()
    work["geometry"] = work["geometry"].buffer(0)
    work = work[work.geometry.notnull() & (~work.geometry.is_empty)].copy()
    projected = work.to_crs(work.estimate_utm_crs())

    boundary_by_id = {row[id_col]: row.geometry.boundary for _, row in projected.iterrows()}
    violations = 0
    max_dist_ft = 0.0
    min_shared_ft = None
    checked = 0

    for a, b in edges:
        ba = boundary_by_id.get(a)
        bb = boundary_by_id.get(b)
        if ba is None or bb is None:
            violations += 1
            continue
        dist_m = ba.distance(bb)
        shared_m = ba.intersection(bb).length
        dist_ft = dist_m / FT_TO_M
        shared_ft = shared_m / FT_TO_M
        max_dist_ft = max(max_dist_ft, dist_ft)
        min_shared_ft = shared_ft if min_shared_ft is None else min(min_shared_ft, shared_ft)
        checked += 1
        if dist_m > threshold_m + 1e-9 or shared_m + 1e-9 < threshold_m:
            violations += 1

    if min_shared_ft is None:
        min_shared_ft = 0.0

    return {
        "checked_edges": checked,
        "geometry_violations": violations,
        "max_distance_ft": max_dist_ft,
        "min_shared_boundary_ft": min_shared_ft,
    }


def validate_file(
    path: Path,
    id_col: str,
    neighbor_field: str,
    count_field: str,
    threshold_ft: float,
):
    # Combined validation - field consistency, edge-set equality, per-edge geometry checks.
    gdf = gpd.read_file(path)
    if id_col not in gdf.columns:
        raise ValueError(f"{path}: missing id column '{id_col}'")
    property_rows = load_property_rows(path, id_col=id_col)
    if not property_rows:
        raise ValueError(f"{path}: no properties with '{id_col}' found")
    if neighbor_field not in property_rows[0]:
        raise ValueError(f"{path}: missing neighbor field '{neighbor_field}'")

    ids = set(gdf[id_col].tolist())
    neighbor_map, field_edges, issues = build_edge_set_from_field(
        property_rows, ids, id_col, neighbor_field, count_field
    )
    recomputed_edges = recompute_edges(gdf, id_col=id_col, threshold_ft=threshold_ft)
    geom = verify_geometry_for_field_edges(
        gdf, field_edges, id_col=id_col, threshold_ft=threshold_ft
    )

    missing_edges = recomputed_edges - field_edges
    extra_edges = field_edges - recomputed_edges
    isolated = sum(1 for pid in gdf[id_col].tolist() if len(neighbor_map.get(pid, [])) == 0)

    print(f"\n[{path}]")
    print(f"  precincts={len(gdf)}")
    print(f"  field_edges={len(field_edges)}")
    print(f"  recomputed_edges={len(recomputed_edges)}")
    print(f"  missing_edges_vs_recompute={len(missing_edges)}")
    print(f"  extra_edges_vs_recompute={len(extra_edges)}")
    print(f"  isolated_precincts={isolated}")
    print(f"  issues={issues}")
    print(f"  geometry={geom}")

    # Pass only when all structural and geometric checks are clean.
    ok = (
        len(missing_edges) == 0
        and len(extra_edges) == 0
        and issues["unknown_neighbor_refs"] == 0
        and issues["asymmetric_pairs"] == 0
        and issues["self_neighbor_count"] == 0
        and issues["duplicate_neighbors_rows"] == 0
        and issues["non_list_rows"] == 0
        and issues["count_mismatch_rows"] == 0
        and geom["geometry_violations"] == 0
    )
    print(f"  verdict={'PASS' if ok else 'FAIL'}")
    return ok


def main():
    # Validate all input files; non-zero exit if any file fails.
    args = parse_args()
    all_ok = True
    for raw in args.inputs:
        ok = validate_file(
            path=Path(raw),
            id_col=args.id_col,
            neighbor_field=args.neighbor_field,
            count_field=args.count_field,
            threshold_ft=args.threshold_ft,
        )
        all_ok = all_ok and ok
    if not all_ok:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
