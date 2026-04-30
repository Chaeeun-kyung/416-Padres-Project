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
    return null
  }

  if (metricKey === 'pct_dem_lead') {
    const value = Number(properties?.pct_dem_lead)
    return Number.isFinite(value) ? value : null
  }

  const candidates = DEMOGRAPHIC_FIELD_CANDIDATES[metricKey] ?? [metricKey]
  for (let i = 0; i < candidates.length; i += 1) {
    const normalized = normalizePct(Number(properties?.[candidates[i]]))
    if (normalized !== null) {
      return normalized
    }
  }

  return null
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
const DISTRICT_DEFAULT_STROKE = '#1f2937'

const DISTRICT_FILL_PALETTE = [
  '#fbb2ff',
  '#ffb4d8',
  '#FCF6BD',
  '#E6F5CE',
  '#D0F4DE',
  '#BDE9EC',
  '#A9DEF9',
  '#C7D0F9',
  '#E4C1F9',
]

function getDistrictColor(districtId) {
  const districtNum = parseInt(districtId?.split('-')[1] ?? '1', 10)
  const safeDistrictNum = Number.isFinite(districtNum) && districtNum > 0 ? districtNum : 1
  const paletteIndex = ((safeDistrictNum - 1) * 5) % DISTRICT_FILL_PALETTE.length
  return DISTRICT_FILL_PALETTE[paletteIndex]
}

function pointInRing(point, ring) {
  if (!Array.isArray(ring) || ring.length < 3) return false
  const [x, y] = point
  let inside = false

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || Number.EPSILON) + xi
    if (intersects) inside = !inside
  }

  return inside
}

function pointInPolygon(point, polygonCoords) {
  if (!Array.isArray(polygonCoords) || !polygonCoords.length) return false
  if (!pointInRing(point, polygonCoords[0])) return false

  for (let i = 1; i < polygonCoords.length; i += 1) {
    if (pointInRing(point, polygonCoords[i])) return false
  }
  return true
}

function pointInGeometry(point, geometry) {
  if (!geometry) return false
  if (geometry.type === 'Polygon') {
    return pointInPolygon(point, geometry.coordinates)
  }
  if (geometry.type === 'MultiPolygon') {
    return (geometry.coordinates ?? []).some((polygon) => pointInPolygon(point, polygon))
  }
  return false
}

function getGeometryFirstPoint(geometry) {
  const coords = geometry?.coordinates
  if (!Array.isArray(coords)) return null

  function walk(node) {
    if (!Array.isArray(node)) return null
    if (typeof node[0] === 'number' && typeof node[1] === 'number') {
      return [Number(node[0]), Number(node[1])]
    }
    for (let i = 0; i < node.length; i += 1) {
      const found = walk(node[i])
      if (found) return found
    }
    return null
  }

  return walk(coords)
}

function getGeometryBoundsCenter(geometry) {
  const coords = geometry?.coordinates
  if (!Array.isArray(coords)) return null

  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity

  function walk(node) {
    if (!Array.isArray(node)) return
    if (typeof node[0] === 'number' && typeof node[1] === 'number') {
      const lng = Number(node[0])
      const lat = Number(node[1])
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return
      minLng = Math.min(minLng, lng)
      minLat = Math.min(minLat, lat)
      maxLng = Math.max(maxLng, lng)
      maxLat = Math.max(maxLat, lat)
      return
    }
    for (let i = 0; i < node.length; i += 1) {
      walk(node[i])
    }
  }

  walk(coords)

  if (!Number.isFinite(minLng) || !Number.isFinite(minLat)) return null
  return [(minLng + maxLng) / 2, (minLat + maxLat) / 2]
}

export {
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
}
