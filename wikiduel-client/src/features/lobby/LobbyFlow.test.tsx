import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from '../../App'
import { ControllableWebSocket, sockets } from '../../test/ControllableWebSocket'
import type { Lobby } from './types'
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
  if (!socket) throw new Error('Expected the WebSocket provider to open a connection')
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
  it('presents connection state and creates a Lobby through the WebSocket', async () => {
    const user = userEvent.setup()
    const socket = renderApp()
    const createButton = screen.getByRole('button', { name: /create lobby/i })

    expect(screen.getByRole('status')).toHaveTextContent('Server connecting')
    expect(createButton).toBeDisabled()

    act(() => socket.open())
    expect(screen.getByRole('status')).toHaveTextContent('Server connected')

    await user.click(createButton)
    const clientId = sentClientId(socket)
    expect(sentMessages(socket)).toContainEqual({ type: 'create-lobby', clientId })

    act(() => socket.receive({ type: 'lobby-state', lobby: hostLobby(clientId) }))
    expect(await screen.findByRole('heading', { name: 'Waiting for the duel' })).toBeInTheDocument()
    expect(screen.getByText('1 / 2 joined')).toBeInTheDocument()
    expect(screen.getByText('You')).toBeInTheDocument()
    expect(sockets).toHaveLength(1)
  })

  it('joins a Lobby and presents rejected join notices', async () => {
    const user = userEvent.setup()
    const socket = renderApp()
    act(() => socket.open())

    await user.type(screen.getByLabelText('Lobby code'), '7g8kz')
    await user.click(screen.getByRole('button', { name: /join lobby/i }))
    const clientId = sentClientId(socket)
    expect(sentMessages(socket)).toContainEqual({
      type: 'join-lobby',
      clientId,
      lobbyCode: '7G8KZ',
    })

    act(() => socket.receive({ type: 'lobby-error', message: 'Lobby not found' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Lobby not found')
    expect(screen.getByRole('button', { name: /join lobby/i })).toBeEnabled()
  })

  it('projects readiness and exposes start control only to a ready Host', async () => {
    const user = userEvent.setup()
    const socket = renderApp('/lobby/7G8KZ')
    act(() => socket.open())
    const clientId = sentClientId(socket)
    expect(sentMessages(socket)).toContainEqual({
      type: 'join-lobby',
      clientId,
      lobbyCode: '7G8KZ',
    })

    act(() => socket.receive({
      type: 'lobby-state',
      lobby: {
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
      type: 'lobby-state',
      lobby: {
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
    const socket = renderApp('/lobby/7G8KZ')
    act(() => socket.open())
    const clientId = sentClientId(socket)
    act(() => socket.receive({
      type: 'lobby-state',
      lobby: {
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
    const socket = renderApp('/lobby/7G8KZ')
    act(() => socket.open())
    const clientId = sentClientId(socket)
    act(() => socket.receive({ type: 'lobby-state', lobby: hostLobby(clientId) }))
    act(() => socket.receive({
      type: 'lobby-closed',
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
    const socket = renderApp('/lobby/7G8KZ')
    act(() => socket.open())
    const clientId = sentClientId(socket)
    act(() => socket.receive({ type: 'lobby-state', lobby: hostLobby(clientId) }))

    await user.click(screen.getByRole('button', { name: 'Leave lobby' }))

    expect(sentMessages(socket)).toContainEqual({ type: 'leave-lobby' })
    expect(screen.getByRole('heading', { name: 'Create or join a duel' })).toBeInTheDocument()
  })

  it('presents a disconnected WebSocket state', () => {
    const socket = renderApp()
    act(() => socket.open())
    act(() => socket.close())

    expect(screen.getByText('Server disconnected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create lobby/i })).toBeDisabled()
  })
})
