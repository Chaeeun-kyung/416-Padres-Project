import { create } from 'zustand'

// App-level defaults used for first load and full reset.
const DEFAULT_VIEW = 'splash'
const DEFAULT_TAB = 'Map'
const DEFAULT_METRIC = ''
const DEFAULT_PRECINCT_DATA_VARIANT = 'enacted'

// Dashboard-scoped defaults reused when switching states and when resetting
// the state dashboard without leaving the app.
const DEFAULT_STATE_SETTINGS = {
  activeTab: DEFAULT_TAB,
  activeMetric: DEFAULT_METRIC,
  precinctDataVariant: DEFAULT_PRECINCT_DATA_VARIANT,
  showDistrictBoundaries: true,
  showPrecinctBoundaries: false,
  showDemLeadOverlay: false,
  selectedPrecinctId: null,
  selectedDistrictId: null,
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
  mapResetToken: 0,
  // Enter state mode and reset dashboard-specific state so each state starts
  // from a clean baseline.
  setSelectedStateCode: (stateCode) =>
    set({
      view: 'state',
      selectedStateCode: stateCode,
      ...DEFAULT_STATE_SETTINGS,
      mapResetToken: 0,
    }),
  // Right panel tab selector (Map, Gingles, EI, Ensembles).
  setActiveTab: (tab) => set({ activeTab: tab }),
  // Heatmap metric selector.
  // If a metric is selected, turn off Dem lead overlay to keep one coloring
  // mode active at a time.
  setActiveMetric: (metric) =>
    set((state) => ({
      activeMetric: metric,
      showDemLeadOverlay: metric ? false : state.showDemLeadOverlay,
    })),
<<<<<<< HEAD
  setPrecinctDataVariant: (variant) =>
    set({ precinctDataVariant: variant === 'cvap' ? 'cvap' : DEFAULT_PRECINCT_DATA_VARIANT }),
=======
  // Map layer toggles.
>>>>>>> origin/main
  toggleDistrictBoundaries: () =>
    set((state) => ({ showDistrictBoundaries: !state.showDistrictBoundaries })),
  togglePrecinctBoundaries: () =>
    set((state) => ({ showPrecinctBoundaries: !state.showPrecinctBoundaries })),
  // Dem lead overlay and demographic heatmap are mutually exclusive.
  toggleDemLeadOverlay: () =>
    set((state) => {
      const nextShowDemLeadOverlay = !state.showDemLeadOverlay
      return {
        showDemLeadOverlay: nextShowDemLeadOverlay,
        activeMetric: nextShowDemLeadOverlay ? '' : state.activeMetric,
      }
    }),
  // Selection state used by map + details table interaction.
  setSelectedPrecinctId: (precinctId) => set({ selectedPrecinctId: precinctId }),
  setSelectedDistrictId: (districtId) => set({ selectedDistrictId: districtId }),
  // Dashboard reset keeps selected state but clears in-page filters/selections.
  // Incrementing mapResetToken tells map components to refit/reset view.
  resetDashboardPage: () =>
    set((state) => ({
      view: 'state',
      selectedStateCode: state.selectedStateCode,
      ...DEFAULT_STATE_SETTINGS,
      mapResetToken: state.mapResetToken + 1,
    })),
  // Full app reset returns to splash page and clears selected state.
  resetApp: () =>
    set({
      view: DEFAULT_VIEW,
      selectedStateCode: null,
      ...DEFAULT_STATE_SETTINGS,
      mapResetToken: 0,
    }),
}))

export default useAppStore
