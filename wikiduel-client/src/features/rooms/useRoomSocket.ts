import { useCallback, useEffect, useRef, useState } from 'react'

import type { ConnectionStatus, Room, ServerMessage } from './types'

const websocketUrl =
  import.meta.env.VITE_WS_URL ??
  `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.hostname}:3000/ws`

const clientId = crypto.randomUUID()

export function useRoomSocket() {
  const socketRef = useRef<WebSocket | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [room, setRoom] = useState<Room | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const send = useCallback((message: object) => {
    const socket = socketRef.current
    if (socket?.readyState !== WebSocket.OPEN) return false

    socket.send(JSON.stringify(message))
    return true
  }, [])

  const createRoom = useCallback(() => {
    setError(null)
    setNotice(null)
    send({ type: 'create-room', clientId })
  }, [send])

  const joinRoom = useCallback((roomCode: string) => {
    setError(null)
    setNotice(null)
    send({ type: 'join-room', clientId, roomCode })
  }, [send])

  const leaveRoom = useCallback(() => {
    send({ type: 'leave-room' })
    setRoom(null)
    setError(null)
  }, [send])

  const setReady = useCallback((ready: boolean) => {
    send({ type: 'set-ready', ready })
  }, [send])

  const startGame = useCallback(() => {
    send({ type: 'start-game' })
  }, [send])

  const clearNotice = useCallback(() => setNotice(null), [])

  useEffect(() => {
    const socket = new WebSocket(websocketUrl)
    let active = true
    socketRef.current = socket

    socket.addEventListener('open', () => {
      if (active) setStatus('connected')
    })

    socket.addEventListener('message', (event) => {
      if (!active) return

      try {
        const message = JSON.parse(String(event.data)) as ServerMessage

        if (message.type === 'room-state') {
          setRoom(message.room)
          setError(null)
        } else if (message.type === 'room-error') {
          setError(message.message)
        } else if (message.type === 'room-closed') {
          setRoom(null)
          setError(null)
          setNotice(message.message)
        }
      } catch {
        setError('The server sent an unreadable message')
      }
    })

    socket.addEventListener('close', () => {
      if (active) setStatus('disconnected')
    })

    socket.addEventListener('error', () => {
      if (active) setStatus('disconnected')
    })

    return () => {
      active = false
      socketRef.current = null
      socket.close()
    }
  }, [])

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
