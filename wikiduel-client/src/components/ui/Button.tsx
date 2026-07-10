import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'inline'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  icon?: ReactNode
  fullWidth?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'border-host-strong bg-host-strong text-white hover:not-disabled:border-host hover:not-disabled:bg-host',
  secondary: 'border-line bg-surface-raised text-ink hover:not-disabled:border-host hover:not-disabled:bg-surface',
  ghost: 'border-transparent bg-transparent text-ink-soft hover:not-disabled:text-ink',
  danger: 'border-opponent-strong bg-opponent-strong text-white hover:not-disabled:border-opponent hover:not-disabled:bg-opponent',
  inline: 'text-host decoration-host/50 hover:not-disabled:text-host-strong',
}

export function Button({
  variant = 'primary',
  icon,
  fullWidth = false,
  className = '',
  children,
  ...props
}: ButtonProps) {
  const layoutClasses = variant === 'inline'
    ? 'inline min-h-0 border-0 bg-transparent p-0 font-[inherit] underline underline-offset-2'
    : 'inline-flex min-h-10 items-center justify-center gap-2 rounded-control border px-4 font-display text-xs font-extrabold tracking-[0.035em] uppercase hover:not-disabled:-translate-y-px'

  return (
    <button
      className={`ds-focus cursor-pointer transition-[background-color,border-color,color,transform] duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${layoutClasses} ${variantClasses[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
      {icon ? <span className="grid place-items-center" aria-hidden="true">{icon}</span> : null}
    </button>
  )
}
