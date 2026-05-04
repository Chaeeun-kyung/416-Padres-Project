# CSE 416 – Padres Project

Voting Rights Act (VRA) impact analysis tool for Arizona and Colorado congressional districts.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite, Leaflet, Recharts, Plotly |
| Backend | Spring Boot 3.5, MongoDB |
| Preprocessing | Python 3 (geopandas, gerrychain, pyei) |
| HPC | SeaWulf SLURM cluster |

## Project layout

```
src/              React frontend
backend/          Spring Boot REST API + MongoDB seeder
scripts/
  preprocessing/  Prepro-1 through 11 data pipeline scripts
  seawulf/        ReCom driver/worker scripts and SLURM batch files
  legacy/         Historical analysis scripts (kept for reference)
data/             Source precinct GeoJSON with neighbor fields
public/geojson/   CVAP-merged precinct and district GeoJSON (served statically)
results/
  seawulf_inputs/ Prepro-6 outputs and merged ensemble files
docs/             Architecture and pipeline documentation
```

## Quick start

**Frontend**
```
npm install
npm run dev
```

**Backend**  
Requires MongoDB running on `localhost:27017/padres` (or set `MONGODB_URI`).  
The seeder populates MongoDB from `backend/src/main/resources/*.json` on startup.
```
cd backend && mvn spring-boot:run
```

**Preprocessing pipeline**  
See [docs/SEAWULF_PIPELINE.md](docs/SEAWULF_PIPELINE.md) for the full data pipeline from raw census data through SeaWulf ensemble generation.
