import { useCallback, useEffect, useState } from 'react'

import { useWebSocket } from '../../websocket/webSocketContext'
import type { ConnectionStatus } from '../../websocket/WebSocketTransport'
import type { Lobby, PreparingDuelProjection } from '@wikiduel/contracts'

const clientId = crypto.randomUUID()

export function useLobbyWebSocket() {
  const webSocket = useWebSocket()
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [lobby, setLobby] = useState<Lobby | null>(null)
  const [duel, setDuel] = useState<PreparingDuelProjection | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<Readonly<{
    title: 'Lobby closed' | 'Forfeit'
    message: string
  }> | null>(null)

  useEffect(() => webSocket.subscribeStatus(setStatus), [webSocket])

  useEffect(() => {
    const unsubscribeLobbyState = webSocket.subscribe('lobby-state', (message) => {
      setLobby(message.lobby)
      setError(null)
    })
    const unsubscribeLobbyError = webSocket.subscribe('lobby-error', (message) => {
      setError(message.message)
    })
    const unsubscribeLobbyClosed = webSocket.subscribe('lobby-closed', (message) => {
      setLobby(null)
      setDuel(null)
      setError(null)
      setNotice({ title: 'Lobby closed', message: message.message })
    })
    const unsubscribeDuelState = webSocket.subscribe('duel-state', (message) => {
      setDuel(message.duel)
      setError(null)
    })
    const unsubscribeCommandRejected = webSocket.subscribe('command-rejected', (message) => {
      setError(`The ${message.command} command was rejected: ${message.reason}.`)
    })
    const unsubscribeDuelForfeited = webSocket.subscribe('duel-forfeited', (message) => {
      setLobby(null)
      setDuel(null)
      setError(null)
      setNotice({ title: 'Forfeit', message: message.message })
    })
    const unsubscribeFailure = webSocket.subscribeFailure((failure) => {
      if (failure === 'unreadable-message') setError('The server sent an unreadable message')
    })

    return () => {
      unsubscribeLobbyState()
      unsubscribeLobbyError()
      unsubscribeLobbyClosed()
      unsubscribeDuelState()
      unsubscribeCommandRejected()
      unsubscribeDuelForfeited()
      unsubscribeFailure()
    }
  }, [webSocket])

  const createLobby = useCallback(() => {
    setError(null)
    setNotice(null)
    webSocket.send({ type: 'create-lobby', clientId })
  }, [webSocket])

  const joinLobby = useCallback((lobbyCode: string) => {
    setError(null)
    setNotice(null)
    webSocket.send({ type: 'join-lobby', clientId, lobbyCode })
  }, [webSocket])

  const leaveLobby = useCallback(() => {
    webSocket.send({ type: 'leave-lobby' })
    setLobby(null)
    setError(null)
  }, [webSocket])

  const setReady = useCallback((ready: boolean) => {
    webSocket.send({ type: 'set-ready', ready })
  }, [webSocket])

  const startDuel = useCallback(() => {
    webSocket.send({ type: 'start-duel' })
  }, [webSocket])

  const clearNotice = useCallback(() => setNotice(null), [])

  return {
    status,
    lobby,
    duel,
    error,
    notice,
    clientId,
    createLobby,
    joinLobby,
    leaveLobby,
    setReady,
    startDuel,
    clearNotice,
  }
}
