// Horizontal segmented selector used for tab-like choices.
function SegmentedControl({ options, value, onChange, ariaLabel, columns = 2 }) {
  const safeColumns = Number.isFinite(Number(columns)) && Number(columns) > 0 ? Math.floor(Number(columns)) : 2
  return (
    <div
      className="ui-segmented"
      role="tablist"
      aria-label={ariaLabel}
      style={{ gridTemplateColumns: `repeat(${safeColumns}, minmax(0, 1fr))` }}
    >
      {(options ?? []).map((option) => {
        const active = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={`ui-segmented__item ${active ? 'ui-segmented__item--active' : ''}`}
            onClick={() => onChange?.(option.value)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export default SegmentedControl
