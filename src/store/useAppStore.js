import { create } from 'zustand'

const DEFAULT_VIEW = 'splash'
const DEFAULT_TAB = 'Map'
const DEFAULT_METRIC = ''
const DEFAULT_PRECINCT_DATA_VARIANT = 'enacted'

const DEFAULT_STATE_SETTINGS = {
  activeTab: DEFAULT_TAB,
  activeMetric: DEFAULT_METRIC,
  precinctDataVariant: DEFAULT_PRECINCT_DATA_VARIANT,
  showDistrictBoundaries: true,
  showPrecinctBoundaries: false,
  showDemLeadOverlay: false,
  selectedPrecinctId: null,
  selectedDistrictId: null,
  bottomDrawerOpen: true,
}

const useAppStore = create((set) => ({
  view: DEFAULT_VIEW,
  selectedStateCode: null,
  activeTab: DEFAULT_TAB,
  activeMetric: DEFAULT_METRIC,
  precinctDataVariant: DEFAULT_PRECINCT_DATA_VARIANT,
  showDistrictBoundaries: true,
  showPrecinctBoundaries: false,
  showDemLeadOverlay: false,
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
  setActiveMetric: (metric) =>
    set((state) => ({
      activeMetric: metric,
      showDemLeadOverlay: metric ? false : state.showDemLeadOverlay,
    })),
  setPrecinctDataVariant: (variant) =>
    set({ precinctDataVariant: variant === 'cvap' ? 'cvap' : DEFAULT_PRECINCT_DATA_VARIANT }),
  toggleDistrictBoundaries: () =>
    set((state) => ({ showDistrictBoundaries: !state.showDistrictBoundaries })),
  togglePrecinctBoundaries: () =>
    set((state) => ({ showPrecinctBoundaries: !state.showPrecinctBoundaries })),
  toggleDemLeadOverlay: () =>
    set((state) => {
      const nextShowDemLeadOverlay = !state.showDemLeadOverlay
      return {
        showDemLeadOverlay: nextShowDemLeadOverlay,
        activeMetric: nextShowDemLeadOverlay ? '' : state.activeMetric,
      }
    }),
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
