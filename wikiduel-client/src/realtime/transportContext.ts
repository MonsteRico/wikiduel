import { createContext, useContext } from 'react'

import type { ClientMessage, ServerMessage } from './messages'
import type { WebSocketTransport } from './WebSocketTransport'

export type ApplicationTransport = WebSocketTransport<ClientMessage, ServerMessage>

export const TransportContext = createContext<ApplicationTransport | null>(null)

export function useTransport() {
  const transport = useContext(TransportContext)

  if (!transport) {
    throw new Error('useTransport must be used within a TransportProvider')
  }

  return transport
}
