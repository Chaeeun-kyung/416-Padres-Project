import { useEffect, useState } from 'react'
import axios from 'axios'
import { fetchStateSummary } from '../services/summaryApi'

function useRightDetailsData(selectedStateCode) {
  const [summary, setSummary] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [representationRows, setRepresentationRows] = useState([])

  useEffect(() => {
    let cancelled = false

    async function loadSummary() {
      if (!selectedStateCode) {
        setSummary(null)
        return
      }

      setSummaryLoading(true)
      try {
        const nextSummary = await fetchStateSummary(selectedStateCode)
        if (!cancelled) {
          setSummary(nextSummary)
        }
      } catch (error) {
        if (!cancelled) {
          setSummary(null)
        }

        if (!axios.isAxiosError(error) || error.response?.status !== 404) {
          console.error('Failed to load state summary', error)
        }
      } finally {
        if (!cancelled) {
          setSummaryLoading(false)
        }
      }
    }

    loadSummary()

    return () => {
      cancelled = true
    }
  }, [selectedStateCode])

  useEffect(() => {
    let cancelled = false

    async function loadRepresentation() {
      if (!selectedStateCode) {
        setRepresentationRows([])
        return
      }

      try {
        const response = await axios.get(`/api/states/${selectedStateCode}/representation`)
        const nextRows = Array.isArray(response.data?.rows) ? response.data.rows : []
        if (!cancelled) {
          setRepresentationRows(nextRows)
        }
      } catch (error) {
        if (!cancelled) {
          setRepresentationRows([])
        }

        if (!axios.isAxiosError(error) || error.response?.status !== 404) {
          console.error('Failed to load representation rows', error)
        }
      }
    }

    loadRepresentation()

    return () => {
      cancelled = true
    }
  }, [selectedStateCode])

  return {
    summary,
    summaryLoading,
    representationRows,
  }
}

export default useRightDetailsData
