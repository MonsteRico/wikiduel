import { useCallback, useEffect, useState } from 'react'

import { useTransport } from '../../realtime/transportContext'
import type { ConnectionStatus } from '../../realtime/WebSocketTransport'
import type { Room } from './types'

const clientId = crypto.randomUUID()

export function useLobbyTransport() {
  const transport = useTransport()
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [room, setRoom] = useState<Room | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => transport.subscribeStatus(setStatus), [transport])

  useEffect(() => {
    const unsubscribeRoomState = transport.subscribe('room-state', (message) => {
      setRoom(message.room)
      setError(null)
    })
    const unsubscribeRoomError = transport.subscribe('room-error', (message) => {
      setError(message.message)
    })
    const unsubscribeRoomClosed = transport.subscribe('room-closed', (message) => {
      setRoom(null)
      setError(null)
      setNotice(message.message)
    })
    const unsubscribeFailure = transport.subscribeFailure((failure) => {
      if (failure === 'unreadable-message') setError('The server sent an unreadable message')
    })

    return () => {
      unsubscribeRoomState()
      unsubscribeRoomError()
      unsubscribeRoomClosed()
      unsubscribeFailure()
    }
  }, [transport])

  const createRoom = useCallback(() => {
    setError(null)
    setNotice(null)
    transport.send({ type: 'create-room', clientId })
  }, [transport])

  const joinRoom = useCallback((roomCode: string) => {
    setError(null)
    setNotice(null)
    transport.send({ type: 'join-room', clientId, roomCode })
  }, [transport])

  const leaveRoom = useCallback(() => {
    transport.send({ type: 'leave-room' })
    setRoom(null)
    setError(null)
  }, [transport])

  const setReady = useCallback((ready: boolean) => {
    transport.send({ type: 'set-ready', ready })
  }, [transport])

  const startGame = useCallback(() => {
    transport.send({ type: 'start-game' })
  }, [transport])

  const clearNotice = useCallback(() => setNotice(null), [])

  return {
    status,
    room,
    error,
    notice,
    clientId,
    createRoom,
    joinRoom,
    leaveRoom,
    setReady,
    startGame,
    clearNotice,
  }
}
