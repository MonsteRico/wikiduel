import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

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
}

export function Button({
  variant = 'primary',
  icon,
  fullWidth = false,
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`ds-focus inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-control border px-4 font-display text-xs font-extrabold tracking-[0.035em] uppercase transition-[background-color,border-color,color,transform] duration-150 hover:not-disabled:-translate-y-px disabled:cursor-not-allowed disabled:opacity-40 ${variantClasses[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
      {icon ? <span className="grid place-items-center" aria-hidden="true">{icon}</span> : null}
    </button>
  )
}
