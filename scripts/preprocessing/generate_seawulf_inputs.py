#!/usr/bin/env python3
"""
Generate canonical SeaWulf input files for Prepro-6.

This pipeline is intentionally written with only the Python standard library so
it can run in lightweight environments without geopandas installation issues.

Per state, the script writes:
1) A consolidated precinct GeoJSON with geographic, election, district,
   neighbor, and incumbent fields.
2) A graph representation (adjacency JSON + edge list CSV) based on neighbors.
3) A manifest JSON with completeness and consistency checks.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path


DEFAULT_STATES = ("AZ", "CO")
DEFAULT_NEIGHBOR_FIELD = "neighbors_200ft"
DEFAULT_NEIGHBOR_COUNT_FIELD = "neighbor_count_200ft"
DEFAULT_DISTRICT_NUMBER_FIELD = "district_number"


@dataclass
class StateInputs:
    state: str
    neighbor_geojson: Path
    enacted_geojson: Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate SeaWulf-ready graph and precinct data files for one or more states."
    )
    parser.add_argument(
        "--states",
        nargs="+",
        default=list(DEFAULT_STATES),
        help="Two-letter state codes to process (default: AZ CO).",
    )
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=Path("data"),
        help="Directory containing *-precincts-with-results-neighbors.geojson files.",
    )
    parser.add_argument(
        "--geojson-dir",
        type=Path,
        default=Path("public/geojson"),
        help="Directory containing *-precincts-with-results-cvap-with-enacted-districts.geojson files.",
    )
    parser.add_argument(
        "--representation-json",
        type=Path,
        default=Path("backend/src/main/resources/representation.json"),
        help="District representation JSON used to map incumbents onto precincts.",
    )
    parser.add_argument(
        "--outdir",
        type=Path,
        default=Path("results/seawulf_inputs"),
        help="Output directory for generated SeaWulf artifacts.",
    )
    return parser.parse_args()


def read_json(path: Path) -> object:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
        handle.write("\n")


def write_edge_csv(path: Path, edges: list[tuple[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["u", "v"])
        writer.writerows(edges)


def normalize_states(raw_states: list[str]) -> list[str]:
    states: list[str] = []
    for value in raw_states:
        state = value.strip().upper()
        if len(state) != 2 or not state.isalpha():
            raise ValueError(f"Invalid state code: {value!r}")
        if state not in states:
            states.append(state)
    return states


def resolve_inputs(state: str, data_dir: Path, geojson_dir: Path) -> StateInputs:
    neighbor_geojson = data_dir / f"{state}-precincts-with-results-neighbors.geojson"
    enacted_geojson = geojson_dir / f"{state}-precincts-with-results-cvap-with-enacted-districts.geojson"
    if not neighbor_geojson.exists():
        raise FileNotFoundError(f"Missing neighbors file: {neighbor_geojson}")
    if not enacted_geojson.exists():
        raise FileNotFoundError(f"Missing enacted precinct file: {enacted_geojson}")
    return StateInputs(state=state, neighbor_geojson=neighbor_geojson, enacted_geojson=enacted_geojson)


def district_number_from_id(district_id: str | None) -> str | None:
    if district_id is None:
        return None
    match = re.search(r"(\d+)$", str(district_id).strip())
    if not match:
        return None
    return match.group(1).zfill(2)


def load_incumbent_lookup(representation_json: Path) -> dict[str, dict[str, dict[str, object]]]:
    payload = read_json(representation_json)
    if not isinstance(payload, dict):
        raise ValueError("Representation JSON has unexpected format.")

    lookup: dict[str, dict[str, dict[str, object]]] = {}
    for raw_state, rows in payload.items():
        state = str(raw_state).strip().upper()
        if not isinstance(rows, list):
            continue
        state_map: dict[str, dict[str, object]] = {}
        for row in rows:
            if not isinstance(row, dict):
                continue
            district_number = district_number_from_id(row.get("districtId"))
            if district_number is None:
                continue
            state_map[district_number] = {
                "incumbent": row.get("incumbent"),
                "incumbent_party": row.get("party"),
                "incumbent_race_ethnicity": row.get("repRaceEthnicity"),
                "incumbent_vote_margin_pct": row.get("voteMarginPct"),
            }
        lookup[state] = state_map
    return lookup


def index_features_by_geoid(geojson_path: Path, required_fields: list[str]) -> tuple[dict[str, dict[str, object]], dict]:
    payload = read_json(geojson_path)
    if not isinstance(payload, dict):
        raise ValueError(f"GeoJSON root is not an object: {geojson_path}")

    features = payload.get("features")
    if not isinstance(features, list):
        raise ValueError(f"GeoJSON has no feature list: {geojson_path}")

    by_geoid: dict[str, dict[str, object]] = {}
    for feature in features:
        if not isinstance(feature, dict):
            continue
        props = feature.get("properties")
        if not isinstance(props, dict):
            continue
        geoid = props.get("GEOID")
        if geoid is None:
            continue
        geoid_key = str(geoid)

        missing = [field for field in required_fields if field not in props]
        if missing:
            raise ValueError(
                f"Feature {geoid_key} in {geojson_path} is missing required fields: {', '.join(missing)}"
            )
        by_geoid[geoid_key] = feature

    return by_geoid, payload


def merge_state_precincts(
    state: str,
    inputs: StateInputs,
    incumbent_lookup: dict[str, dict[str, dict[str, object]]],
) -> list[dict[str, object]]:
    neighbor_required = ["GEOID", DEFAULT_NEIGHBOR_FIELD, DEFAULT_NEIGHBOR_COUNT_FIELD]
    enacted_required = [
        "GEOID",
        "votes_dem",
        "votes_rep",
        "votes_total",
        "district_id",
        DEFAULT_DISTRICT_NUMBER_FIELD,
        "district_name",
    ]

    neighbor_by_geoid, _ = index_features_by_geoid(inputs.neighbor_geojson, neighbor_required)
    enacted_by_geoid, _ = index_features_by_geoid(inputs.enacted_geojson, enacted_required)

    state_incumbents = incumbent_lookup.get(state, {})
    all_geoids = sorted(set(enacted_by_geoid.keys()) | set(neighbor_by_geoid.keys()))
    merged_features: list[dict[str, object]] = []

    for geoid in all_geoids:
        enacted_feature = enacted_by_geoid.get(geoid)
        neighbor_feature = neighbor_by_geoid.get(geoid)
        if enacted_feature is None:
            continue

        enacted_props = dict(enacted_feature.get("properties") or {})
        neighbor_props = dict((neighbor_feature or {}).get("properties") or {})

        district_number = str(enacted_props.get(DEFAULT_DISTRICT_NUMBER_FIELD, "")).zfill(2)
        incumbent_payload = state_incumbents.get(district_number, {})

        neighbors = neighbor_props.get(DEFAULT_NEIGHBOR_FIELD)
        neighbors_list = neighbors if isinstance(neighbors, list) else []

        # Build one canonical precinct record with all Prepro-6-relevant fields.
        merged_props = dict(enacted_props)
        merged_props["state"] = state
        merged_props[DEFAULT_NEIGHBOR_FIELD] = neighbors_list
        merged_props[DEFAULT_NEIGHBOR_COUNT_FIELD] = len(neighbors_list)
        merged_props["incumbent"] = incumbent_payload.get("incumbent")
        merged_props["incumbent_party"] = incumbent_payload.get("incumbent_party")
        merged_props["incumbent_race_ethnicity"] = incumbent_payload.get("incumbent_race_ethnicity")
        merged_props["incumbent_vote_margin_pct"] = incumbent_payload.get("incumbent_vote_margin_pct")

        merged_features.append(
            {
                "type": "Feature",
                "geometry": enacted_feature.get("geometry"),
                "properties": merged_props,
            }
        )

    return merged_features


def build_graph(features: list[dict[str, object]]) -> tuple[dict[str, list[str]], list[tuple[str, str]]]:
    node_ids = {
        str(feature.get("properties", {}).get("GEOID"))
        for feature in features
        if isinstance(feature.get("properties"), dict)
        and feature.get("properties", {}).get("GEOID") is not None
    }

    adjacency_sets: dict[str, set[str]] = {node_id: set() for node_id in node_ids}
    edges: set[tuple[str, str]] = set()

    for feature in features:
        props = feature.get("properties")
        if not isinstance(props, dict):
            continue
        geoid = props.get("GEOID")
        if geoid is None:
            continue
        geoid_str = str(geoid)
        raw_neighbors = props.get(DEFAULT_NEIGHBOR_FIELD)
        neighbors = raw_neighbors if isinstance(raw_neighbors, list) else []

        for raw_neighbor in neighbors:
            neighbor = str(raw_neighbor)
            if neighbor == geoid_str or neighbor not in node_ids:
                continue
            a, b = sorted((geoid_str, neighbor))
            edges.add((a, b))
            adjacency_sets[a].add(b)
            adjacency_sets[b].add(a)

    adjacency = {node: sorted(list(neigh)) for node, neigh in sorted(adjacency_sets.items())}
    edge_list = sorted(list(edges))
    return adjacency, edge_list


def build_manifest(state: str, features: list[dict[str, object]], adjacency: dict[str, list[str]], edges: list[tuple[str, str]]) -> dict[str, object]:
    required_fields = [
        "GEOID",
        "state",
        "votes_dem",
        "votes_rep",
        "votes_total",
        "district_id",
        DEFAULT_DISTRICT_NUMBER_FIELD,
        "district_name",
        DEFAULT_NEIGHBOR_FIELD,
        DEFAULT_NEIGHBOR_COUNT_FIELD,
        "incumbent",
        "incumbent_party",
    ]

    missing_counts = {field: 0 for field in required_fields}
    district_values: set[str] = set()
    for feature in features:
        props = feature.get("properties")
        if not isinstance(props, dict):
            for field in required_fields:
                missing_counts[field] += 1
            continue
        district = props.get(DEFAULT_DISTRICT_NUMBER_FIELD)
        if district is not None:
            district_values.add(str(district))
        for field in required_fields:
            value = props.get(field)
            if value is None or (isinstance(value, str) and value.strip() == ""):
                missing_counts[field] += 1

    asymmetry_count = 0
    for node, neighbors in adjacency.items():
        for other in neighbors:
            if node not in adjacency.get(other, []):
                asymmetry_count += 1

    return {
        "state": state,
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "precinct_count": len(features),
        "graph_node_count": len(adjacency),
        "graph_edge_count": len(edges),
        "district_count": len(district_values),
        "missing_field_counts": missing_counts,
        "asymmetric_neighbor_links": asymmetry_count,
    }


def export_state(
    state: str,
    features: list[dict[str, object]],
    adjacency: dict[str, list[str]],
    edges: list[tuple[str, str]],
    outdir: Path,
) -> dict[str, object]:
    state_dir = outdir / state
    state_dir.mkdir(parents=True, exist_ok=True)

    manifest = build_manifest(state, features, adjacency, edges)

    consolidated_geojson = {
        "type": "FeatureCollection",
        "features": features,
    }
    write_json(state_dir / f"{state}_precincts_seawulf.geojson", consolidated_geojson)

    attributes = [feature.get("properties", {}) for feature in features]
    write_json(state_dir / f"{state}_precinct_attributes.json", attributes)

    write_json(
        state_dir / f"{state}_graph.json",
        {
            "state": state,
            "node_count": manifest["graph_node_count"],
            "edge_count": manifest["graph_edge_count"],
            "adjacency": adjacency,
        },
    )
    write_edge_csv(state_dir / f"{state}_graph_edges.csv", edges)
    write_json(state_dir / f"{state}_manifest.json", manifest)

    print(
        f"[ok] {state}: precincts={manifest['precinct_count']} "
        f"nodes={manifest['graph_node_count']} edges={manifest['graph_edge_count']} "
        f"missing_incumbent={manifest['missing_field_counts'].get('incumbent', -1)}"
    )
    return manifest


def main() -> int:
    args = parse_args()
    states = normalize_states(args.states)
    incumbent_lookup = load_incumbent_lookup(args.representation_json)

    manifests: list[dict[str, object]] = []
    for state in states:
        inputs = resolve_inputs(state, args.data_dir, args.geojson_dir)
        merged_features = merge_state_precincts(state, inputs, incumbent_lookup)
        adjacency, edges = build_graph(merged_features)
        manifest = export_state(state, merged_features, adjacency, edges, args.outdir)
        manifests.append(manifest)

    write_json(args.outdir / "prepro6_summary.json", manifests)
    print(f"[ok] Wrote Prepro-6 summary -> {args.outdir / 'prepro6_summary.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
