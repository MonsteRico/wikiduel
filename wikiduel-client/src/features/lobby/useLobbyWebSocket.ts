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
  const currentDuel = useRef<DuelProjection | null>(null)
  const departure = useRef<string | null>(null)
  const [leaving, setLeaving] = useState(false)
  const pendingNavigation = useRef<{ requestId: string; duelId: string; roundId: string } | null>(null)
  const [navigating, setNavigating] = useState(false)
  const readyRequest = useRef<string | null>(null)
  const [readyPending, setReadyPending] = useState<string | null>(null)
  const continueRequest = useRef<string | null>(null)
  const [continuePending, setContinuePending] = useState<string | null>(null)
  const rematchRequest = useRef<string | null>(null)
  const [rematchPending, setRematchPending] = useState<string | null>(null)
  const backRequest = useRef<string | null>(null)
  const [backPending, setBackPending] = useState<string | null>(null)
  const serverClock = useRef({ serverNow: 0, receivedAt: 0 })
  const receivedRounds = useRef(new Set<string>())
  const renderedRounds = useRef(new Set<string>())
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<Readonly<{
    title: 'Lobby closed' | 'Forfeit' | 'Interruption' | 'Opponent left'
    message: string
  }> | null>(null)

  const clearDuelState = useCallback(() => {
    currentDuel.current = null
    pendingNavigation.current = null
    setNavigating(false)
    setLeaving(false)
    setDuel(null)
    setLobby(null)
    setError(null)
  }, [])

  useEffect(() => webSocket.subscribeStatus((nextStatus) => {
    setStatus(nextStatus)
    if (nextStatus === 'disconnected' && currentDuel.current) {
      departure.current = currentDuel.current.id
      clearDuelState()
      setNotice({ title: 'Forfeit', message: 'Connection lost. The Duel ended and the Lobby has closed.' })
    }
  }), [webSocket, clearDuelState])

  useEffect(() => {
    const unsubscribeLobbyState = webSocket.subscribe('lobby-state', (message) => {
      currentDuel.current = null
      departure.current = null
      setLeaving(false)
      setLobby(message.lobby)
      setDuel(null)
      rematchRequest.current = null
      setRematchPending(null)
      backRequest.current = null
      setBackPending(null)
      continueRequest.current = null
      setContinuePending(null)
      readyRequest.current = null
      setReadyPending(null)
      receivedRounds.current.clear()
      renderedRounds.current.clear()
      setError(null)
    })
    const unsubscribeLobbyError = webSocket.subscribe('lobby-error', (message) => {
      setError(message.message)
    })
    const unsubscribeLobbyClosed = webSocket.subscribe('lobby-closed', (message) => {
      departure.current = currentDuel.current?.id ?? departure.current
      clearDuelState()
      setNotice({ title: 'Lobby closed', message: message.message })
    })
    const unsubscribeDuelState = webSocket.subscribe('duel-state', (message) => {
      if (departure.current) {
        // A Rematch may commit before the server sees departure for the old Duel.
        if (!currentDuel.current || message.duel.id === departure.current) return
        departure.current = null
        setLeaving(false)
      }
      currentDuel.current = message.duel
      const pending = pendingNavigation.current
      if (pending && (pending.duelId !== message.duel.id || pending.roundId !== message.duel.round.id
        || message.duel.phase === 'post-round' || message.duel.phase === 'completed' || message.duel.phase === 'post-duel')) {
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
      if (message.command === 'leave-duel') {
        if (!currentDuel.current || !departure.current) return
        departure.current = null
        setLeaving(false)
      }
      if (message.command === 'request-rematch') {
        rematchRequest.current = null
        setRematchPending(null)
      }
      if (message.command === 'back-to-lobby') {
        backRequest.current = null
        setBackPending(null)
      }
      if (message.command === 'continue-post-duel') {
        continueRequest.current = null
        setContinuePending(null)
      }
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
      if (currentDuel.current?.id !== message.duelId) return
      departure.current = message.duelId
      clearDuelState()
      setNotice({ title: message.winnerId === clientId ? 'Opponent left' : 'Forfeit', message: message.message })
    })
    const unsubscribeDuelInterrupted = webSocket.subscribe('duel-interrupted', (message) => {
      if (currentDuel.current?.id !== message.duelId) return
      departure.current = message.duelId
      clearDuelState()
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
  }, [webSocket, clearDuelState])

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

  const setTimeLimit = useCallback((enabled: boolean) => {
    webSocket.send({ type: 'set-time-limit', enabled })
  }, [webSocket])

  const startDuel = useCallback(() => {
    webSocket.send({ type: 'start-duel' })
  }, [webSocket])

  const clearNotice = useCallback(() => setNotice(null), [])
  const readyForNextRound = useCallback(() => {
    if (departure.current || !duel || duel.phase !== 'post-round' || duel.outcome.final
      || duel.readyPlayerIds.includes(duel.self.id) || readyRequest.current === duel.round.id) return
    if (webSocket.send({ type: 'ready-next-round', duelId: duel.id, roundId: duel.round.id })) {
      readyRequest.current = duel.round.id
      setReadyPending(duel.round.id)
    }
  }, [duel, webSocket])
  const continueToPostDuel = useCallback(() => {
    if (departure.current || !duel || duel.phase !== 'completed' || continueRequest.current === duel.id) return
    if (webSocket.send({ type: 'continue-post-duel', duelId: duel.id, roundId: duel.round.id })) {
      continueRequest.current = duel.id
      setContinuePending(duel.id)
    }
  }, [duel, webSocket])
  const leaveDuel = useCallback((duelId: string) => {
    if (departure.current || currentDuel.current?.id !== duelId) return
    if (webSocket.send({ type: 'leave-duel', duelId })) {
      departure.current = duelId
      setLeaving(true)
      setError(null)
    }
  }, [webSocket])
  const requestRematch = useCallback(() => {
    if (departure.current || !duel || duel.phase !== 'post-duel' || duel.rematchPlayerIds.includes(duel.self.id)
      || rematchRequest.current === duel.id || backRequest.current === duel.id) return
    if (webSocket.send({ type: 'request-rematch', duelId: duel.id, roundId: duel.round.id })) {
      rematchRequest.current = duel.id
      setRematchPending(duel.id)
    }
  }, [duel, webSocket])
  const backToLobby = useCallback(() => {
    if (departure.current || !duel || duel.phase !== 'post-duel' || backRequest.current === duel.id) return
    if (webSocket.send({ type: 'back-to-lobby', duelId: duel.id, roundId: duel.round.id })) {
      backRequest.current = duel.id
      setBackPending(duel.id)
    }
  }, [duel, webSocket])
  const acknowledgeRendered = useCallback((duelId: string, roundId: string) => {
    if (departure.current || renderedRounds.current.has(roundId)) return
    renderedRounds.current.add(roundId)
    webSocket.send({ type: 'round-rendered', duelId, roundId })
  }, [webSocket])
  const getServerTime = useCallback(() => serverClock.current.serverNow
    + performance.now() - serverClock.current.receivedAt, [])
  const navigate = useCallback((destination: NavigationDestination) => {
    if (departure.current || pendingNavigation.current || !duel || duel.self.arrived
      || (duel.phase !== 'active' && duel.phase !== 'countdown') || getServerTime() < duel.startsAt
      || (duel.expiresAt !== null && getServerTime() >= duel.expiresAt)) return
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
    setTimeLimit,
    startDuel,
    clearNotice,
    acknowledgeRendered,
    getServerTime,
    navigate,
    navigating,
    readyForNextRound,
    readyPending: readyPending === duel?.round.id,
    continueToPostDuel,
    continuePending: continuePending === duel?.id,
    leaveDuel,
    leaving,
    requestRematch,
    rematchPending: rematchPending === duel?.id,
    backToLobby,
    backPending: backPending === duel?.id,
  }
}
