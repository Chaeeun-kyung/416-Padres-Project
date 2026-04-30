import { useEffect, useState } from 'react'
import {
  deriveStateBounds,
  loadDistrictGeoJSON,
  loadPrecinctGeoJSON,
} from '../../services/dataLoader'

function useMapData({
  selectedStateCode,
  precinctDataVariant,
  onPrecinctGeojsonLoaded,
  setLoadingMapData,
  setMapError,
}) {
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
        const [precinctData, explicitDistricts] = await Promise.all([
          loadPrecinctGeoJSON(selectedStateCode, precinctDataVariant),
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
  }, [onPrecinctGeojsonLoaded, precinctDataVariant, selectedStateCode, setLoadingMapData, setMapError])

  return {
    precinctGeojson,
    districtGeojson,
    stateBounds,
  }
}

export default useMapData
