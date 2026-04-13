import axios from 'axios'

const summaryCache = new Map()

function normalizeStateCode(stateCode) {
  if (!stateCode) return ''
  return String(stateCode).trim().toUpperCase()
}

export async function fetchStateSummary(stateCode) {
  const normalizedStateCode = normalizeStateCode(stateCode)
  if (!normalizedStateCode) {
    throw new Error('State code is required')
  }

  const cached = summaryCache.get(normalizedStateCode)
  if (cached?.data) {
    return cached.data
  }
  if (cached?.promise) {
    return cached.promise
  }

  const pending = axios
    .get(`/api/states/${normalizedStateCode}/summary`)
    .then((response) => {
      const data = response.data ?? null
      summaryCache.set(normalizedStateCode, { data })
      return data
    })
    .catch((error) => {
      summaryCache.delete(normalizedStateCode)
      throw error
    })

  summaryCache.set(normalizedStateCode, { promise: pending })
  return pending
}

export function clearSummaryCache(stateCode) {
  const normalizedStateCode = normalizeStateCode(stateCode)
  if (!normalizedStateCode) return
  summaryCache.delete(normalizedStateCode)
}
