import { useMemo } from 'react'
import L from 'leaflet'
import { GeoJSON, MapContainer, Marker, TileLayer } from 'react-leaflet'
import { feature } from 'topojson-client'
import statesTopo from 'us-atlas/states-10m.json'
import { CONTIGUOUS_STATE_FIPS, FIPS_TO_STATE_CODE } from '../../data/stateMeta'

const SELECTABLE_STATES = new Set(['CO', 'AZ'])
const OMIT_LABEL_STATES = new Set(['CT', 'DE', 'DC', 'MD', 'MA', 'NJ', 'RI', 'VT', 'NH'])
const MIN_LABEL_AREA = 8
const LABEL_CENTER_OVERRIDES = {
  FL: [28.2, -82.0],
}

// Interactive U.S. splash map:
// - renders all contiguous states
// - highlights selectable states (CO/AZ)
// - lets user enter dashboard by clicking a selectable state
function USMapBackground({ selectedStateCode, onStateSelect }) {
  // Convert TopoJSON -> GeoJSON and keep only contiguous states.
  const contiguousStatesGeojson = useMemo(() => {
    const states = feature(statesTopo, statesTopo.objects.states)
    return {
      ...states,
      features: states.features.filter((stateFeature) => {
        const fips = String(stateFeature.id).padStart(2, '0')
        return CONTIGUOUS_STATE_FIPS.includes(fips)
      }),
    }
  }, [])

  const stateLabels = useMemo(() => {
    // Fast geometry-based center + area heuristic used for label placement/filtering.
    function getBoundsMeta(geometry) {
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

      visitCoordinates(geometry?.coordinates)
      if (!Number.isFinite(minLat) || !Number.isFinite(minLng)) return null
      const width = maxLng - minLng
      const height = maxLat - minLat
      return {
        center: [(minLat + maxLat) / 2, (minLng + maxLng) / 2],
        area: width * height,
      }
    }

    return (contiguousStatesGeojson?.features ?? [])
      .map((stateFeature) => {
        const fips = String(stateFeature.id).padStart(2, '0')
        const stateCode = FIPS_TO_STATE_CODE[fips]
        const meta = getBoundsMeta(stateFeature.geometry)
        if (!stateCode || !meta?.center) return null
        if (!SELECTABLE_STATES.has(stateCode)) {
          if (OMIT_LABEL_STATES.has(stateCode)) return null
          if (meta.area < MIN_LABEL_AREA) return null
        }
        const center = LABEL_CENTER_OVERRIDES[stateCode] ?? meta.center
        const labelClass = SELECTABLE_STATES.has(stateCode)
          ? 'splash-state-label splash-state-label--selectable'
          : 'splash-state-label'
        return {
          id: fips,
          name: stateCode,
          center,
          icon: L.divIcon({
            className: 'splash-state-label-icon',
            iconSize: [0, 0],
            iconAnchor: [0, 0],
            html: `<span class="${labelClass}">${stateCode}</span>`,
          }),
        }
      })
      .filter(Boolean)
  }, [contiguousStatesGeojson])

  function buildDefaultStyle(stateCode) {
    const selectable = SELECTABLE_STATES.has(stateCode)
    const selected = selectedStateCode === stateCode

    if (selected) {
      return {
        color: '#8a6a00',
        weight: 2.5,
        fillColor: '#ffe16f',
        fillOpacity: 0.95,
        className: 'splash-state splash-state--selected',
      }
    }

    if (selectable) {
      return {
        color: '#ab8620',
        weight: 2,
        fillColor: '#fff3b2',
        fillOpacity: 0.9,
        className: 'splash-state splash-state--selectable',
      }
    }

    return {
      color: '#cbd5e1',
      weight: 0.7,
      fillColor: '#d9dde3',
      fillOpacity: 0.42,
      className: 'splash-state splash-state--disabled',
    }
  }

  function stateStyle(featureValue) {
    const fips = String(featureValue.id).padStart(2, '0')
    const stateCode = FIPS_TO_STATE_CODE[fips]
    return buildDefaultStyle(stateCode)
  }

  // Binds per-state tooltip, hover styling, and click behavior.
  function onEachStateFeature(stateFeature, layer) {
    const fips = String(stateFeature.id).padStart(2, '0')
    const stateCode = FIPS_TO_STATE_CODE[fips]
    const isSelectable = SELECTABLE_STATES.has(stateCode)

    layer.bindTooltip(isSelectable ? (stateCode ?? 'N/A') : 'Not available', {
      direction: 'top',
      sticky: true,
      opacity: 0.94,
    })

    layer.on('add', () => {
      const element = layer.getElement()
      if (element) {
        element.style.cursor = isSelectable ? 'pointer' : 'default'
        element.style.transition = 'filter 180ms ease, transform 180ms ease'
        element.style.transformBox = 'fill-box'
        element.style.transformOrigin = 'center'
      }
    })

    layer.on({
      mouseover: () => {
        if (isSelectable && selectedStateCode !== stateCode) {
          layer.setStyle({
            color: '#8a6a00',
            fillColor: '#ffe893',
            fillOpacity: 0.96,
            weight: 1.45,
          })
          const element = layer.getElement()
          if (element) {
            element.style.filter = 'brightness(1.03) drop-shadow(0 1px 2px rgba(138, 106, 0, 0.24))'
            element.style.transform = 'scale(1.01)'
          }
          layer.bringToFront()
        }
      },
      mouseout: () => {
        layer.setStyle(buildDefaultStyle(stateCode))
        const element = layer.getElement()
        if (element) {
          element.style.filter = 'none'
          element.style.transform = 'none'
        }
      },
    })

    if (isSelectable) {
      layer.on({
        click: () => {
          onStateSelect(stateCode)
        },
      })
    }
  }

  return (
    <div className="splash-map-shell">
      <MapContainer
        className="splash-map"
        center={[39.5, -98.6]}
        zoom={4.45}
        minZoom={4.2}
        maxZoom={5.2}
        zoomControl={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        boxZoom={false}
        keyboard={false}
        dragging={false}
        touchZoom={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
          opacity={0.46}
        />
        <GeoJSON data={contiguousStatesGeojson} style={stateStyle} onEachFeature={onEachStateFeature} />
        {stateLabels.map((label) => (
          <Marker key={label.id} position={label.center} icon={label.icon} interactive={false} keyboard={false} />
        ))}
      </MapContainer>
    </div>
  )
}

export default USMapBackground
