// Keep tests here focused on whole-application loading and composition: root providers,
// routing, and wiring between application-level pieces. Feature behavior belongs with its feature.
import { act, cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'
import { ControllableWebSocket, sockets } from './test/ControllableWebSocket'

beforeEach(() => {
  sockets.length = 0
  vi.stubGlobal('WebSocket', ControllableWebSocket)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('App wiring', () => {
  it('loads the root route with the shared WebSocket connected to application state', () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Create or join a duel' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Server connecting')
    expect(sockets).toHaveLength(1)

    act(() => sockets[0]?.open())

    expect(screen.getByRole('status')).toHaveTextContent('Server connected')
  })
})
