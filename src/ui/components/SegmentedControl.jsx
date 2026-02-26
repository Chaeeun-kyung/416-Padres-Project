function SegmentedControl({ options, value, onChange, ariaLabel }) {
  return (
    <div className="ui-segmented" role="tablist" aria-label={ariaLabel}>
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
