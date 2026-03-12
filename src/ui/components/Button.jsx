// Shared button primitive.
// Variants are styled in src/ui/styles.css under .ui-btn--<variant>.
function Button({ variant = 'secondary', block = false, className = '', children, ...props }) {
  const classes = ['ui-btn', `ui-btn--${variant}`]
  if (block) classes.push('ui-btn--block')
  if (className) classes.push(className)

  return (
    <button type="button" className={classes.join(' ')} {...props}>
      {children}
    </button>
  )
}

export default Button
