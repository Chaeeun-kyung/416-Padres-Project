import Select from '../../ui/components/Select'

const SPLASH_STATE_OPTIONS = [
  { value: '', label: 'Choose a state (AZ or CO)' },
  { value: 'AZ', label: 'Arizona (AZ)' },
  { value: 'CO', label: 'Colorado (CO)' },
]

// Splash page intro panel and state picker.
// Allows users to enter dashboard mode without clicking the map.
function SplashHero({ selectedStateCode, onStateSelect, disabled = false }) {
  const effectiveValue = selectedStateCode ?? ''

  return (
    <div className="splash-hero">
      <p className="splash-eyebrow">CSE 416 Team Padres</p>
      <h1 className="splash-title">VRA Reduction Analysis</h1>
      <p className="splash-subtitle">Explore how districting and the Voting Rights Act influence minority representation.</p>
      <p className="splash-helper">Select a state to begin analysis. Only Arizona and Colorado are available.</p>

      <div className="panel-card splash-state-picker">
        <label className="splash-state-picker__label" htmlFor="splash-state-select">
          Select state
        </label>
        <Select
          id="splash-state-select"
          ariaLabel="Select a state"
          aria-describedby="splash-select-help"
          value={effectiveValue}
          onChange={(stateCode) => {
            if (stateCode) onStateSelect?.(stateCode)
          }}
          disabled={disabled}
          options={SPLASH_STATE_OPTIONS}
        />
        <div id="splash-select-help" className="small-text muted-text splash-state-picker__hint">
          You can also click directly on the map.
        </div>
      </div>

      <div className="splash-divider" />
    </div>
  )
}

export default SplashHero
