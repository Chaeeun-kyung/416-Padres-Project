function Badge({ children, className = '' }) {
  return <span className={`ui-badge ${className}`.trim()}>{children}</span>
}

export default Badge
