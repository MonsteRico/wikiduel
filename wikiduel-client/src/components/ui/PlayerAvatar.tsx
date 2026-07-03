import { PlayersIcon } from './Icons'

type PlayerAvatarProps = {
  role: 'host' | 'opponent'
  size?: 'sm' | 'md'
}

export function PlayerAvatar({ role, size = 'md' }: PlayerAvatarProps) {
  const color = role === 'host' ? 'bg-host' : 'bg-opponent'
  const sizeClass = size === 'sm' ? 'size-8' : 'size-11'

  return (
    <span className={`grid ${sizeClass} shrink-0 place-items-center rounded-full ${color} text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/18%)]`} aria-hidden="true">
      <PlayersIcon className={size === 'sm' ? 'size-4' : 'size-[22px]'} />
    </span>
  )
}
