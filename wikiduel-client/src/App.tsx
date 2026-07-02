import { useEffect, useRef, useState } from 'react'

import './App.css'

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

type ServerMessage = {
  type: 'welcome' | 'pong'
  message: string
  sentAt: string
}

const websocketUrl =
  import.meta.env.VITE_WS_URL ??
  `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.hostname}:3000/ws`

function App() {
  const socketRef = useRef<WebSocket | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [lastSent, setLastSent] = useState('Waiting for connection…')
  const [lastReceived, setLastReceived] = useState('Waiting for server…')
  const [confirmedExchanges, setConfirmedExchanges] = useState(0)

  const sendPing = () => {
    const socket = socketRef.current

    if (socket?.readyState !== WebSocket.OPEN) {
      return
    }

    socket.send(JSON.stringify({ type: 'ping' }))
    setLastSent('Ping from WikiDuel client')
  }

  useEffect(() => {
    const socket = new WebSocket(websocketUrl)
    let active = true

    socketRef.current = socket

    socket.addEventListener('open', () => {
      if (!active) return

      setStatus('connected')
      socket.send(JSON.stringify({ type: 'ping' }))
      setLastSent('Ping from WikiDuel client')
    })

    socket.addEventListener('message', (event) => {
      if (!active) return

      try {
        const message = JSON.parse(String(event.data)) as ServerMessage
        setLastReceived(message.message)
        if (message.type === 'pong') {
          setConfirmedExchanges((count) => count + 1)
        }
      } catch {
        setLastReceived('Received an unreadable server message')
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

  return (
    <main className="connection-panel">
      <p className="eyebrow">WikiDuel</p>
      <h1>Client ↔ Server</h1>

      <div className={`status status--${status}`} role="status" aria-live="polite">
        <span className="status__dot" aria-hidden="true" />
        {status}
      </div>

      <dl className="exchange">
        <div>
          <dt>Client sent</dt>
          <dd>{lastSent}</dd>
        </div>
        <div>
          <dt>Server replied</dt>
          <dd>{lastReceived}</dd>
        </div>
      </dl>

      <button type="button" onClick={sendPing} disabled={status !== 'connected'}>
        Send another ping
      </button>

      <p className="confirmation-count">Confirmed exchanges: {confirmedExchanges}</p>
      <p className="endpoint">{websocketUrl}</p>
    </main>
  )
}

export default App
