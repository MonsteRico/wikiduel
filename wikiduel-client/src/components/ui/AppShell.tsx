import type { PropsWithChildren, ReactNode } from 'react'
import { Link } from 'react-router'

type AppShellProps = PropsWithChildren<{
  headerAction?: ReactNode
}>

export function AppShell({ headerAction, children }: AppShellProps) {
  return (
    <main className="mx-auto min-h-screen w-[min(1120px,calc(100%_-_48px))] pb-10 max-[640px]:w-[min(100%_-_28px,620px)]">
      <header className="flex min-h-20 items-center justify-between gap-6">
        <Link className="ds-focus rounded-sm font-display text-[22px] font-black tracking-[0.025em] text-ink no-underline" to="/" aria-label="WikiDuel home">
          WIKI <span className="text-host">DUEL</span>
        </Link>
        {headerAction}
      </header>
      {children}
    </main>
  )
}
