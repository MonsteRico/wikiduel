type IconProps = { className?: string }

export function ArrowRightIcon({ className = 'size-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 10h11M11 6l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function CopyIcon({ className = 'size-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="6.5" y="6.5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M13.5 6.5v-2a1 1 0 0 0-1-1h-8a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

export function PlayersIcon({ className = 'size-5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M3.5 18.5c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5V20h-11v-1.5Z" />
      <path d="M14 14.1c.8-.5 1.8-.8 2.9-.8 2.6 0 4.6 1.9 4.6 4.7v2H16v-1.5c0-1.7-.7-3.2-2-4.4Z" />
    </svg>
  )
}
