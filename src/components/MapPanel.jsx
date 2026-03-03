import { useEffect, useMemo, useState } from 'react'
import { GeoJSON, MapContainer, TileLayer, useMap } from 'react-leaflet'
import { feature } from 'topojson-client'
import statesTopo from 'us-atlas/states-10m.json'
import { resolveBinsForMetric, getColorForValue } from '../services/bins'
import {
  deriveStateBounds,
  loadDistrictGeoJSON,
  loadPrecinctGeoJSON,
} from '../services/dataLoader'
import { FIPS_TO_STATE_CODE, STATE_META } from '../data/stateMeta'
import useAppStore from '../store/useAppStore'

const DEMOGRAPHIC_FIELD_CANDIDATES = {
  white_pct: ['PCT_CVAP_WHT'],
  black_pct: ['PCT_CVAP_BLA'],
  latino_pct: ['PCT_CVAP_HSP'],
  asian_pct: ['PCT_CVAP_ASI'],
}

function normalizePct(value) {
  if (!Number.isFinite(value)) return null
  if (value >= 0 && value <= 1) return value
  if (value >= 0 && value <= 100) return value / 100
  return null
}

function resolveMetricValue(properties, metricKey) {
  if (!metricKey) {
    return { value: null, isFallback: false }
  }

  if (metricKey === 'pct_dem_lead') {
    const value = Number(properties?.pct_dem_lead)
    return Number.isFinite(value) ? { value, isFallback: false } : { value: null, isFallback: true }
  }

  const candidates = DEMOGRAPHIC_FIELD_CANDIDATES[metricKey] ?? [metricKey]
  for (let i = 0; i < candidates.length; i += 1) {
    const normalized = normalizePct(Number(properties?.[candidates[i]]))
    if (normalized !== null) {
      return { value: normalized, isFallback: false }
    }
  }

  return { value: null, isFallback: true }
}

function normalizeDistrictCode(rawCode) {
  if (rawCode === null || rawCode === undefined) return null
  const digits = String(rawCode).match(/\d+/)?.[0]
  if (!digits) return null
  return digits.padStart(2, '0')
}

function getDistrictIdForFeature(featureProperties, stateCode) {
  if (!featureProperties || !stateCode) return null
  const directCode =
    normalizeDistrictCode(featureProperties.CD119FP) ??
    normalizeDistrictCode(featureProperties.DISTRICT) ??
    normalizeDistrictCode(featureProperties.district) ??
    normalizeDistrictCode(featureProperties.district_id)

  if (directCode) return `${stateCode}-${directCode}`

  const geoidCode = normalizeDistrictCode(featureProperties.GEOID)
  return geoidCode ? `${stateCode}-${geoidCode}` : null
}

const DISTRICT_SELECTED_NEUTRAL_STROKE = '#166534'
const DISTRICT_SELECTED_NEUTRAL_FILL = '#DCFCE7'
const DISTRICT_SELECTED_DEM_STROKE = '#1D4ED8'
const DISTRICT_SELECTED_DEM_FILL = '#DBEAFE'
const DISTRICT_SELECTED_REP_STROKE = '#B91C1C'
const DISTRICT_SELECTED_REP_FILL = '#FEE2E2'
const DISTRICT_DEFAULT_STROKE = '#334155'

const DISTRICT_FILL_PALETTE = [
  '#A0C4FF',
  '#BDB2FF',
  '#FFC6FF',
  '#FFD6A5',
  '#FDFFB6',
  '#CAFFBF',
  '#9BF6FF',
  '#FAD2E1',
  '#CDEAC0',
  '#C9E4FF',
  '#FEE440',
  '#D3F8E2',
]

function getDistrictColor(districtId) {
  const districtNum = parseInt(districtId?.split('-')[1] ?? '1', 10)
  const safeDistrictNum = Number.isFinite(districtNum) && districtNum > 0 ? districtNum : 1
  const paletteIndex = ((safeDistrictNum - 1) * 5) % DISTRICT_FILL_PALETTE.length
  return DISTRICT_FILL_PALETTE[paletteIndex]
}

function BoundsController({ bounds }) {
  const map = useMap()

  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [20, 20] })
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
        right: 10,
        bottom: 10,
        zIndex: 500,
        padding: 10,
        minWidth: 170,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{binResult.metricLabel}</div>
      <div className="small-text muted-text" style={{ marginBottom: 8 }}>
        Bin source: {binResult.source}
      </div>
      {binResult.bins.map((bin, index) => (
        <div key={`${bin.min}-${bin.max}`} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span
            style={{
              width: 16,
              height: 12,
              borderRadius: 2,
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

function MapPanel({ selectedStateCode, onPrecinctGeojsonLoaded, setLoadingMapData, setMapError, loadingMapData }) {
  const showPrecinctBoundaries = useAppStore((state) => state.showPrecinctBoundaries)
  const showDemLeadOverlay = useAppStore((state) => state.showDemLeadOverlay)
  const showDistrictBoundaries = useAppStore((state) => state.showDistrictBoundaries)
  const activeMetric = useAppStore((state) => state.activeMetric)
  const selectedPrecinctId = useAppStore((state) => state.selectedPrecinctId)
  const selectedDistrictId = useAppStore((state) => state.selectedDistrictId)
  const mapResetToken = useAppStore((state) => state.mapResetToken)
  const setSelectedPrecinctId = useAppStore((state) => state.setSelectedPrecinctId)
  const setSelectedDistrictId = useAppStore((state) => state.setSelectedDistrictId)

  const [precinctGeojson, setPrecinctGeojson] = useState(null)
  const [districtGeojson, setDistrictGeojson] = useState(null)
  const [stateBounds, setStateBounds] = useState(null)
  const displayMetric = showDemLeadOverlay ? 'pct_dem_lead' : activeMetric
  const hasMetricSelection = Boolean(displayMetric)

  useEffect(() => {
    let mounted = true
    async function loadData() {
      setLoadingMapData(true)
      setMapError('')
      setPrecinctGeojson(null)
      setDistrictGeojson(null)
      setStateBounds(null)
      onPrecinctGeojsonLoaded(null)
      try {
        const [precinctData, explicitDistricts] = await Promise.all([
          loadPrecinctGeoJSON(selectedStateCode),
          loadDistrictGeoJSON(selectedStateCode),
        ])
        if (!mounted) return

        setPrecinctGeojson(precinctData)
        onPrecinctGeojsonLoaded(precinctData)

        const bounds = deriveStateBounds(
          explicitDistricts?.features?.length ? explicitDistricts.features : precinctData?.features ?? [],
        )
        setStateBounds(bounds)

        setDistrictGeojson(explicitDistricts)
      } catch (error) {
        if (!mounted) return
        setPrecinctGeojson(null)
        setDistrictGeojson(null)
        onPrecinctGeojsonLoaded(null)
        setMapError(error.message ?? 'Failed to load map data.')
      } finally {
        if (mounted) setLoadingMapData(false)
      }
    }

    loadData()
    return () => {
      mounted = false
    }
  }, [onPrecinctGeojsonLoaded, selectedStateCode, setLoadingMapData, setMapError])

  const metricLookup = useMemo(() => {
    const values = []
    const byGeoId = new Map()

    ;(precinctGeojson?.features ?? []).forEach((featureValue, index) => {
      const props = featureValue?.properties ?? {}
      const result = resolveMetricValue(props, displayMetric)
      values.push(result.value)
      byGeoId.set(String(props.GEOID ?? index), result.value)
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

    return resolveBinsForMetric(
      selectedStateCode,
      displayMetric,
      precinctGeojson?.features ?? [],
      metricLookup.values,
    )
  }, [displayMetric, hasMetricSelection, metricLookup.values, precinctGeojson?.features, selectedStateCode])

  const districtPartisanLean = useMemo(() => {
    const voteTotalsByDistrict = new Map()

    ;(precinctGeojson?.features ?? []).forEach((featureValue) => {
      const props = featureValue?.properties ?? {}
      const districtId = getDistrictIdForFeature(props, selectedStateCode)
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
  }, [precinctGeojson?.features, selectedStateCode])

  function makePrecinctFillStyle(feature) {
    const geoid = String(feature?.properties?.GEOID ?? '')
    const metricValue = metricLookup.byGeoId.get(geoid)
    const isSelected = String(feature?.properties?.GEOID) === String(selectedPrecinctId)
    return {
      color: isSelected && !showPrecinctBoundaries ? '#a16207' : 'transparent',
      weight: isSelected && !showPrecinctBoundaries ? 2 : 0,
      opacity: 1,
      fillColor: hasMetricSelection ? getColorForValue(metricValue, binResult?.bins ?? [], binResult?.colors ?? []) : '#cbd5e1',
      fillOpacity: hasMetricSelection ? 0.72 : 0,
    }
  }

  function makePrecinctOutlineStyle(feature) {
    const isSelected = String(feature?.properties?.GEOID) === String(selectedPrecinctId)
    return {
        color: isSelected ? '#BE123C' : '#0EA5E9',
      weight: isSelected ? 2 : 0.3,
      fillOpacity: 0,
        opacity: 0.9,
    }
  }

  function onEachPrecinct(featureValue, layer) {
    const props = featureValue.properties ?? {}
    const metricValue = metricLookup.byGeoId.get(String(props.GEOID ?? ''))
    const metricText = !hasMetricSelection
      ? 'N/A'
      : displayMetric === 'pct_dem_lead'
        ? `${(Number(metricValue ?? 0) * 100).toFixed(1)}%`
        : `${Math.round(Number(metricValue ?? 0) * 100)}%`
    const metricLabel = hasMetricSelection ? binResult?.metricLabel ?? displayMetric : 'Selected metric'
    layer.bindTooltip(
      `GEOID: ${props.GEOID ?? 'N/A'} | Dem: ${props.votes_dem ?? 0} | Rep: ${props.votes_rep ?? 0} | Total: ${
        props.votes_total ?? 0
      } | ${metricLabel}: ${metricText}`,
    )
    layer.on({
      click: () => {
        setSelectedPrecinctId(props.GEOID ?? null)
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
        weight: 5.4,
        opacity: 1,
        fillColor: selectedColors.fill,
        fillOpacity: 0.6,
      }
    }

    const fillColor = getDistrictColor(districtId)

    return {
      color: DISTRICT_DEFAULT_STROKE,
      weight: 1.8,
      opacity: 0.95,
      fillColor,
      fillOpacity: hasMetricSelection ? 0 : 0.58,
    }
  }

  function onEachDistrict(featureValue, layer) {
    const districtId = getDistrictIdForFeature(featureValue?.properties, selectedStateCode)
    if (districtId) {
      layer.bindTooltip(`District ${districtId}`, { sticky: true })
      layer.on({
        click: () => {
          setSelectedDistrictId(districtId)
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
        center={STATE_META[selectedStateCode]?.center ?? [39.1, -104.9]}
        zoom={STATE_META[selectedStateCode]?.zoom ?? 7}
        minZoom={5}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

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
            key={`precincts-outline-${selectedStateCode}`}
            data={precinctGeojson}
            style={makePrecinctOutlineStyle}
            onEachFeature={onEachPrecinct}
          />
        )}
      </MapContainer>

      {/* Enacted plan badge */}
      {!loadingMapData && showDistrictBoundaries && districtGeojson && (
        <div
          className="panel-card"
          style={{
            position: 'absolute',
            left: 10,
            top: 10,
            zIndex: 500,
            padding: '5px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            pointerEvents: 'none',
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#0f172a', flexShrink: 0 }} />
          <span className="small-text" style={{ fontWeight: 700 }}>Enacted District Plan</span>
          <span className="small-text muted-text">119th Congress</span>
        </div>
      )}

      {/* Loading overlay */}
      {loadingMapData && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 600,
            background: 'rgba(255,255,255,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'var(--ui-radius-lg)',
            pointerEvents: 'none',
          }}
        >
          <div className="panel-card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="small-text" style={{ fontWeight: 600 }}>Loading district plan…</span>
          </div>
        </div>
      )}

      {hasMetricSelection && <ChoroplethLegend binResult={binResult} />}
    </section>
  )
}

export default MapPanel
