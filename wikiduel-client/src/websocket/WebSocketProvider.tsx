import { useEffect, useState, type PropsWithChildren } from 'react'
import { decodeServerMessage } from '@wikiduel/contracts'

import type { ClientMessage, ServerMessage } from './messages'
import { WebSocketContext } from './webSocketContext'
import { WebSocketTransport } from './WebSocketTransport'

const websocketUrl =
  import.meta.env.VITE_WS_URL
  ?? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.hostname}:3000/ws`

export function WebSocketProvider({ children }: PropsWithChildren) {
  const [webSocket] = useState(
    () => new WebSocketTransport<ClientMessage, ServerMessage>(
      websocketUrl,
      undefined,
      decodeServerMessage,
    ),
  )

  useEffect(() => {
    webSocket.connect()
    return () => webSocket.close()
  }, [webSocket])

  return <WebSocketContext value={webSocket}>{children}</WebSocketContext>
}
