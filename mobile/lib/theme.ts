// mobile/lib/theme.ts
// Design tokens for LocalLoop.
// Referenced by all components — change here, change everywhere.

export const colors = {
  // Brand
  primary:        '#16a34a',   // green-600 — proximity, growth, nature
  primaryLight:   '#dcfce7',   // green-100
  primaryDark:    '#15803d',   // green-700

  // Accent
  accent:         '#f59e0b',   // amber-400 — energy, opportunity
  accentLight:    '#fef3c7',

  // Neutrals
  background:     '#0f172a',   // slate-900
  surface:        '#1e293b',   // slate-800
  surfaceLight:   '#334155',   // slate-700
  border:         '#475569',   // slate-600

  // Text
  textPrimary:    '#f8fafc',   // slate-50
  textSecondary:  '#94a3b8',   // slate-400
  textMuted:      '#64748b',   // slate-500

  // Semantic
  success:        '#22c55e',   // green-500
  warning:        '#f59e0b',   // amber-400
  error:          '#ef4444',   // red-500
  info:           '#38bdf8',   // sky-400

  // Map
  radiusRing:     'rgba(22, 163, 74, 0.15)',
  radiusStroke:   'rgba(22, 163, 74, 0.6)',
  pinJob:         '#16a34a',
  pinBusiness:    '#38bdf8',
  pinFair:        '#f59e0b',

  // Swap
  swapActive:     '#f59e0b',
  swapLocked:     '#ef4444',
}

export const spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
}

export const radius = {
  sm:   6,
  md:   12,
  lg:   20,
  full: 9999,
}

export const typography = {
  h1:      { fontSize: 28, fontWeight: '700' as const, color: colors.textPrimary },
  h2:      { fontSize: 22, fontWeight: '700' as const, color: colors.textPrimary },
  h3:      { fontSize: 18, fontWeight: '600' as const, color: colors.textPrimary },
  body:    { fontSize: 15, fontWeight: '400' as const, color: colors.textPrimary },
  caption: { fontSize: 13, fontWeight: '400' as const, color: colors.textSecondary },
  label:   { fontSize: 12, fontWeight: '600' as const, color: colors.textSecondary, letterSpacing: 0.8 },
}
