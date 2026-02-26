function Select({ options, value, onChange, ariaLabel, ...rest }) {
  return (
    <select
      className="ui-select"
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
      aria-label={ariaLabel}
      {...rest}
    >
      {(options ?? []).map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

export default Select
