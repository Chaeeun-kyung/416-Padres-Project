# Frontend Execution Order, Data Dependencies, and API Contracts

This note summarizes runtime flow, data dependencies, and frontend REST calls for a selected state.

## 1) Execution Order (Runtime Flow)

1. User selects a state on splash/map.
2. `useAppStore` updates `selectedStateCode` and UI toggles (active tab, metric, overlays, selected district).
3. `StateDashboard` renders 3 panes:
   - `LeftControls`
   - `MapPanel`
   - `RightDetails`
4. `MapPanel` calls `useMapData(...)`:
   - loads precinct GeoJSON + district GeoJSON in parallel
   - computes map bounds
   - returns `precinctGeojson`, `districtGeojson`, `stateBounds`
5. `MapPanel` derives choropleth bins/colors from selected metric and renders:
   - precinct fill/outline layer
   - district boundary layer
   - legend + loading overlay
6. `RightDetails` calls `useRightDetailsData(selectedStateCode)`:
   - loads state summary
   - loads representation rows
   - passes summary into sub-panels/cards
7. Tab-specific charts load on demand:
   - `GinglesScatter`, `EICurve`, `EnsembleSplits`, `EnsembleBoxplot`, `VraImpactPanel`
8. Selected district interactions propagate through `useAppStore`, and dependent charts/tables rerender.

## 2) Data Dependencies by UI Module

- `StateDashboard`
  - Depends on: `selectedStateCode`, `activeTab`, `selectedDistrictId`
  - Provides shared props to map/details panes
- `MapPanel`
  - Depends on:
    - precinct/district GeoJSON from `useMapData`
    - store flags (`showPrecinctBoundaries`, `showDistrictBoundaries`, `showDemLeadOverlay`, `activeMetric`)
  - Produces:
    - selected district changes
    - map legend and overlay UI state
- `RightDetails`
  - Depends on:
    - summary payload (`/summary`)
    - representation rows (`/representation`)
    - map loading/selected district context
- Analysis Chart Components
  - Depend on:
    - `selectedStateCode`
    - optional selected group/subview controls
    - backend endpoint payloads (with mock fallback where configured)

## 3) REST API Endpoints Used by Frontend

All calls are state-scoped under `/api/states/:stateCode/...`.

- `GET /summary`
  - Used by: `src/services/summaryApi.js`
  - Purpose: top-level demographic + political summary for cards/charts
- `GET /representation`
  - Used by: `src/components/rightDetails/useRightDetailsData.js`
  - Purpose: representation table rows
- `GET /analysis/gingles`
  - Used by: `src/components/charts/GinglesScatter.jsx`
  - Purpose: Gingles scatter chart data
- `GET /analysis/ei` (with query params)
  - Used by: `src/components/charts/EICurve.jsx`
  - Purpose: EI KDE/curve analysis data
- `GET /ensembles/splits`
  - Used by: `src/components/charts/EnsembleSplits.jsx`
  - Purpose: district split ensemble summary
- `GET /ensembles/boxplot` (with optional `group`, `ensemble`)
  - Used by:
    - `src/components/charts/EnsembleBoxplot.jsx`
    - `src/components/charts/vra/useVraImpactData.js`
  - Purpose: ensemble distributions and VRA impact views

## 4) Frontend Robustness Notes

- Loading/error/empty states are rendered per major panel.
- Summary API uses in-memory request/data cache (`summaryApi.js`) to prevent duplicate requests.
- VRA views keep rendering when partial data is available.
- UI numeric constants were lifted in key modules (`MapPanel`, `VraImpactPanel`, `VraThresholdTable`, `SummaryCards`) to reduce style-level magic numbers.
