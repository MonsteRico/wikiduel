import type { PropsWithChildren } from 'react'

import { RoomContext } from './roomContext'
import { useLobbyTransport } from './useLobbyTransport'

export function RoomProvider({ children }: PropsWithChildren) {
  const room = useLobbyTransport()

  return <RoomContext value={room}>{children}</RoomContext>
}
