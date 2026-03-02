const precinctCache = new Map()
const districtCache = new Map()

function normalizeFeature(feature) {
  const props = feature?.properties ?? {}
  return {
    ...feature,
    properties: {
      ...props,
      votes_dem: Number(props.votes_dem ?? 0),
      votes_rep: Number(props.votes_rep ?? 0),
      votes_total: Number(props.votes_total ?? 0),
    },
  }
}

export async function loadPrecinctGeoJSON(stateCode) {
  if (!stateCode) return null
  if (precinctCache.has(stateCode)) {
    return precinctCache.get(stateCode)
  }

  const response = await fetch(`/geojson/${stateCode}-precincts-with-results-cvap.geojson`, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Failed to load CVAP precinct GeoJSON for ${stateCode}`)
  }

  const geojson = await response.json()
  geojson.features = (geojson.features ?? []).map(normalizeFeature)
  precinctCache.set(stateCode, geojson)
  return geojson
}

export async function loadDistrictGeoJSON(stateCode) {
  if (!stateCode) return null
  if (districtCache.has(stateCode)) {
    return districtCache.get(stateCode)
  }

  try {
    const response = await fetch(`/geojson/${stateCode}-districts.geojson`, { cache: 'no-store' })
    if (!response.ok) {
      return null
    }
    const geojson = await response.json()
    if (!geojson || geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features) || geojson.features.length === 0) {
      return null
    }
    districtCache.set(stateCode, geojson)
    return geojson
  } catch {
    return null
  }
}

export function getPrecinctRows(features) {
  return (features ?? []).map((feature, index) => {
    const props = feature.properties ?? {}
    return {
      rowKey: `${props.GEOID ?? 'unknown'}-${index}`,
      geoid: props.GEOID ?? `unknown-${index}`,
      votesDem: Number(props.votes_dem ?? 0),
      votesRep: Number(props.votes_rep ?? 0),
      votesTotal: Number(props.votes_total ?? 0),
      pctDemLead: Number(props.pct_dem_lead ?? 0),
    }
  })
}

export function getFeatureByGeoId(features, geoid) {
  if (!geoid) return null
  return (features ?? []).find((feature) => String(feature?.properties?.GEOID) === String(geoid)) ?? null
}

export function deriveStateBounds(features) {
  let minLat = Infinity
  let minLng = Infinity
  let maxLat = -Infinity
  let maxLng = -Infinity

  function visitCoordinates(coords) {
    if (!Array.isArray(coords)) return
    if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      const [lng, lat] = coords
      minLat = Math.min(minLat, lat)
      minLng = Math.min(minLng, lng)
      maxLat = Math.max(maxLat, lat)
      maxLng = Math.max(maxLng, lng)
      return
    }
    coords.forEach(visitCoordinates)
  }

  for (const feature of features ?? []) {
    visitCoordinates(feature?.geometry?.coordinates)
  }

  if (!Number.isFinite(minLat) || !Number.isFinite(minLng)) {
    return null
  }

  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ]
}

export function buildMockDistrictLinesFromBounds(bounds, districtCount = 8) {
  if (!bounds || districtCount < 2) return null

  const [[minLat, minLng], [maxLat, maxLng]] = bounds
  const latPadding = (maxLat - minLat) * 0.01
  const span = maxLng - minLng
  const lineCount = districtCount - 1
  const features = []

  for (let i = 1; i <= lineCount; i += 1) {
    const ratio = i / districtCount
    const x = minLng + span * ratio
    features.push({
      type: 'Feature',
      properties: { id: `mock-line-${i}` },
      geometry: {
        type: 'LineString',
        coordinates: [
          [x, minLat + latPadding],
          [x, maxLat - latPadding],
        ],
      },
    })
  }

  return {
    type: 'FeatureCollection',
    features,
  }
}
