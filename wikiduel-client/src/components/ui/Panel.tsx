import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react'

type PanelProps<T extends ElementType> = {
  as?: T
  children: ReactNode
  className?: string
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'children' | 'className'>

export function Panel<T extends ElementType = 'section'>({ as, className = '', children, ...props }: PanelProps<T>) {
  const Component = as ?? 'section'

  return <Component className={`ds-panel ${className}`} {...props}>{children}</Component>
}
