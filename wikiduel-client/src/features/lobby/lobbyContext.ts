import { createContext, useContext } from 'react'

import type { useLobbyWebSocket } from './useLobbyWebSocket'

type LobbyContextValue = ReturnType<typeof useLobbyWebSocket>

export const LobbyContext = createContext<LobbyContextValue | null>(null)

export function useLobby() {
  const lobby = useContext(LobbyContext)

  if (!lobby) {
    throw new Error('useLobby must be used within a LobbyProvider')
  }

  return lobby
}
