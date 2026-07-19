import { createContext, useContext } from 'react'


import type { WebSocketTransport } from './WebSocketTransport'
import type { ClientMessage, ServerMessage } from '@wikiduel/contracts'

export type ApplicationWebSocket = WebSocketTransport<ClientMessage, ServerMessage>

export const WebSocketContext = createContext<ApplicationWebSocket | null>(null)

export function useWebSocket() {
  const webSocket = useContext(WebSocketContext)

  if (!webSocket) {
    throw new Error('useWebSocket must be used within a WebSocketProvider')
  }

  return webSocket
}
