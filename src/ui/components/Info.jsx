// Small "i" tooltip helper used next to chart titles and controls.
function Info({ text, label = 'More info', maxWidth = 320 }) {
  return (
    <span className="ui-info-hint" tabIndex={0} aria-label={label} style={{ '--ui-info-max-width': `${maxWidth}px` }}>
      <span className="ui-info-hint__icon" aria-hidden="true">i</span>
      <span className="ui-info-hint__bubble" role="tooltip">{text}</span>
    </span>
  )
}

export default Info
