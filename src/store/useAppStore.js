import { create } from 'zustand'

const DEFAULT_VIEW = 'splash'
const DEFAULT_TAB = 'Map'
const DEFAULT_METRIC = 'pct_dem_lead'

const DEFAULT_STATE_SETTINGS = {
  activeTab: DEFAULT_TAB,
  activeMetric: DEFAULT_METRIC,
  showDistrictBoundaries: true,
  showChoropleth: true,
  selectedPrecinctId: null,
  selectedDistrictId: null,
  bottomDrawerOpen: true,
}

const useAppStore = create((set) => ({
  view: DEFAULT_VIEW,
  selectedStateCode: null,
  activeTab: DEFAULT_TAB,
  activeMetric: DEFAULT_METRIC,
  showDistrictBoundaries: true,
  showChoropleth: true,
  selectedPrecinctId: null,
  selectedDistrictId: null,
  bottomDrawerOpen: true,
  mapResetToken: 0,
  setSelectedStateCode: (stateCode) =>
    set({
      view: 'state',
      selectedStateCode: stateCode,
      ...DEFAULT_STATE_SETTINGS,
      mapResetToken: 0,
    }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setActiveMetric: (metric) => set({ activeMetric: metric }),
  toggleDistrictBoundaries: () =>
    set((state) => ({ showDistrictBoundaries: !state.showDistrictBoundaries })),
  toggleChoropleth: () =>
    set((state) => ({ showChoropleth: !state.showChoropleth })),
  setSelectedPrecinctId: (precinctId) => set({ selectedPrecinctId: precinctId }),
  setSelectedDistrictId: (districtId) => set({ selectedDistrictId: districtId }),
  setBottomDrawerOpen: (open) => set({ bottomDrawerOpen: Boolean(open) }),
  toggleBottomDrawer: () =>
    set((state) => ({ bottomDrawerOpen: !state.bottomDrawerOpen })),
  resetDashboardPage: () =>
    set((state) => ({
      view: 'state',
      selectedStateCode: state.selectedStateCode,
      ...DEFAULT_STATE_SETTINGS,
      mapResetToken: state.mapResetToken + 1,
    })),
  resetApp: () =>
    set({
      view: DEFAULT_VIEW,
      selectedStateCode: null,
      ...DEFAULT_STATE_SETTINGS,
      mapResetToken: 0,
    }),
}))

export default useAppStore
