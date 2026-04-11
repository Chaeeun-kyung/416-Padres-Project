# SeaWulf Prepro-6 Data Generation

This guide documents the canonical preprocessing command for Prepro-6:

"Generate all data files required for SeaWulf processing, including graph
representation and geographic/election/incumbent precinct data."

## Script

- `scripts/generate_seawulf_inputs.py`

## Inputs (existing project files)

- `data/<STATE>-precincts-with-results-neighbors.geojson`
- `public/geojson/<STATE>-precincts-with-results-cvap-with-enacted-districts.geojson`
- `backend/src/main/resources/representation.json`

## Outputs

Per state, under `results/seawulf_inputs/<STATE>/`:

- `<STATE>_precincts_seawulf.geojson`
  - Consolidated precinct file with geometry, election fields, district fields,
    neighbors, and incumbent fields.
- `<STATE>_precinct_attributes.json`
  - Non-geometry precinct attributes for fast script loading.
- `<STATE>_graph.json`
  - Adjacency list graph representation of precinct contiguity.
- `<STATE>_graph_edges.csv`
  - Edge-list graph representation (`u,v`) for compatibility with other tools.
- `<STATE>_manifest.json`
  - Validation and completeness metrics.

Global summary:

- `results/seawulf_inputs/prepro6_summary.json`

## Run

From project root:

```powershell
python scripts/generate_seawulf_inputs.py --states AZ CO
```

Optional path overrides:

```powershell
python scripts/generate_seawulf_inputs.py \
  --states AZ CO \
  --data-dir data \
  --geojson-dir public/geojson \
  --representation-json backend/src/main/resources/representation.json \
  --outdir results/seawulf_inputs
```

## Verification Checklist

- `missing_field_counts.incumbent == 0` for each state manifest
- `graph_node_count == precinct_count`
- `asymmetric_neighbor_links == 0`
- both AZ and CO entries are present in `prepro6_summary.json`

## Why this helps later SeaWulf test cases

- Single canonical generation step reduces drift between scripts.
- Deterministic ordering keeps outputs stable across reruns.
- Two graph formats (adjacency + edge list) support different downstream tools.
- Manifest metrics provide quick regression checks before SeaWulf submissions.
