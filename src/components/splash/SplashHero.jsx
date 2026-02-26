import Select from '../../ui/components/Select'

const SPLASH_STATE_OPTIONS = [
  { value: '', label: 'Select a state (AZ or CO)' },
  { value: 'AZ', label: 'Arizona (AZ)' },
  { value: 'CO', label: 'Colorado (CO)' },
]

function SplashHero({ selectedStateCode, onStateSelect }) {
  const effectiveValue = selectedStateCode ?? ''

  return (
    <div className="splash-hero">
      <h1 className="splash-title">CSE 416 Project</h1>
      <p className="splash-subtitle">Select a state to enter the interactive district analysis workspace.</p>
      <p className="splash-subtitle">Only Colorado (CO) and Arizona (AZ) are selectable now.</p>
      <div className="panel-card splash-state-picker">
        <label className="splash-state-picker__label" htmlFor="splash-state-select">
          State Selector:
        </label>
        <Select
          id="splash-state-select"
          ariaLabel="Select a state"
          value={effectiveValue}
          onChange={(stateCode) => {
            if (stateCode) onStateSelect?.(stateCode)
          }}
          options={SPLASH_STATE_OPTIONS}
        />
        <div className="small-text muted-text splash-state-picker__hint">
          You can click the map or use this dropdown to continue.
        </div>
      </div>
      <div className="splash-divider" />
    </div>
  )
}

export default SplashHero
