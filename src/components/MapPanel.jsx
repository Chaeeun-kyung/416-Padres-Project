import { useEffect, useMemo, useState } from 'react'
import { GeoJSON, MapContainer, TileLayer, useMap } from 'react-leaflet'
import { feature } from 'topojson-client'
import statesTopo from 'us-atlas/states-10m.json'
import { resolveBinsForMetric, getColorForValue } from '../services/bins'
import {
  buildMockDistrictLinesFromBounds,
  deriveStateBounds,
  loadDistrictGeoJSON,
  loadPrecinctGeoJSON,
} from '../services/dataLoader'
import { FIPS_TO_STATE_CODE, STATE_META } from '../data/stateMeta'
import useAppStore from '../store/useAppStore'

const DEMOGRAPHIC_FIELD_CANDIDATES = {
  white_pct: ['white_pct', 'pct_white', 'white_cvap_pct', 'white_population_pct'],
  black_pct: ['black_pct', 'pct_black', 'black_cvap_pct', 'black_population_pct'],
  latino_pct: ['latino_pct', 'hispanic_pct', 'pct_hispanic', 'latino_cvap_pct', 'hispanic_cvap_pct'],
  native_american_pct: ['native_american_pct', 'native_pct', 'pct_native', 'native_cvap_pct', 'native_population_pct'],
  asian_pct: ['asian_pct', 'pct_asian', 'asian_cvap_pct'],
}

function normalizePct(value) {
  if (!Number.isFinite(value)) return null
  if (value >= 0 && value <= 1) return value
  if (value >= 0 && value <= 100) return value / 100
  return null
}

function geoidHashToPct(geoid, fallbackIndex, salt = '') {
  const key = `${String(geoid ?? fallbackIndex)}-${salt}`
  let hash = 0
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) % 1000
  }
  return (hash % 101) / 100
}

function resolveMetricValue(properties, metricKey, index) {
  if (metricKey === 'pct_dem_lead') {
    const value = Number(properties?.pct_dem_lead)
    return Number.isFinite(value) ? { value, isFallback: false } : { value: 0, isFallback: true }
  }

  const candidates = DEMOGRAPHIC_FIELD_CANDIDATES[metricKey] ?? [metricKey]
  for (let i = 0; i < candidates.length; i += 1) {
    const normalized = normalizePct(Number(properties?.[candidates[i]]))
    if (normalized !== null) {
      return { value: normalized, isFallback: false }
    }
  }

  return {
    value: geoidHashToPct(properties?.GEOID, index, metricKey),
    isFallback: true,
  }
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

function MapPanel({ selectedStateCode, onPrecinctGeojsonLoaded, setLoadingMapData, setMapError }) {
  const showChoropleth = useAppStore((state) => state.showChoropleth)
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
        const precinctData = await loadPrecinctGeoJSON(selectedStateCode)
        if (!mounted) return

        setPrecinctGeojson(precinctData)
        onPrecinctGeojsonLoaded(precinctData)

        const bounds = deriveStateBounds(precinctData?.features ?? [])
        setStateBounds(bounds)

        const explicitDistricts = await loadDistrictGeoJSON(selectedStateCode)
        if (!mounted) return

        if (explicitDistricts?.features?.length) {
          setDistrictGeojson(explicitDistricts)
        } else {
          const mockDistricts = buildMockDistrictLinesFromBounds(bounds, STATE_META[selectedStateCode]?.districtCount ?? 8)
          setDistrictGeojson(mockDistricts)
        }
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
    let fallbackCount = 0

    ;(precinctGeojson?.features ?? []).forEach((featureValue, index) => {
      const props = featureValue?.properties ?? {}
      const result = resolveMetricValue(props, activeMetric, index)
      values.push(result.value)
      byGeoId.set(String(props.GEOID ?? index), result.value)
      if (result.isFallback) fallbackCount += 1
    })

    return { values, byGeoId, fallbackCount }
  }, [activeMetric, precinctGeojson?.features])

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
    return resolveBinsForMetric(
      selectedStateCode,
      activeMetric,
      precinctGeojson?.features ?? [],
      metricLookup.values,
    )
  }, [activeMetric, metricLookup.values, precinctGeojson?.features, selectedStateCode])

  function makePrecinctStyle(feature) {
    const geoid = String(feature?.properties?.GEOID ?? '')
    const value = metricLookup.byGeoId.get(geoid)
    const isSelected = String(feature?.properties?.GEOID) === String(selectedPrecinctId)
    return {
      color: isSelected ? '#a16207' : '#475569',
      weight: isSelected ? 2 : 0.4,
      fillColor: getColorForValue(value, binResult.bins, binResult.colors),
      fillOpacity: showChoropleth ? 0.72 : 0,
    }
  }

  function makePrecinctOutlineStyle(feature) {
    const isSelected = String(feature?.properties?.GEOID) === String(selectedPrecinctId)
    return {
      color: isSelected ? '#a16207' : '#64748b',
      weight: isSelected ? 2 : 0.3,
      fillOpacity: 0,
      opacity: 0.85,
    }
  }

  function onEachPrecinct(featureValue, layer) {
    const props = featureValue.properties ?? {}
    const metricValue = metricLookup.byGeoId.get(String(props.GEOID ?? ''))
    const metricText =
      activeMetric === 'pct_dem_lead'
        ? `${(Number(metricValue ?? 0) * 100).toFixed(1)}%`
        : `${Math.round(Number(metricValue ?? 0) * 100)}%`
    layer.bindTooltip(
      `GEOID: ${props.GEOID ?? 'N/A'} | Dem: ${props.votes_dem ?? 0} | Rep: ${props.votes_rep ?? 0} | Total: ${
        props.votes_total ?? 0
      } | ${binResult.metricLabel}: ${metricText}`,
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
    return {
      color: isSelected ? '#a16207' : '#0f172a',
      weight: isSelected ? 3.4 : 2.2,
      opacity: isSelected ? 1 : 0.9,
      fillOpacity: 0,
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

  const showFallbackNotice = activeMetric !== 'pct_dem_lead' && metricLookup.values.length > 0 && metricLookup.fallbackCount === metricLookup.values.length

  return (
    <section className="panel-card map-shell" style={{ flex: 1 }}>
      {showFallbackNotice && (
        <div
          className="small-text muted-text"
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            zIndex: 500,
            background: 'rgba(255, 255, 255, 0.93)',
            border: '1px solid var(--ui-border)',
            borderRadius: 10,
            padding: '6px 8px',
          }}
        >
          Demographic % fields are not present in this GeoJSON yet. Display uses deterministic mock values by precinct GEOID.
        </div>
      )}
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

        {precinctGeojson &&
          (showChoropleth ? (
            <GeoJSON
              key={`precincts-fill-${selectedStateCode}`}
              data={precinctGeojson}
              style={makePrecinctStyle}
              onEachFeature={onEachPrecinct}
            />
          ) : (
            <GeoJSON
              key={`precincts-outline-${selectedStateCode}`}
              data={precinctGeojson}
              style={makePrecinctOutlineStyle}
              onEachFeature={onEachPrecinct}
            />
          ))}
      </MapContainer>

      {showChoropleth && <ChoroplethLegend binResult={binResult} />}
    </section>
  )
}

export default MapPanel
