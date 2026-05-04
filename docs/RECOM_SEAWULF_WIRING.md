# ReCom SeaWulf Wiring Reference

Quick-reference for how the ReCom scripts connect: input formats, output formats, and
which script feeds which. For the full use-case narrative see [SEAWULF_PIPELINE.md](SEAWULF_PIPELINE.md).

---

## Script Dependency Graph

```
generate_seawulf_inputs.py (Prepro-6)
  └─ writes results/seawulf_inputs/<STATE>/
       ├─ <STATE>_graph.json            ─→  recom_driver.py
       ├─ <STATE>_precinct_attributes.json ─→ recom_driver.py
       └─ <STATE>_precincts_seawulf.geojson (reference)

recom_driver.py (SeaWulf-2/3/5)
  └─ imported by recom_worker.py via `from recom_driver import generate_plans`

recom_parallel.slurm (SeaWulf-1/4/12)
  ├─ spawns N × recom_worker.py
  └─ runs merge_parallel_results.py after all workers finish

merge_parallel_results.py (SeaWulf-4)
  └─ writes results/seawulf_inputs/<STATE>/recom_parallel_merged_<STATE>[_vra].json

generate_ensemble_splits.py (SeaWulf-8/10)
  └─ reads merged files → writes backend/src/main/resources/ensemble-splits.json

generate_ensemble_boxplot.py (SeaWulf-6/7/11)
  └─ reads merged files + precinct_attributes → writes backend/src/main/resources/ensemble-boxplot.json
```

---

## Input File Formats

### `<STATE>_graph.json`

```json
{
  "state": "AZ",
  "node_count": 1716,
  "edge_count": 9204,
  "adjacency": {
    "04001000100": ["04001000200", "04001000300"],
    ...
  }
}
```

### `<STATE>_precinct_attributes.json`

Array of objects, one per precinct:

```json
[
  {
    "GEOID": "04001000100",
    "district_number": 1,
    "votes_dem": 1234,
    "votes_rep": 987,
    "votes_total": 2221,
    "CVAP_TOT24": 3100.0,
    "CVAP_HSP24": 800.0,
    "CVAP_BLA24": 120.0,
    "CVAP_ASI24": 60.0,
    "CVAP_WHT24": 2000.0
  },
  ...
]
```

`CVAP_HSP24` is the key field for Latino VRA-constrained runs (`--vra-group-field CVAP_HSP24`).

---

## Output File Formats

### Per-worker shard (`recom_worker_<STATE>_<id>.json`)

Array of plan records:

```json
[
  {
    "state": "AZ",
    "worker": 3,
    "step": 42,
    "district_populations": { "1": 758000, "2": 762000, ... },
    "winners": { "1": "D", "2": "R", ... },
    "split": { "R": 5, "D": 4 },
    "assignment": { "04001000100": 1, "04001000200": 2, ... }
  },
  ...
]
```

### Merged ensemble (`recom_parallel_merged_<STATE>[_vra].json`)

```json
{
  "state": "AZ",
  "summary": {
    "num_plans": 5000,
    "avg_R": 5.2, "avg_D": 3.8,
    "min_R": 2,   "max_R": 9,
    "min_D": 0,   "max_D": 7
  },
  "plans": [ ... ],
  "source_files": ["recom_worker_AZ_0.json", ...]
}
```

---

## Command Reference

### Race-Blind Single Chain (development / test)

```powershell
# Run from project root
python scripts/seawulf/recom_driver.py \
  --state AZ \
  --steps 250 \
  --seed 42 \
  --input-root results/seawulf_inputs \
  --output results/recom_AZ_test.json
```

### VRA-Constrained Single Chain (development / test)

```powershell
python scripts/seawulf/recom_driver.py \
  --state AZ \
  --steps 250 \
  --seed 42 \
  --input-root results/seawulf_inputs \
  --output results/recom_AZ_vra_test.json \
  --vra-group-field CVAP_HSP24 \
  --vra-min-districts 2 \
  --vra-threshold 0.50
```

### Single Worker (testing the worker script directly)

```powershell
python scripts/seawulf/recom_worker.py 0 25 \
  --state AZ \
  --input-root results/seawulf_inputs
# writes to: results/recom_worker_AZ_0.json
```

### Merge Worker Shards

```powershell
python scripts/seawulf/merge_parallel_results.py \
  --state AZ \
  --pattern "results/seawulf_inputs/AZ/recom_worker_AZ_*.json" \
  --output results/seawulf_inputs/AZ/recom_parallel_merged_AZ.json
```

### Generate Backend JSON from Merged Files

```powershell
# R/D splits (SeaWulf-8/10)
python scripts/seawulf/generate_ensemble_splits.py

# Box & whisker + effectiveness (SeaWulf-6/7/11)
python scripts/seawulf/generate_ensemble_boxplot.py
```

---

## SeaWulf SLURM Submission

Both SLURM scripts reference paths relative to `scripts/seawulf/` on the HPC.
Sync the project to SeaWulf before submitting:

```bash
# Sync inputs
rsync -av results/seawulf_inputs/ \
  <user>@login.seawulf.stonybrook.edu:~/cse416/results/seawulf_inputs/

# Sync scripts
rsync -av scripts/seawulf/ \
  <user>@login.seawulf.stonybrook.edu:~/cse416/scripts/seawulf/

# Submit race-blind job
ssh <user>@login.seawulf.stonybrook.edu \
  "cd ~/cse416 && STATE=AZ TOTAL=5000 WORKERS=28 sbatch scripts/seawulf/recom_parallel.slurm"

# Submit VRA-constrained job
ssh <user>@login.seawulf.stonybrook.edu \
  "cd ~/cse416 && STATE=AZ TOTAL=5000 WORKERS=28 \
   VRA_GROUP_FIELD=CVAP_HSP24 VRA_MIN_DISTRICTS=2 VRA_THRESHOLD=0.50 \
   sbatch scripts/seawulf/recom_parallel.slurm"
```

---

## Key Constants

| Constant | Location | Value | Use Case |
|---|---|---|---|
| Population tolerance | `recom_driver.py --pop-tolerance-pct` | 5% | Population equality constraint |
| Opportunity threshold | `--vra-threshold` | 0.50 | SeaWulf-6/7: effective district test |
| Feasible group CVAP min | `generate_seawulf_inputs.py` | 400,000 | Determines which groups are analyzed |
| Test ensemble size | — | 250 plans | Development/validation |
| Production ensemble size | `TOTAL=5000` | 5,000 plans | Final presentation |
| Node cores | `--cpus-per-task=28` | 28 | SeaWulf-12 intra-node parallelism |
