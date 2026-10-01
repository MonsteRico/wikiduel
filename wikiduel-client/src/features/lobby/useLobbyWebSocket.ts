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
  const pendingNavigation = useRef<{ requestId: string; duelId: string; roundId: string } | null>(null)
  const [navigating, setNavigating] = useState(false)
  const readyRequest = useRef<string | null>(null)
  const [readyPending, setReadyPending] = useState<string | null>(null)
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
      const pending = pendingNavigation.current
      if (pending && (pending.duelId !== message.duel.id || pending.roundId !== message.duel.round.id
        || message.duel.phase === 'post-round' || message.duel.phase === 'completed')) {
        pendingNavigation.current = null
        setNavigating(false)
      }
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
      if (message.command === 'ready-next-round') {
        readyRequest.current = null
        setReadyPending(null)
      }
      setError(`The ${message.command} command was rejected: ${message.reason}.`)
    })
    const unsubscribeNavigation = webSocket.subscribe('navigation-result', (message) => {
      const pending = pendingNavigation.current
      if (!pending || pending.requestId !== message.requestId || pending.duelId !== message.duelId
        || pending.roundId !== message.roundId) return
      pendingNavigation.current = null
      setNavigating(false)
      if (!message.accepted) setError('Navigation failed. Choose a link to try again.')
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
      unsubscribeNavigation()
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
  const readyForNextRound = useCallback(() => {
    if (!duel || duel.phase !== 'post-round' || duel.outcome.final
      || duel.readyPlayerIds.includes(duel.self.id) || readyRequest.current === duel.round.id) return
    if (webSocket.send({ type: 'ready-next-round', duelId: duel.id, roundId: duel.round.id })) {
      readyRequest.current = duel.round.id
      setReadyPending(duel.round.id)
    }
  }, [duel, webSocket])
  const leaveDuel = useCallback(() => {
    if (duel) webSocket.send({ type: 'leave-duel', duelId: duel.id })
  }, [duel, webSocket])
  const acknowledgeRendered = useCallback((duelId: string, roundId: string) => {
    if (renderedRounds.current.has(roundId)) return
    renderedRounds.current.add(roundId)
    webSocket.send({ type: 'round-rendered', duelId, roundId })
  }, [webSocket])
  const getServerTime = useCallback(() => serverClock.current.serverNow
    + performance.now() - serverClock.current.receivedAt, [])
  const navigate = useCallback((destination: NavigationDestination) => {
    if (pendingNavigation.current || !duel || (duel.phase !== 'active' && duel.phase !== 'countdown') || getServerTime() < duel.startsAt) return
    const pending = { requestId: crypto.randomUUID(), duelId: duel.id, roundId: duel.round.id }
    pendingNavigation.current = pending
    if (webSocket.send({ type: 'navigate', ...pending, destination,
      source: duel.round.article.identity, expectedClicks: duel.self.clicks })) {
      setNavigating(true)
      setError(null)
    } else {
      pendingNavigation.current = null
      setError('Navigation failed. Check your connection.')
    }
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
    navigating,
    readyForNextRound,
    readyPending: readyPending === duel?.round.id,
    leaveDuel,
  }
}
