// GUI-2, GUI-4, GUI-7
import { useCallback, useEffect, useMemo } from 'react'
import { GeoJSON, MapContainer, TileLayer, useMap, ZoomControl } from 'react-leaflet'
import { feature } from 'topojson-client'
import statesTopo from 'us-atlas/states-10m.json'
import { resolveBinsForMetric, getColorForValue } from '../../services/bins'
import { FIPS_TO_STATE_CODE, STATE_META } from '../../data/stateMeta'
import useAppStore from '../../store/useAppStore'
import useMapData from '../../hooks/useMapData'
import {
  DISTRICT_DEFAULT_STROKE,
  DISTRICT_SELECTED_DEM_FILL,
  DISTRICT_SELECTED_DEM_STROKE,
  DISTRICT_SELECTED_NEUTRAL_FILL,
  DISTRICT_SELECTED_NEUTRAL_STROKE,
  DISTRICT_SELECTED_REP_FILL,
  DISTRICT_SELECTED_REP_STROKE,
  getDistrictColor,
  getDistrictIdForFeature,
  getGeometryBoundsCenter,
  getGeometryFirstPoint,
  pointInGeometry,
  resolveMetricValue,
} from '../../services/mapGeometry'

const MAP_DEFAULT_CENTER = [39.1, -104.9]
const MAP_DEFAULT_ZOOM = 7
const MAP_MIN_ZOOM = 5
const FIT_BOUNDS_PADDING = [20, 20]

const LEGEND_LAYOUT = {
  inset: 10,
  zIndex: 500,
  padding: 10,
  minWidth: 170,
  rowGap: 4,
  colorBoxWidth: 16,
  colorBoxHeight: 12,
  colorBoxRadius: 2,
}

const PRECINCT_STYLE = {
  strokeWeight: 0.22,
  strokeOpacity: 0.45,
  fillOpacity: 0.78,
  outlineWeight: 0.3,
  outlineOpacity: 0.9,
}

const DISTRICT_STYLE = {
  selectedWeight: 5.4,
  selectedFillOpacity: 0.6,
  defaultWeight: 1.9,
  defaultOpacity: 0.98,
  defaultFillOpacity: 0.58,
}

const BADGE_LAYOUT = {
  inset: 10,
  zIndex: 500,
  paddingY: 5,
  paddingX: 10,
  gap: 6,
  markerSize: 8,
}

const LOADING_OVERLAY = {
  zIndex: 600,
  background: 'rgba(255,255,255,0.65)',
  cardPaddingY: 8,
  cardPaddingX: 16,
  gap: 8,
}
function BoundsController({ bounds }) {
  const map = useMap()

  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: FIT_BOUNDS_PADDING })
    }
  }, [bounds, map])

  return null
}
function MapResizeSync() {
  const map = useMap()

  useEffect(() => {
    const container = map.getContainer()
    if (!container) return undefined

    const invalidate = () => {
      map.invalidateSize({ pan: false, animate: false })
    }

    const rafId = requestAnimationFrame(invalidate)

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        requestAnimationFrame(invalidate)
      })
      observer.observe(container)

      return () => {
        cancelAnimationFrame(rafId)
        observer.disconnect()
      }
    }

    window.addEventListener('resize', invalidate)
    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', invalidate)
    }
  }, [map])

  return null
}

function ChoroplethLegend({ binResult }) {
  if (!binResult?.bins?.length) {
    return null
  }

  return (
    <div
      className="panel-card"
      style={{
        position: 'absolute',
        right: LEGEND_LAYOUT.inset,
        bottom: LEGEND_LAYOUT.inset,
        zIndex: LEGEND_LAYOUT.zIndex,
        padding: LEGEND_LAYOUT.padding,
        minWidth: LEGEND_LAYOUT.minWidth,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: LEGEND_LAYOUT.rowGap }}>{binResult.metricLabel}</div>
      {binResult.bins.map((bin, index) => (
        <div
          key={`${bin.min}-${bin.max}`}
          style={{ display: 'flex', alignItems: 'center', gap: BADGE_LAYOUT.gap, marginBottom: LEGEND_LAYOUT.rowGap }}
        >
          <span
            style={{
              width: LEGEND_LAYOUT.colorBoxWidth,
              height: LEGEND_LAYOUT.colorBoxHeight,
              borderRadius: LEGEND_LAYOUT.colorBoxRadius,
              background: binResult.colors[index],
              border: '1px solid var(--ui-border)',
            }}
          />
          <span className="small-text">{bin.label}</span>
        </div>
      ))}
    </div>
  )
}

// Main map renderer.
// Loads precinct/district GeoJSON for selected state.
// Computes metric bins/colors.
// Renders map layers and handles district selection interactions.
function MapPanel({ selectedStateCode, onPrecinctGeojsonLoaded, setLoadingMapData, setMapError, loadingMapData }) {
  const showPrecinctBoundaries = useAppStore((state) => state.showPrecinctBoundaries)
  const showDemLeadOverlay = useAppStore((state) => state.showDemLeadOverlay)
  const showDistrictBoundaries = useAppStore((state) => state.showDistrictBoundaries)
  const activeMetric = useAppStore((state) => state.activeMetric)
  const precinctDataVariant = useAppStore((state) => state.precinctDataVariant)
  const selectedDistrictId = useAppStore((state) => state.selectedDistrictId)
  const mapResetToken = useAppStore((state) => state.mapResetToken)
  const setSelectedDistrictId = useAppStore((state) => state.setSelectedDistrictId)

  const { precinctGeojson, districtGeojson, stateBounds } = useMapData({
    selectedStateCode,
    precinctDataVariant,
    onPrecinctGeojsonLoaded,
    setLoadingMapData,
    setMapError,
  })
  const displayMetric = showDemLeadOverlay ? 'pct_dem_lead' : activeMetric
  const hasMetricSelection = Boolean(displayMetric)
  const datasetBadgeLabel = precinctDataVariant === 'cvap' ? 'Original CVAP' : 'Enacted + CVAP'

  const metricLookup = useMemo(() => {
    const values = []
    const byGeoId = new Map()

    ;(precinctGeojson?.features ?? []).forEach((featureValue, index) => {
      const props = featureValue?.properties ?? {}
      const value = resolveMetricValue(props, displayMetric)
      values.push(value)
      byGeoId.set(String(props.GEOID ?? index), value)
    })

    return { values, byGeoId }
  }, [displayMetric, precinctGeojson?.features])

  const stateBoundaryGeojson = useMemo(() => {
    const states = feature(statesTopo, statesTopo.objects.states)
    const targetFeature =
      states.features.find((stateFeature) => {
        const fips = String(stateFeature.id).padStart(2, '0')
        return FIPS_TO_STATE_CODE[fips] === selectedStateCode
      }) ?? null
    return targetFeature
      ? {
          type: 'FeatureCollection',
          features: [targetFeature],
        }
      : null
  }, [selectedStateCode])

  const binResult = useMemo(() => {
    if (!hasMetricSelection) {
      return null
    }

    return resolveBinsForMetric(displayMetric, precinctGeojson?.features ?? [], metricLookup.values)
  }, [displayMetric, hasMetricSelection, metricLookup.values, precinctGeojson?.features])

  const districtGeometries = useMemo(
    () =>
      (districtGeojson?.features ?? [])
        .map((featureValue) => ({
          districtId: getDistrictIdForFeature(featureValue?.properties, selectedStateCode),
          geometry: featureValue?.geometry ?? null,
        }))
        .filter((entry) => entry.districtId && entry.geometry),
    [districtGeojson?.features, selectedStateCode],
  )

  const findDistrictIdForPoint = useCallback((point) => {
    if (!Array.isArray(point) || point.length < 2) return null
    const [lng, lat] = point
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null

    const match = districtGeometries.find((entry) => pointInGeometry([lng, lat], entry.geometry))
    return match?.districtId ?? null
  }, [districtGeometries])

  function findDistrictIdForLatLng(latlng) {
    const lng = Number(latlng?.lng)
    const lat = Number(latlng?.lat)
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null

    return findDistrictIdForPoint([lng, lat])
  }

  const districtPartisanLean = useMemo(() => {
    const voteTotalsByDistrict = new Map()

    ;(precinctGeojson?.features ?? []).forEach((featureValue) => {
      const props = featureValue?.properties ?? {}
      const centerPoint = getGeometryBoundsCenter(featureValue?.geometry)
      const firstPoint = getGeometryFirstPoint(featureValue?.geometry)
      const districtId = findDistrictIdForPoint(centerPoint) ?? findDistrictIdForPoint(firstPoint)
      if (!districtId) return

      const currentTotals = voteTotalsByDistrict.get(districtId) ?? { dem: 0, rep: 0 }
      const demVotes = Number(props.votes_dem)
      const repVotes = Number(props.votes_rep)

      if (Number.isFinite(demVotes)) {
        currentTotals.dem += demVotes
      }

      if (Number.isFinite(repVotes)) {
        currentTotals.rep += repVotes
      }

      voteTotalsByDistrict.set(districtId, currentTotals)
    })

    const leanByDistrict = new Map()
    voteTotalsByDistrict.forEach((totals, districtId) => {
      if (totals.dem > totals.rep) {
        leanByDistrict.set(districtId, 'dem')
      } else if (totals.rep > totals.dem) {
        leanByDistrict.set(districtId, 'rep')
      } else {
        leanByDistrict.set(districtId, 'neutral')
      }
    })

    return leanByDistrict
  }, [precinctGeojson?.features, findDistrictIdForPoint])

  function makePrecinctFillStyle(feature) {
    const geoid = String(feature?.properties?.GEOID ?? '')
    const metricValue = metricLookup.byGeoId.get(geoid)
    return {
      color: hasMetricSelection ? '#475569' : 'transparent',
      weight: hasMetricSelection ? PRECINCT_STYLE.strokeWeight : 0,
      opacity: hasMetricSelection ? PRECINCT_STYLE.strokeOpacity : 1,
      fillColor: hasMetricSelection ? getColorForValue(metricValue, binResult?.bins ?? [], binResult?.colors ?? []) : '#cbd5e1',
      fillOpacity: hasMetricSelection ? PRECINCT_STYLE.fillOpacity : 0,
    }
  }

  function makePrecinctOutlineStyle() {
    return {
      color: '#0EA5E9',
      weight: PRECINCT_STYLE.outlineWeight,
      fillOpacity: 0,
      opacity: PRECINCT_STYLE.outlineOpacity,
    }
  }

  function onEachPrecinct(featureValue, layer) {
    const props = featureValue.properties ?? {}
    const metricValue = metricLookup.byGeoId.get(String(props.GEOID ?? ''))
    const metricText = displayMetric === 'pct_dem_lead'
      ? `${(Number(metricValue ?? 0) * 100).toFixed(1)}%`
      : `${Math.round(Number(metricValue ?? 0) * 100)}%`
    const metricLabel = binResult?.metricLabel ?? displayMetric
    const metricSegment = hasMetricSelection ? ` | ${metricLabel}: ${metricText}` : ''
    const datasetSegment = props?.district_name
      ? ` | District: ${props.district_name}${props.plan_type ? ` (${props.plan_type})` : ''}`
      : ` | Dataset: ${datasetBadgeLabel}`
    layer.bindTooltip(`GEOID: ${props.GEOID ?? 'N/A'} | Dem: ${props.votes_dem ?? 0} | Rep: ${props.votes_rep ?? 0} | Total: ${props.votes_total ?? 0}${metricSegment}${datasetSegment}`)
    layer.on({
      click: (event) => {
        const districtId = findDistrictIdForLatLng(event?.latlng)
        setSelectedDistrictId(districtId && districtId === selectedDistrictId ? null : districtId)
      },
    })
  }

  function districtStyle(featureValue) {
    const districtId = getDistrictIdForFeature(featureValue?.properties, selectedStateCode)
    const isSelected = districtId && selectedDistrictId && String(districtId) === String(selectedDistrictId)

    if (isSelected) {
      const lean = districtPartisanLean.get(districtId)
      const selectedColors =
        lean === 'dem'
          ? { stroke: DISTRICT_SELECTED_DEM_STROKE, fill: DISTRICT_SELECTED_DEM_FILL }
          : lean === 'rep'
            ? { stroke: DISTRICT_SELECTED_REP_STROKE, fill: DISTRICT_SELECTED_REP_FILL }
            : { stroke: DISTRICT_SELECTED_NEUTRAL_STROKE, fill: DISTRICT_SELECTED_NEUTRAL_FILL }

      return {
        color: selectedColors.stroke,
        weight: DISTRICT_STYLE.selectedWeight,
        opacity: 1,
        fillColor: selectedColors.fill,
        fillOpacity: DISTRICT_STYLE.selectedFillOpacity,
      }
    }

    const fillColor = getDistrictColor(districtId)

    return {
      color: DISTRICT_DEFAULT_STROKE,
      weight: DISTRICT_STYLE.defaultWeight,
      opacity: DISTRICT_STYLE.defaultOpacity,
      fillColor,
      fillOpacity: hasMetricSelection ? 0 : DISTRICT_STYLE.defaultFillOpacity,
    }
  }

  function onEachDistrict(featureValue, layer) {
    const districtId = getDistrictIdForFeature(featureValue?.properties, selectedStateCode)
    if (districtId) {
      layer.bindTooltip(`District ${districtId}`, { sticky: true })
      layer.on({
        click: () => {
          setSelectedDistrictId(districtId === selectedDistrictId ? null : districtId)
        },
      })
    } else {
      layer.bindTooltip('District boundary', { sticky: true })
    }
  }

  return (
    <section className="panel-card map-shell" style={{ flex: 1 }}>
      <MapContainer
        key={`map-${selectedStateCode}-${mapResetToken}`}
        center={STATE_META[selectedStateCode]?.center ?? MAP_DEFAULT_CENTER}
        zoom={STATE_META[selectedStateCode]?.zoom ?? MAP_DEFAULT_ZOOM}
        minZoom={MAP_MIN_ZOOM}
        zoomControl={false}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ZoomControl position="bottomleft" />

        <BoundsController bounds={stateBounds} />
        <MapResizeSync />

        {stateBoundaryGeojson && (
          <GeoJSON
            key={`state-boundary-${selectedStateCode}`}
            data={stateBoundaryGeojson}
            style={() => ({
              color: '#0f172a',
              weight: 2,
              fillOpacity: 0,
            })}
          />
        )}

        {showDistrictBoundaries && districtGeojson && (
          <GeoJSON
            key={`districts-${selectedStateCode}`}
            data={districtGeojson}
            style={districtStyle}
            onEachFeature={onEachDistrict}
          />
        )}

        {precinctGeojson && hasMetricSelection && (
          <GeoJSON
            key={`precincts-fill-${selectedStateCode}-${displayMetric}`}
            data={precinctGeojson}
            style={makePrecinctFillStyle}
            interactive={!showPrecinctBoundaries}
            onEachFeature={showPrecinctBoundaries ? undefined : onEachPrecinct}
          />
        )}

        {precinctGeojson && showPrecinctBoundaries && (
          <GeoJSON
            key={`precincts-outline-${selectedStateCode}-${displayMetric || 'none'}`}
            data={precinctGeojson}
            style={makePrecinctOutlineStyle}
            onEachFeature={onEachPrecinct}
          />
        )}
      </MapContainer>
      {!loadingMapData && showDistrictBoundaries && districtGeojson && (
        <div
          className="panel-card"
          style={{
            position: 'absolute',
            left: BADGE_LAYOUT.inset,
            top: BADGE_LAYOUT.inset,
            zIndex: BADGE_LAYOUT.zIndex,
            padding: `${BADGE_LAYOUT.paddingY}px ${BADGE_LAYOUT.paddingX}px`,
            display: 'flex',
            alignItems: 'center',
            gap: BADGE_LAYOUT.gap,
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              width: BADGE_LAYOUT.markerSize,
              height: BADGE_LAYOUT.markerSize,
              borderRadius: '50%',
              background: '#0f172a',
              flexShrink: 0,
            }}
          />
          <span className="small-text" style={{ fontWeight: 700 }}>Enacted District Plan</span>
          <span className="small-text muted-text">119th Congress</span>
        </div>
      )}
      {loadingMapData && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: LOADING_OVERLAY.zIndex,
            background: LOADING_OVERLAY.background,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'var(--ui-radius-lg)',
            pointerEvents: 'none',
          }}
        >
          <div
            className="panel-card"
            style={{
              padding: `${LOADING_OVERLAY.cardPaddingY}px ${LOADING_OVERLAY.cardPaddingX}px`,
              display: 'flex',
              alignItems: 'center',
              gap: LOADING_OVERLAY.gap,
            }}
          >
            <span className="small-text" style={{ fontWeight: 600 }}>Loading district plan...</span>
          </div>
        </div>
      )}

      {hasMetricSelection && <ChoroplethLegend binResult={binResult} />}
    </section>
  )
}

export default MapPanel
