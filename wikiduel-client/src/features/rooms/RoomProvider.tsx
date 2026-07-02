import type { PropsWithChildren } from 'react'

import { RoomContext } from './roomContext'
import { useRoomSocket } from './useRoomSocket'

export function RoomProvider({ children }: PropsWithChildren) {
  const room = useRoomSocket()

  return <RoomContext value={room}>{children}</RoomContext>
}
