import type { ReactNode } from 'react'

export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral'

const toneClasses: Record<StatusTone, { dot: string; text: string }> = {
  success: { dot: 'bg-success', text: 'text-success' },
  warning: { dot: 'bg-warning', text: 'text-warning' },
  danger: { dot: 'bg-danger', text: 'text-danger' },
  neutral: { dot: 'bg-ink-faint', text: 'text-ink-soft' },
}

export function StatusIndicator({ children, tone = 'neutral' }: { children: ReactNode; tone?: StatusTone }) {
  const classes = toneClasses[tone]

  return (
    <span className={`inline-flex items-center gap-1.5 font-display text-[10px] font-bold tracking-[0.04em] uppercase ${classes.text}`}>
      <span className={`size-1.5 rounded-full ${classes.dot}`} aria-hidden="true" />
      {children}
    </span>
  )
}
