import { createContext, useContext } from 'react'

import type { useRoomSocket } from './useRoomSocket'

type RoomContextValue = ReturnType<typeof useRoomSocket>

export const RoomContext = createContext<RoomContextValue | null>(null)

export function useRoom() {
  const room = useContext(RoomContext)

  if (!room) {
    throw new Error('useRoom must be used within a RoomProvider')
  }

  return room
}
