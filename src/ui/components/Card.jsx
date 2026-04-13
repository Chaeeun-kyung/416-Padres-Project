// Shared panel/card shell.
// Handles optional header text, compact spacing, and no-padding mode.
function Card({ title, subtitle, actions, children, className = '', compact = false, noPadding = false }) {
  const modeClass = noPadding ? 'ui-card--none' : compact ? 'ui-card--compact' : ''
  const cardClassName = ['ui-card', modeClass, className].filter(Boolean).join(' ')

  return (
    <section className={cardClassName}>
      {(title || subtitle || actions) && (
        <header className="ui-card__header">
          <div>
            {title && <div className="ui-card__title">{title}</div>}
            {subtitle && <div className="ui-card__subtitle">{subtitle}</div>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  )
}

export default Card
