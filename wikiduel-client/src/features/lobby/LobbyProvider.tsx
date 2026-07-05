import type { PropsWithChildren } from 'react'

import { LobbyContext } from './lobbyContext'
import { useLobbyWebSocket } from './useLobbyWebSocket'

export function LobbyProvider({ children }: PropsWithChildren) {
  const lobby = useLobbyWebSocket()

  return <LobbyContext value={lobby}>{children}</LobbyContext>
}
