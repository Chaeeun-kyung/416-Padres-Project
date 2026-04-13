// Centralized UI tokens used to generate CSS variables at runtime.
export const theme = {
  colors: {
    background: '#f4f5f7',
    panel: '#ffffff',
    border: '#e7e9ee',
    text: '#111827',
    secondaryText: 'rgba(17, 24, 39, 0.72)',
    muted: 'rgba(17, 24, 39, 0.55)',
    accent: '#FFE16F',
    accentSoft: '#FFF6BF',
  },
  radii: {
    sm: 12,
    md: 16,
    lg: 20,
  },
  spacing: {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
  },
  shadow: {
    layered: '0 1px 2px rgba(17, 24, 39, 0.04), 0 8px 22px rgba(17, 24, 39, 0.05)',
  },
  typography: {
    font:
      'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    headingSize: '19px',
    sectionSize: '13.5px',
    bodySize: '12.5px',
  },
}

// Pushes theme tokens into :root CSS variables so plain CSS can reference them.
export function applyThemeVars() {
  const root = document.documentElement
  root.style.setProperty('--ui-bg', theme.colors.background)
  root.style.setProperty('--ui-panel', theme.colors.panel)
  root.style.setProperty('--ui-border', theme.colors.border)
  root.style.setProperty('--ui-text', theme.colors.text)
  root.style.setProperty('--ui-text-secondary', theme.colors.secondaryText)
  root.style.setProperty('--ui-muted', theme.colors.muted)
  root.style.setProperty('--ui-accent', theme.colors.accent)
  root.style.setProperty('--ui-accent-soft', theme.colors.accentSoft)
  root.style.setProperty('--ui-radius-sm', `${theme.radii.sm}px`)
  root.style.setProperty('--ui-radius-md', `${theme.radii.md}px`)
  root.style.setProperty('--ui-radius-lg', `${theme.radii.lg}px`)
  root.style.setProperty('--ui-space-xs', `${theme.spacing.xs}px`)
  root.style.setProperty('--ui-space-sm', `${theme.spacing.sm}px`)
  root.style.setProperty('--ui-space-md', `${theme.spacing.md}px`)
  root.style.setProperty('--ui-space-lg', `${theme.spacing.lg}px`)
  root.style.setProperty('--ui-shadow', theme.shadow.layered)
  root.style.setProperty('--ui-font', theme.typography.font)
  root.style.setProperty('--ui-heading-size', theme.typography.headingSize)
  root.style.setProperty('--ui-section-size', theme.typography.sectionSize)
  root.style.setProperty('--ui-body-size', theme.typography.bodySize)
}
