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

function USMapBackground({ selectedStateCode, onStateSelect }) {
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
        color: '#cfb258',
        weight: 1.25,
        fillColor: '#f4dc8f',
        fillOpacity: 0.95,
        className: 'splash-state splash-state--selected',
      }
    }

    if (selectable) {
      return {
        color: '#d6bf79',
        weight: 1,
        fillColor: '#f2e4b2',
        fillOpacity: 0.92,
        className: 'splash-state splash-state--selectable',
      }
    }

    return {
      color: '#c5ced9',
      weight: 0.8,
      fillColor: '#d9dde3',
      fillOpacity: 0.88,
      className: 'splash-state splash-state--disabled',
    }
  }

  function stateStyle(featureValue) {
    const fips = String(featureValue.id).padStart(2, '0')
    const stateCode = FIPS_TO_STATE_CODE[fips]
    return buildDefaultStyle(stateCode)
  }

  function onEachStateFeature(stateFeature, layer) {
    const fips = String(stateFeature.id).padStart(2, '0')
    const stateCode = FIPS_TO_STATE_CODE[fips]
    const isSelectable = SELECTABLE_STATES.has(stateCode)

    const tooltipLabel = isSelectable ? stateCode ?? 'N/A' : `${stateCode ?? 'N/A'} (Not selectable)`
    layer.bindTooltip(tooltipLabel, { direction: 'top', sticky: true, opacity: 0.95 })

    layer.on({
      mouseover: () => {
        if (isSelectable && selectedStateCode !== stateCode) {
          layer.setStyle({
            color: '#c9ac5b',
            fillColor: '#f0da98',
            fillOpacity: 0.96,
            weight: 1.35,
          })
          const element = layer.getElement()
          if (element) {
            element.style.filter = 'drop-shadow(0 1px 3px rgba(115, 88, 25, 0.18))'
          }
          layer.bringToFront()
        }
      },
      mouseout: () => {
        layer.setStyle(buildDefaultStyle(stateCode))
        const element = layer.getElement()
        if (element) {
          element.style.filter = 'none'
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
          opacity={0.5}
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
