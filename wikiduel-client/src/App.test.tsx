import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'
import type { Room as Lobby, ServerMessage } from './features/rooms/types'

type WithoutTimestamp<Message> = Message extends unknown ? Omit<Message, 'sentAt'> : never

class ControllableWebSocket extends EventTarget {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3

  readonly sentMessages: string[] = []
  readonly url: string
  readyState = ControllableWebSocket.CONNECTING

  constructor(url: string) {
    super()
    this.url = url
    sockets.push(this)
  }

  send(message: string) {
    this.sentMessages.push(message)
  }

  open() {
    this.readyState = ControllableWebSocket.OPEN
    this.dispatchEvent(new Event('open'))
  }

  receive(message: WithoutTimestamp<ServerMessage>) {
    this.dispatchEvent(new MessageEvent('message', {
      data: JSON.stringify({ ...message, sentAt: '2026-07-04T12:00:00.000Z' }),
    }))
  }

  close() {
    this.readyState = ControllableWebSocket.CLOSED
    this.dispatchEvent(new Event('close'))
  }
}

const sockets: ControllableWebSocket[] = []
function hostLobby(clientId: string): Lobby {
  return {
    code: '7G8KZ',
    members: [{ id: clientId, name: 'host', role: 'host', connected: true, ready: false }],
  }
}

function renderApp(initialPath = '/') {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <App />
    </MemoryRouter>,
  )

  const socket = sockets.at(-1)
  if (!socket) throw new Error('Expected the Room provider to open a WebSocket')
  return socket
}

function sentMessages(socket: ControllableWebSocket) {
  return socket.sentMessages.map((message) => JSON.parse(message) as Record<string, unknown>)
}

function sentClientId(socket: ControllableWebSocket) {
  const clientId = sentMessages(socket).find((message) => 'clientId' in message)?.clientId
  if (typeof clientId !== 'string') throw new Error('Expected a command with a clientId')
  return clientId
}

beforeEach(() => {
  sockets.length = 0
  vi.stubGlobal('WebSocket', ControllableWebSocket)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Lobby client', () => {
  it('presents connection state and creates a Lobby through the transport', async () => {
    const user = userEvent.setup()
    const socket = renderApp()
    const createButton = screen.getByRole('button', { name: /create lobby/i })

    expect(screen.getByRole('status')).toHaveTextContent('Server connecting')
    expect(createButton).toBeDisabled()

    act(() => socket.open())
    expect(screen.getByRole('status')).toHaveTextContent('Server connected')

    await user.click(createButton)
    const clientId = sentClientId(socket)
    expect(sentMessages(socket)).toContainEqual({ type: 'create-room', clientId })

    act(() => socket.receive({ type: 'room-state', room: hostLobby(clientId) }))
    expect(await screen.findByRole('heading', { name: 'Waiting for the duel' })).toBeInTheDocument()
    expect(screen.getByText('1 / 2 joined')).toBeInTheDocument()
    expect(screen.getByText('You')).toBeInTheDocument()
  })

  it('joins a Lobby and presents rejected join notices', async () => {
    const user = userEvent.setup()
    const socket = renderApp()
    act(() => socket.open())

    await user.type(screen.getByLabelText('Lobby code'), '7g8kz')
    await user.click(screen.getByRole('button', { name: /join lobby/i }))
    const clientId = sentClientId(socket)
    expect(sentMessages(socket)).toContainEqual({
      type: 'join-room',
      clientId,
      roomCode: '7G8KZ',
    })

    act(() => socket.receive({ type: 'room-error', message: 'Lobby not found' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Lobby not found')
    expect(screen.getByRole('button', { name: /join lobby/i })).toBeEnabled()
  })

  it('projects readiness and exposes start control only to a ready Host', async () => {
    const user = userEvent.setup()
    const socket = renderApp('/room/7G8KZ')
    act(() => socket.open())
    const clientId = sentClientId(socket)
    expect(sentMessages(socket)).toContainEqual({
      type: 'join-room',
      clientId,
      roomCode: '7G8KZ',
    })

    act(() => socket.receive({
      type: 'room-state',
      room: {
        ...hostLobby(clientId),
        members: [
          hostLobby(clientId).members[0],
          { id: 'opponent-id', name: 'Opponent', role: 'opponent', connected: true, ready: false },
        ],
      },
    }))

    const startButton = screen.getByRole('button', { name: 'Start duel' })
    expect(startButton).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'I’m ready' }))
    expect(sentMessages(socket)).toContainEqual({ type: 'set-ready', ready: true })

    act(() => socket.receive({
      type: 'room-state',
      room: {
        ...hostLobby(clientId),
        members: [
          { ...hostLobby(clientId).members[0], ready: true },
          { id: 'opponent-id', name: 'Opponent', role: 'opponent', connected: true, ready: true },
        ],
      },
    }))

    expect(screen.getByText('Both players are ready.')).toBeInTheDocument()
    expect(startButton).toBeEnabled()
    await user.click(startButton)
    expect(sentMessages(socket)).toContainEqual({ type: 'start-game' })
  })

  it('shows opponent projections without Host controls', () => {
    const socket = renderApp('/room/7G8KZ')
    act(() => socket.open())
    const clientId = sentClientId(socket)
    act(() => socket.receive({
      type: 'room-state',
      room: {
        code: '7G8KZ',
        members: [
          { id: 'host-id', name: 'host', role: 'host', connected: true, ready: true },
          { id: clientId, name: 'Opponent', role: 'opponent', connected: true, ready: false },
        ],
      },
    }))

    expect(screen.queryByRole('button', { name: 'Start duel' })).not.toBeInTheDocument()
    expect(screen.getByText('The host starts the duel.')).toBeInTheDocument()
    expect(screen.getByText('Ready when you are.')).toBeInTheDocument()
  })

  it('returns home with a terminal notice when the Lobby closes', async () => {
    const socket = renderApp('/room/7G8KZ')
    act(() => socket.open())
    const clientId = sentClientId(socket)
    act(() => socket.receive({ type: 'room-state', room: hostLobby(clientId) }))
    act(() => socket.receive({
      type: 'room-closed',
      message: 'The other player left. The lobby has been closed.',
    }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Lobby closed. The other player left. The lobby has been closed.',
      )
    })
    expect(screen.getByRole('heading', { name: 'Create or join a duel' })).toBeInTheDocument()
  })

  it('leaves a Lobby explicitly and returns home', async () => {
    const user = userEvent.setup()
    const socket = renderApp('/room/7G8KZ')
    act(() => socket.open())
    const clientId = sentClientId(socket)
    act(() => socket.receive({ type: 'room-state', room: hostLobby(clientId) }))

    await user.click(screen.getByRole('button', { name: 'Leave lobby' }))

    expect(sentMessages(socket)).toContainEqual({ type: 'leave-room' })
    expect(screen.getByRole('heading', { name: 'Create or join a duel' })).toBeInTheDocument()
  })

  it('presents a disconnected transport state', () => {
    const socket = renderApp()
    act(() => socket.open())
    act(() => socket.close())

    expect(screen.getByText('Server disconnected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create lobby/i })).toBeDisabled()
  })
})
