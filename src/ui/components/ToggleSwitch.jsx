function ToggleSwitch({ checked, onChange, disabled = false, ariaLabel }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      className={`ui-switch ${checked ? 'ui-switch--checked' : ''}`}
      onClick={() => onChange?.(!checked)}
    >
      <span className="ui-switch__thumb" />
    </button>
  )
}

export default ToggleSwitch
