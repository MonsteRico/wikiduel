import { useCallback, useEffect, useRef, useState } from 'react'

import { useWebSocket } from '../../websocket/webSocketContext'
import type { ConnectionStatus } from '../../websocket/WebSocketTransport'
import type { Lobby, DuelProjection, NavigationDestination } from '@wikiduel/contracts'

const clientId = crypto.randomUUID()

export function useLobbyWebSocket() {
  const webSocket = useWebSocket()
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [lobby, setLobby] = useState<Lobby | null>(null)
  const [duel, setDuel] = useState<DuelProjection | null>(null)
  const serverClock = useRef({ serverNow: 0, receivedAt: 0 })
  const receivedRounds = useRef(new Set<string>())
  const renderedRounds = useRef(new Set<string>())
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<Readonly<{
    title: 'Lobby closed' | 'Forfeit' | 'Interruption'
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
      serverClock.current = { serverNow: message.duel.serverNow, receivedAt: performance.now() }
      if (message.duel.phase === 'preparing' && message.duel.round.article
        && !receivedRounds.current.has(message.duel.round.id)) {
        receivedRounds.current.add(message.duel.round.id)
        webSocket.send({ type: 'round-received', duelId: message.duel.id, roundId: message.duel.round.id })
      }
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
    const unsubscribeDuelInterrupted = webSocket.subscribe('duel-interrupted', (message) => {
      setLobby(null)
      setDuel(null)
      setError(null)
      setNotice({ title: 'Interruption', message: message.message })
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
      unsubscribeDuelInterrupted()
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
  const acknowledgeRendered = useCallback((duelId: string, roundId: string) => {
    if (renderedRounds.current.has(roundId)) return
    renderedRounds.current.add(roundId)
    webSocket.send({ type: 'round-rendered', duelId, roundId })
  }, [webSocket])
  const getServerTime = useCallback(() => serverClock.current.serverNow
    + performance.now() - serverClock.current.receivedAt, [])
  const navigate = useCallback((destination: NavigationDestination) => {
    if (!duel || duel.phase === 'preparing' || getServerTime() < duel.startsAt) return
    webSocket.send({ type: 'navigate', duelId: duel.id, roundId: duel.round.id,
      requestId: crypto.randomUUID(), destination })
  }, [duel, getServerTime, webSocket])

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
    acknowledgeRendered,
    getServerTime,
    navigate,
  }
}
