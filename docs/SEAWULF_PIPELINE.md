# SeaWulf Pipeline — Full Reference

This document covers every preprocessing and SeaWulf use case (Prepro-1 through Prepro-11,
SeaWulf-1 through SeaWulf-13) and shows exactly which scripts, files, and commands implement each one.

---

## Use Case Map

| Use Case | Category | Script(s) | Required / Preferred |
|---|---|---|---|
| Prepro-1 | Integrate data sources | `merge_az_cvap.py`, `merge_co_cvap.py`, `integrate_enacted_plan.py` | Required |
| Prepro-2 | Identify precinct neighbors | `preprocess_neighbors.py`, `validate_neighbors.py` | Required |
| Prepro-3 | Integrate enacted plan | `integrate_enacted_plan.py` | Required |
| Prepro-4 | Store preprocessed data | Spring Boot seeder + MongoDB | Required |
| Prepro-5 | Store SeaWulf data | `generate_ensemble_splits.py`, `generate_ensemble_boxplot.py` + seeder | Required |
| Prepro-6 | Generate SeaWulf input files | `generate_seawulf_inputs.py` | Required |
| Prepro-7 | Gingles 2/3 precinct analysis | `preprocess_gingles.py` | Required |
| Prepro-8 | Gingles 2/3 regression | `preprocess_gingles.py` | Required |
| Prepro-9 | Ecological Inference (PyEI) | `preprocess_ei.py` | Required |
| Prepro-10 | Vote share vs seat share | *(pending — optional)* | Preferred |
| Prepro-11 | Enacted boxplot data | `preprocess_enacted_boxplot.py` | Required |
| SeaWulf-1 | Server dispatcher + staging | `recom_driver.slurm`, `recom_parallel.slurm` | Required |
| SeaWulf-2 | Race-blind ReCom | `recom_driver.py` / `recom_worker.py` (no VRA flags) | Required |
| SeaWulf-3 | VRA-constrained ReCom | `recom_driver.py` / `recom_worker.py` (with `--vra-*` flags) | Required |
| SeaWulf-4 | Coordinate multi-core output | `recom_worker.py` + `merge_parallel_results.py` | Required |
| SeaWulf-5 | Calculate election winners | built into `recom_driver.py::_estimate_winners()` | Required |
| SeaWulf-6 | Minority effectiveness score | `generate_ensemble_boxplot.py` | Required |
| SeaWulf-7 | Minority population % per district | `generate_ensemble_boxplot.py` | Required |
| SeaWulf-8 | R/D split per plan | `generate_ensemble_splits.py` | Required |
| SeaWulf-9 | Identify interesting plans | *(not yet implemented — preferred)* | Preferred |
| SeaWulf-10 | Ensemble summary measures | `generate_ensemble_splits.py` + `generate_ensemble_boxplot.py` | Required |
| SeaWulf-11 | Box & whisker data | `generate_ensemble_boxplot.py` | Required |
| SeaWulf-12 | Multi-node parallelism | `recom_parallel.slurm` (28-core single node) | Preferred |
| SeaWulf-13 | Python profiler | *(optional — use `cProfile` on recom_driver)* | Preferred |

---

## Preprocessing Pipeline (Prepro-1 through Prepro-11)

### Prepro-1 — Integrate Multiple Data Sources

**Purpose:** Merge US Census CVAP data, precinct boundaries, and election results into a single
precinct-level GeoJSON that the rest of the pipeline consumes.

**Scripts:**

| Script | Role |
|---|---|
| `scripts/preprocessing/merge_az_cvap.py` | Joins AZ census block CVAP counts onto precinct polygons via area-weighted interpolation. Writes `public/geojson/AZ-precincts-with-results-cvap.geojson`. |
| `scripts/preprocessing/merge_co_cvap.py` | Same for Colorado. Writes `public/geojson/CO-precincts-with-results-cvap.geojson`. |

**Input files required (not in repo — obtain externally):**

- `data/<STATE>-precincts-with-results.geojson` — precinct boundaries + 2024 election results
- `<state>_pl2020_b/<state>_pl2020_p4_b.shp` — 2020 census block shapefile
- `<state>_cvap_2024_2020_b_csv/<state>_cvap_2024_2020_b.csv` — CVAP estimates by block

**Key CVAP fields produced on each precinct:**

| Field | Meaning |
|---|---|
| `CVAP_TOT24` | Total citizen voting-age population |
| `CVAP_HSP24` | Hispanic/Latino CVAP |
| `CVAP_BLA24` | Black (non-Hispanic) CVAP |
| `CVAP_ASI24` | Asian CVAP |
| `CVAP_WHT24` | White (non-Hispanic) CVAP |

**Run:**
```powershell
python scripts/preprocessing/merge_az_cvap.py
python scripts/preprocessing/merge_co_cvap.py
```

---

### Prepro-2 — Identify Precinct Neighbors

**Purpose:** For each precinct, identify all adjacent precincts that share at least 200 feet of
common boundary. This produces the adjacency information that GerryChain uses to build the
precinct graph.

**Script:** `scripts/preprocessing/preprocess_neighbors.py`

**Rule:** Two precincts are neighbors if their shared boundary is ≥ 200 ft and their edges are
within 200 ft of each other (uses projected CRS for accurate measurement).

**Writes:** `neighbors_200ft` and `neighbor_count_200ft` fields back into the GeoJSON feature
properties, producing:
- `data/AZ-precincts-with-results-neighbors.geojson`
- `data/CO-precincts-with-results-neighbors.geojson`

**Run:**
```powershell
python scripts/preprocessing/preprocess_neighbors.py \
  --inputs data/AZ-precincts-with-results.geojson data/CO-precincts-with-results.geojson
```

**Validation:** `scripts/preprocessing/validate_neighbors.py` checks reciprocity (if A lists B,
B must list A), geometry constraints, and completeness. Run it immediately after:
```powershell
python scripts/preprocessing/validate_neighbors.py \
  --inputs data/AZ-precincts-with-results-neighbors.geojson \
           data/CO-precincts-with-results-neighbors.geojson
```

---

### Prepro-3 — Integrate Enacted Plan with Dataset

**Purpose:** Join each precinct's CVAP data with the enacted congressional district boundaries
so every precinct knows which district it belongs to. This produces the enriched GeoJSON
served to the frontend.

**Script:** `scripts/preprocessing/integrate_enacted_plan.py`

**Inputs:**
- `public/geojson/<STATE>-precincts-with-results-cvap.geojson` (from Prepro-1)
- `public/geojson/<STATE>-districts.geojson` — enacted district boundaries

**Output:**
- `public/geojson/<STATE>-precincts-with-results-cvap-with-enacted-districts.geojson`
  — adds `district_number`, `district_name`, `plan_type` fields to each precinct feature

**Run:**
```powershell
python scripts/preprocessing/integrate_enacted_plan.py
```

---

### Prepro-4 — Store Preprocessed Data

**Purpose:** Persist all precomputed analysis results in MongoDB so the Spring Boot backend can
serve them at query time without re-running computation on every request.

**Mechanism:** `backend/src/main/java/app/bootstrap/PreprocessedDataMongoSeeder.java` runs
at application startup (controlled by `app.seed.preprocessed-data-on-startup=true` in
`application.properties`). It reads each JSON from `backend/src/main/resources/` and upserts
records into MongoDB.

**Collections seeded:**

| MongoDB Collection | Source File | Content |
|---|---|---|
| `stateSummary` | `state-summary.json` | Demographics, population, party summary |
| `ginglesAnalysis` | `gingles-analysis.json` | Scatter points + trend curves |
| `eiAnalysis` | `ei-analysis.json` | EI density curves |
| `representation` | `representation.json` | Enacted-plan district representatives |
| `ensembleSplits` | `ensemble-splits.json` | R/D split frequency histograms |
| `ensembleBoxplot` | `ensemble-boxplot.json` | Ranked minority % distributions |
| `enactedBoxplot` | `enacted-boxplot.json` | Enacted-plan minority % per district |

The seeder is idempotent — it drops and re-seeds on every restart when `app.seed` is `true`.

---

### Prepro-5 — Store SeaWulf Data

**Purpose:** After running the SeaWulf ensemble jobs, convert the raw plan output files into
compact summary JSON and load them into MongoDB via the seeder.

**Scripts that produce the summary JSON:**

- `scripts/seawulf/generate_ensemble_splits.py` → `backend/src/main/resources/ensemble-splits.json`
- `scripts/seawulf/generate_ensemble_boxplot.py` → `backend/src/main/resources/ensemble-boxplot.json`

Once these JSON files are regenerated, restart the backend to re-seed MongoDB (or set
`app.seed.preprocessed-data-on-startup=true` and bounce the server).

**See also:** SeaWulf-6, SeaWulf-7, SeaWulf-8, SeaWulf-10, SeaWulf-11 for what each file contains.

---

### Prepro-6 — Generate SeaWulf Input Files

**Purpose:** From the integrated precinct data (Prepro-1 through Prepro-3), produce the
canonical input artifacts that the ReCom scripts and SLURM jobs consume on SeaWulf.

**Script:** `scripts/preprocessing/generate_seawulf_inputs.py`

**Inputs:**
- `data/<STATE>-precincts-with-results-neighbors.geojson` (Prepro-2 output)
- `public/geojson/<STATE>-precincts-with-results-cvap-with-enacted-districts.geojson` (Prepro-3 output)
- `backend/src/main/resources/representation.json` (for incumbent fields)

**Outputs per state** under `results/seawulf_inputs/<STATE>/`:

| File | Description |
|---|---|
| `<STATE>_precincts_seawulf.geojson` | Consolidated precinct file: geometry + election + CVAP + district + neighbor + incumbent fields |
| `<STATE>_precinct_attributes.json` | Non-geometry precinct attributes for fast script loading (no GeoJSON overhead) |
| `<STATE>_graph.json` | Adjacency list: `{ "adjacency": { "GEOID": ["neighbor_GEOID", ...] } }` |
| `<STATE>_graph_edges.csv` | Edge list `u,v` for compatibility with other graph tools |
| `<STATE>_manifest.json` | Validation metrics: node count, edge count, missing fields, asymmetric links |

Global summary: `results/seawulf_inputs/prepro6_summary.json`

**Run:**
```powershell
python scripts/preprocessing/generate_seawulf_inputs.py --states AZ CO
```

**Validation checklist (check manifests before SeaWulf submission):**
- `missing_field_counts.incumbent == 0` for each state
- `graph_node_count == precinct_count`
- `asymmetric_neighbor_links == 0`
- Both AZ and CO entries present in `prepro6_summary.json`

---

### Prepro-7 — Gingles 2/3 Precinct Analysis

**Purpose:** For each precinct, compute the racial/ethnic group share and the 2024 Presidential
vote share. These per-precinct (x, y) points form the Gingles 2/3 scatter plot (GUI-9, GUI-10).
Also identifies feasible demographic groups (statewide CVAP ≥ 400,000).

**Script:** `scripts/preprocessing/preprocess_gingles.py`

**Output:**
- `public/data/gingles_meta_AZ.json`, `public/data/gingles_meta_CO.json`
  — per-state metadata: feasible groups, trend curve control points
- `public/data/gingles_points.json` — all precinct scatter points (served statically)
- `backend/src/main/resources/gingles-analysis.json` — backend-ready grouped data

**Feasible groups check:** A racial/language group is only included if its total statewide
CVAP exceeds 400,000. For AZ and CO this currently qualifies White and Latino.

**Run:**
```powershell
python scripts/preprocessing/preprocess_gingles.py
```

---

### Prepro-8 — Gingles 2/3 Non-Linear Regression

**Purpose:** Fit a non-linear (logistic) regression curve to the Gingles scatter data for
each feasible racial group. The trend curves show the relationship between minority group
share and party vote share, providing the visual guide for racially polarized voting analysis.

**Script:** Same as Prepro-7 — `scripts/preprocessing/preprocess_gingles.py`

The script fits both Democratic and Republican trend curves using scipy's `curve_fit` with a
logistic model. Multiple equation forms are tested; the best-fit curve is selected by residual
sum of squares. Trend point arrays (90 evenly-spaced x values with fitted y) are written into
the gingles-analysis JSON.

---

### Prepro-9 — Ecological Inference (PyEI)

**Purpose:** Use the PyEI MGGG library to estimate, for each racial/ethnic group, the probability
distribution of support for each party in the 2024 Presidential race. This addresses the
fundamental EI problem: census data and vote totals are available at the precinct level, but
individual-level race-vote data is not.

**Script:** `scripts/preprocessing/preprocess_ei.py`

**Method:** 2×2 Ecological Inference (`TwoByTwoEI`) using King (1999) Pareto modification.
For each feasible group, produces a posterior density curve (KDE) of group vote share.

**Inputs:**
- `results/seawulf_inputs/<STATE>/<STATE>_precinct_attributes.json` (from Prepro-6)
  — provides `CVAP_HSP24`, `CVAP_WHT24`, `votes_dem`, `votes_total` per precinct

**Output:**
- `backend/src/main/resources/ei-analysis.json` — density point arrays per state/group
- `results/meta_ei.json` — validation report (effective sample sizes, convergence flags)

**Run:**
```powershell
python scripts/preprocessing/preprocess_ei.py
```

---

### Prepro-10 — Vote Share vs Seat Share Curve (Preferred)

**Purpose:** If a state shows racially polarized voting (i.e., Gingles 2/3 is satisfied),
compute the vote share vs seat share curve to quantify partisan efficiency. Uses the Shen
software approach with fine-grained vote share increments to reduce stair-stepping.

**Status:** Not yet implemented. This is a preferred (non-required) use case.
When implemented it will write to `backend/src/main/resources/vote-seat-curve.json`
and be displayed by a new frontend component (GUI-18).

---

### Prepro-11 — Enacted Plan Box & Whisker Data

**Purpose:** For each enacted congressional district, compute the minority group CVAP percentage.
These per-district dots are overlaid on the ensemble box & whisker chart (GUI-17) so the user
can see where the enacted plan falls relative to the ensemble distribution.

**Script:** `scripts/preprocessing/preprocess_enacted_boxplot.py`

**Inputs:**
- `public/geojson/<STATE>-precincts-with-results-cvap-with-enacted-districts.geojson` (Prepro-3 output)

**Output:**
- `backend/src/main/resources/enacted-boxplot.json`
  — per-state, per-group array of district minority percentages sorted ascending

**Run:**
```powershell
python scripts/preprocessing/preprocess_enacted_boxplot.py
```

---

## SeaWulf Use Cases (SeaWulf-1 through SeaWulf-13)

### SeaWulf-1 — Server Dispatcher / Job Staging

**Purpose:** Before submitting a batch run, all data required for the run must be marshalled
and staged in the SeaWulf file system. The SLURM scripts serve as the dispatcher.

**Scripts:**
- `scripts/seawulf/recom_driver.slurm` — single-chain dispatcher (development/test runs)
- `scripts/seawulf/recom_parallel.slurm` — 28-core parallel dispatcher (production 5,000-plan runs)

**Staging procedure:**
1. Run Prepro-6 locally: `python scripts/preprocessing/generate_seawulf_inputs.py --states AZ CO`
2. Sync `results/seawulf_inputs/` to SeaWulf: `rsync -av results/seawulf_inputs/ <user>@seawulf.seawulf.stonybrook.edu:~/cse416/results/seawulf_inputs/`
3. Sync `scripts/seawulf/` to SeaWulf: `rsync -av scripts/seawulf/ <user>@seawulf.seawulf.stonybrook.edu:~/cse416/scripts/seawulf/`
4. Submit job: `sbatch scripts/seawulf/recom_parallel.slurm`

**SLURM configuration** (recom_parallel.slurm):

| Parameter | Value | Purpose |
|---|---|---|
| `--cpus-per-task` | 28 | Full single-node core allocation |
| `--mem` | 32G | Node memory |
| `--time` | 02:00:00 | 2-hour wall time for 5,000-plan runs |
| `--partition` | short-28core | Short-queue 28-core partition |

**Pre-run environment variables:**

```bash
STATE=AZ               # or CO
TOTAL=5000             # number of plans in ensemble
WORKERS=4              # parallel Python processes (≤ cpus-per-task)
SEED=42                # reproducibility seed

# VRA-constrained mode (omit for race-blind):
VRA_GROUP_FIELD=CVAP_HSP24
VRA_MIN_DISTRICTS=2
VRA_THRESHOLD=0.50
```

---

### SeaWulf-2 — Run Race-Blind ReCom Algorithm

**Purpose:** Generate a random ensemble of district plans using MGGG's ReCom algorithm with
no VRA constraint — purely population-equality-bounded random redistricting.
Target: test ensemble ≈ 250 plans; production ensemble = 5,000 plans.

**Script:** `scripts/seawulf/recom_driver.py` (single chain) or
           `scripts/seawulf/recom_parallel.slurm` (parallel, production)

**Algorithm:** Simplified ReCom —
1. Select two adjacent districts at random.
2. Merge their precincts into a single subgraph.
3. Build a minimum spanning tree of the merged subgraph.
4. Remove one spanning-tree edge so both components are within `pop_tolerance_pct` of equal population.
5. If no valid cut exists, try another district pair; otherwise accept the split and record the new plan.

Each accepted plan records: `state`, `step`, `district_populations`, `winners` (D/R per district),
`split` ({R: x, D: y}), `assignment` (GEOID → district_number).

**Race-blind run example:**
```powershell
python scripts/seawulf/recom_driver.py --state AZ --steps 250 --seed 42
```

**Population tolerance:** Default ±5% deviation from the ideal half-population in each recombined
pair (`--pop-tolerance-pct 0.05`). Matches the population equality constraint in the use case spec.

---

### SeaWulf-3 — Run VRA-Constrained ReCom Algorithm

**Purpose:** Generate an ensemble of district plans under VRA compliance constraints — candidate
plans that do not maintain at least `VRA_MIN_DISTRICTS` opportunity districts for the specified
minority group are rejected and the chain stays at the current plan.

**Script:** Same as SeaWulf-2 — `scripts/seawulf/recom_driver.py` and `recom_worker.py`,
but with VRA flags.

**VRA constraint mechanism:**
- `--vra-group-field CVAP_HSP24` — specifies which CVAP field to use for the opportunity test
- `--vra-min-districts 2` — minimum number of districts where group share ≥ threshold
- `--vra-threshold 0.50` — opportunity district threshold (default 50% CVAP share)

After each ReCom step, the candidate plan's minority share per district is computed using the
`<STATE>_precinct_attributes.json` CVAP data. If the count of districts meeting the threshold
is below `vra-min-districts`, the candidate plan is rejected and the chain does not advance.

**VRA-constrained run example:**
```powershell
python scripts/seawulf/recom_driver.py \
  --state AZ --steps 250 --seed 42 \
  --vra-group-field CVAP_HSP24 \
  --vra-min-districts 2 \
  --vra-threshold 0.50
```

**Output file naming:** Constrained merged output is stored as
`results/seawulf_inputs/<STATE>/recom_parallel_merged_<STATE>_vra.json` so it can be
distinguished from the race-blind merged file.

---

### SeaWulf-4 — Coordinate / Aggregate Multi-Core Output

**Purpose:** Distribute the ensemble generation work across multiple CPU cores on a single
SeaWulf node, then aggregate all per-core outputs into one merged ensemble file when all
workers finish.

**Scripts:**
- `scripts/seawulf/recom_worker.py` — one process per core; imports `generate_plans` from `recom_driver.py`
- `scripts/seawulf/merge_parallel_results.py` — merges all `recom_worker_<STATE>_<id>.json` shards
- `scripts/seawulf/recom_parallel.slurm` — coordinates the full lifecycle

**Coordination mechanism in recom_parallel.slurm:**
1. Compute plans-per-worker: distribute `TOTAL` plans evenly; first `REM` workers get one extra.
2. Launch each `recom_worker.py` invocation in the background (`&`).
3. `wait` until all workers exit.
4. Run `merge_parallel_results.py` to aggregate worker shards into one file.

**Per-worker seed divergence:** Each worker uses `base_seed + worker_id` to ensure their
Markov chains explore different parts of the plan space.

**Merged output format:**
```json
{
  "state": "AZ",
  "summary": { "num_plans": 5000, "avg_R": 5.2, "avg_D": 4.8, "min_R": 2, "max_R": 9, ... },
  "plans": [ { "state": "AZ", "step": 0, "split": {...}, "assignment": {...}, ... }, ... ],
  "source_files": ["recom_worker_AZ_0.json", ...]
}
```

---

### SeaWulf-5 — Calculate Election Winners

**Purpose:** For each district in each generated plan, estimate which party wins the election
by summing the 2024 Presidential precinct-level vote totals across all precincts assigned to
that district.

**Implementation:** Built into `scripts/seawulf/recom_driver.py`, function `_estimate_winners()`.

**Method:**
1. Load `<STATE>_precinct_attributes.json` which contains `votes_dem` and `votes_rep` per precinct.
2. For each candidate plan's `assignment` map (GEOID → district), aggregate votes by district.
3. The party with more aggregated votes wins that district.
4. Record `winners: { "1": "D", "2": "R", ... }` and `split: { "R": x, "D": y }` in the plan record.

This is equivalent to using 2024 Presidential results as the uniform swing model for
estimating election outcomes across simulated plans (as specified in SeaWulf-5 and SeaWulf-8).

---

### SeaWulf-6 — Minority Effectiveness Score Per District

**Purpose:** For each district in each ensemble plan, calculate the minority effectiveness score
for each feasible group. A district is "effective" if the group's CVAP share in that district
meets or exceeds the effectiveness threshold (default 50%).

**Script:** `scripts/seawulf/generate_ensemble_boxplot.py`

**Method:**
1. For each plan, use the `assignment` map to group precincts by district.
2. Sum `CVAP_HSP24` (or other group field) and `CVAP_TOT24` across each district's precincts.
3. Compute group share = group CVAP / total CVAP per district.
4. Mark district as effective if share ≥ threshold.
5. Store effective district count per plan in the boxplot summary.

**Threshold:** Defaults to 50% CVAP share as the opportunity district threshold.

---

### SeaWulf-7 — Minority Population Percentage Per District

**Purpose:** For each district in each ensemble plan, compute the minority group percentage
of the total CVAP. These per-district percentages (sorted ascending) form the distributions
displayed in the box & whisker chart (GUI-17).

**Script:** `scripts/seawulf/generate_ensemble_boxplot.py` (same run as SeaWulf-6)

**Method:**
1. For each plan assignment, aggregate group CVAP by district (same as SeaWulf-6).
2. Sort districts within the plan by group % ascending (rank 1 = lowest minority share).
3. Across all plans in the ensemble, collect the distribution of group % values at each rank.
4. Write the ranked distributions as boxplot quartile data.

**Output structure in ensemble-boxplot.json:**
```json
{
  "AZ": {
    "latino_pct": {
      "raceBlind": {
        "distributions": { "1": [0.12, 0.15, ...], "2": [...], ... },
        "enacted": { "1": 0.19, "2": 0.28, ... }
      },
      "vraConstrained": { ... }
    }
  }
}
```

---

### SeaWulf-8 — R/D Split for Each Random District Plan

**Purpose:** Count how many plans in the ensemble produced each distinct Republican/Democratic
seat split. These frequency counts form the ensemble splits bar chart (GUI-16), showing the
distribution of partisan outcomes across all simulated elections.

**Script:** `scripts/seawulf/generate_ensemble_splits.py`

**Inputs:**
- `results/seawulf_inputs/<STATE>/recom_parallel_merged_<STATE>.json` (race-blind)
- `results/seawulf_inputs/<STATE>/recom_parallel_merged_<STATE>_vra.json` (VRA-constrained)

**Method:**
1. Read every plan's `split` field `{R: x, D: y}`.
2. Use a `Counter` to tally how many plans produced each `repWins` value.
3. Normalize to frequency (count / total plans).
4. Write per-state, per-ensemble frequency arrays.

**Run:**
```powershell
python scripts/seawulf/generate_ensemble_splits.py
```

**Output:** `backend/src/main/resources/ensemble-splits.json`

---

### SeaWulf-9 — Identify and Store Interesting Plans (Preferred)

**Purpose:** Identify a small set (5–10) of "interesting" plans from the ensemble for individual
display on the map (GUI-19). At minimum: plans with maximum and minimum minority effectiveness.

**Status:** Not yet implemented. This is a preferred (non-required) use case.

When implemented:
- Add a `--select-interesting` flag to `generate_ensemble_boxplot.py` or a separate script.
- Store selected plans' full `assignment` maps in `backend/src/main/resources/interesting-plans.json`.
- Expose via a new backend endpoint `GET /api/states/{stateCode}/ensembles/interesting`.
- Display in frontend MapPanel using a plan-selector toggle.

---

### SeaWulf-10 — Calculate Ensemble Summary Measures

**Purpose:** Compute aggregate measures across all plans in an ensemble: total plan count,
R/D split distribution, minority effective district counts, and opportunity district counts.
These figures populate the "Ensemble Summary" strip at the top of the Ensembles tab (GUI-16/17).

**Scripts:** Both `generate_ensemble_splits.py` and `generate_ensemble_boxplot.py` contribute.
- Split script computes: `num_plans`, `splits` distribution
- Boxplot script computes: effective district counts, opportunity district counts per group

**Displayed in frontend:** `RightPanelPageOne.jsx` → `EnsembleSummaryStrip` reads from
`summary.ensembleSummary` (populated by the `/api/states/{state}/summary` endpoint from
`state-summary.json`).

---

### SeaWulf-11 — Calculate Box & Whisker Data

**Purpose:** For each feasible racial/ethnic group in each state, compute the box & whisker
summary across all ensemble plans. Each box in the chart represents one "district rank" position
(districts sorted by group % ascending within each plan), and shows the distribution of group
percentages across all plans at that rank.

**Script:** `scripts/seawulf/generate_ensemble_boxplot.py`

**Run:**
```powershell
python scripts/seawulf/generate_ensemble_boxplot.py
```

**What the chart shows (GUI-17):**
- X-axis: district rank (1 = lowest minority share, N = highest)
- Y-axis: minority group CVAP percentage
- Box: interquartile range (25th–75th percentile) across all plans
- Whiskers: 5th–95th percentile
- Dots: enacted plan values (from Prepro-11)
- Two overlaid charts: race-blind ensemble vs VRA-constrained ensemble

**Feasible groups processed:** Only groups where statewide CVAP ≥ 400,000. For current states
this is White and Latino (AZ and CO both qualify for both groups).

---

### SeaWulf-12 — Multi-Node Parallelism (Preferred)

**Purpose:** Run the ReCom algorithm across multiple SeaWulf nodes using MPI-style coordination
for larger or faster ensemble generation.

**Current implementation:** `recom_parallel.slurm` achieves intra-node parallelism across all
28 cores of a `short-28core` node by spawning 28 independent Python worker processes. This
provides sufficient throughput for the required 5,000-plan ensembles within the 2-hour wall time.

**Multi-node (MPI) status:** Not yet implemented. Would require wrapping the worker launch in
`srun` with `--ntasks-per-node` and using `mpi4py` for cross-node coordination.

**Current speed estimate:** 28 workers × ~180 plans/worker = ~5,000 plans in one SLURM job.
Actual throughput depends on state graph size (AZ: ~1,700 precincts; CO: ~2,400 precincts).

---

### SeaWulf-13 — Python Profiler (Preferred)

**Purpose:** Identify performance bottlenecks in the ReCom pipeline using `cProfile`.

**How to run:**
```bash
# On SeaWulf (from scripts/seawulf/):
python -m cProfile -o recom_profile.stats recom_driver.py \
  --state AZ --steps 50 --seed 42

# Analyze results:
python -c "
import pstats, io
s = pstats.Stats('recom_profile.stats')
s.sort_stats('cumulative')
s.print_stats(20)
"
```

**Typical bottlenecks to watch:**
- `_compute_minority_pct()` — called once per proposed step per VRA-constrained run
- `find_balanced_tree_cut()` — minimum spanning tree construction per step
- GeoJSON I/O at startup (`loadPrecinctGeoJSON`)

---

## End-to-End Run Order

Run these in sequence from the project root to go from raw data to a fully populated
backend database:

```
# Step 1 — CVAP merge (run once per data update)
python scripts/preprocessing/merge_az_cvap.py
python scripts/preprocessing/merge_co_cvap.py

# Step 2 — Neighbor computation (run once)
python scripts/preprocessing/preprocess_neighbors.py \
  --inputs data/AZ-precincts-with-results.geojson \
           data/CO-precincts-with-results.geojson

# Step 3 — Enacted plan integration
python scripts/preprocessing/integrate_enacted_plan.py

# Step 4 — SeaWulf input generation (Prepro-6)
python scripts/preprocessing/generate_seawulf_inputs.py --states AZ CO

# Step 5 — (On SeaWulf) Race-blind ensemble
sbatch scripts/seawulf/recom_parallel.slurm
# After job completes, sync results/ back locally

# Step 6 — (On SeaWulf) VRA-constrained ensemble
STATE=AZ VRA_GROUP_FIELD=CVAP_HSP24 VRA_MIN_DISTRICTS=2 \
  sbatch scripts/seawulf/recom_parallel.slurm
# Repeat for CO; sync results/ back locally

# Step 7 — Analysis preprocessing (can run locally after SeaWulf)
python scripts/preprocessing/preprocess_gingles.py
python scripts/preprocessing/preprocess_ei.py
python scripts/preprocessing/preprocess_enacted_boxplot.py
python scripts/seawulf/generate_ensemble_splits.py
python scripts/seawulf/generate_ensemble_boxplot.py

# Step 8 — Restart backend to re-seed MongoDB
cd backend && mvn spring-boot:run
```
