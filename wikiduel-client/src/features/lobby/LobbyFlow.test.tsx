import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createBrowserRouter, createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from '../../App'
import { ControllableWebSocket, sockets } from '../../test/ControllableWebSocket'
import type { Lobby, DuelProjection, PreparingDuelProjection, PlayableArticle } from '@wikiduel/contracts'

const roundArticle: PlayableArticle = {
  identity: { pageId: 1001, title: 'Fixture Start One' },
  revision: { id: 1, timestamp: '2026-10-01T00:00:00Z' },
  attribution: {
    sourceUrl: 'https://en.wikipedia.org/wiki/Fixture_Start_One',
    historyUrl: 'https://en.wikipedia.org/w/index.php?title=Fixture_Start_One&action=history',
    licenseName: 'Creative Commons Attribution-ShareAlike 4.0 International',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    modificationNotice: 'Adapted for Wiki Duel',
  },
  document: { title: 'Fixture Start One', tableOfContents: [], blocks: [{
    type: 'paragraph', children: [
      { type: 'text', value: 'Secret article content. ' },
      { type: 'navigation', destination: { pageId: 1002, title: 'Fixture Target One' },
        children: [{ type: 'text', value: 'Follow this link' }] },
    ],
  }] },
}

function preparedDuel(clientId: string): PreparingDuelProjection {
  return {
    id: 'duel-1', phase: 'preparing', serverNow: 100_000,
    round: { id: 'round-1', number: 1, article: roundArticle, prompt: {
      id: 'prompt-1', start: roundArticle.identity, target: { pageId: 1002, title: 'Fixture Target One' },
    } },
    self: { id: clientId, name: 'Host', role: 'host', hp: 100, path: [roundArticle.identity], clicks: 0 },
    opponent: { id: 'opponent', name: 'Opponent', role: 'opponent', hp: 100, clicks: 0, connected: true },
  }
}
function hostLobby(clientId: string): Lobby {
  return {
    code: '7G8KZ',
    members: [{ id: clientId, name: 'host', role: 'host', connected: true, ready: false }],
  }
}

function departureDuel(clientId: string, phase: DuelProjection['phase']): DuelProjection {
  const prepared = preparedDuel(clientId)
  if (phase === 'preparing') return prepared
  const started = { ...prepared, startsAt: phase === 'countdown' ? 103_000 : 99_000,
    round: { ...prepared.round, article: roundArticle } }
  if (phase === 'active' || phase === 'countdown') return { ...started, phase }
  if (phase === 'post-duel') return { ...started, phase, rematchPlayerIds: [], summary: {
    winnerId: clientId, endReason: 'hp-depleted',
    players: [{ id: clientId, name: 'Host', role: 'host', hp: 100 },
      { id: 'opponent', name: 'Opponent', role: 'opponent', hp: 0 }],
    rounds: [{ roundId: 'round-1', roundNumber: 1, winnerId: clientId, damage: 22 }],
  } }
  return { ...started, phase, readyPlayerIds: [], outcome: {
    roundId: 'round-1', roundNumber: 1, endReason: 'target-arrival', winnerId: clientId,
    startsAt: 99_000, endedAt: 100_000, final: phase === 'completed',
    players: [
      { id: clientId, path: [roundArticle.identity, prepared.round.prompt.target], clicks: 1, activeElapsedMs: 1000, hp: 100 },
      { id: 'opponent', path: [roundArticle.identity], clicks: 0, activeElapsedMs: 1000, hp: phase === 'completed' ? 0 : 78 },
    ],
    damage: { winnerClicks: 1, loserClicks: 0, baseDamage: 25, clickDifferential: -1,
      clickMultiplier: 3, multiplierContribution: -3, unclampedDamage: 22,
      minimumDamage: 15, maximumDamage: 60, finalDamage: 22 },
  } }
}

let router: ReturnType<typeof createMemoryRouter>
function renderApp(initialPath = '/') {
  router = createMemoryRouter([{ path: '*', element: <App /> }], { initialEntries: ['/', initialPath] })
  render(<RouterProvider router={router} />)

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
  // jsdom has no native modal dialog methods. Model visibility at the browser boundary.
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
})

afterEach(() => {
  cleanup()
  router?.dispose()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Lobby client', () => {
  it('intercepts browser history Back and restores the current URL when cancelled', async () => {
    window.history.replaceState(null, '', '/')
    router = createBrowserRouter([{ path: '*', element: <App /> }])
    render(<RouterProvider router={router} />)
    const socket = sockets.at(-1)!
    act(() => socket.open())
    await act(async () => { await router.navigate('/lobby/7G8KZ') })
    const duel = preparedDuel(sentClientId(socket))
    act(() => socket.receive({ type: 'duel-state', duel }))
    act(() => window.history.back())
    expect(await screen.findByRole('dialog', { name: 'Leave Duel?' })).toBeVisible()
    await waitFor(() => expect(window.location.pathname).toBe('/duel/duel-1'))
    act(() => screen.getByRole('button', { name: 'Keep playing' }).click())
    expect(router.state.location.pathname).toBe('/duel/duel-1')
    expect(sentMessages(socket).filter((message) => message.type === 'leave-duel')).toHaveLength(0)
    act(() => window.history.back())
    expect(await screen.findByRole('dialog', { name: 'Leave Duel?' })).toBeVisible()
    await waitFor(() => expect(window.location.pathname).toBe('/duel/duel-1'))
    act(() => screen.getByRole('button', { name: 'Confirm Leave Duel' }).click())
    act(() => socket.receive({ type: 'duel-forfeited', duelId: duel.id, winnerId: 'opponent',
      reason: 'player-left', message: 'You left the Duel.' }))
    expect(window.location.pathname).toBe('/')
  })

  it('accepts a Rematch that wins the race against an old departure command', () => {
    const socket = renderApp('/lobby/7G8KZ')
    act(() => socket.open())
    const clientId = sentClientId(socket)
    act(() => socket.receive({ type: 'duel-state', duel: departureDuel(clientId, 'post-duel') }))
    act(() => screen.getByRole('button', { name: 'Rematch' }).click())
    act(() => screen.getByRole('button', { name: 'Leave Duel' }).click())
    act(() => screen.getByRole('button', { name: 'Confirm Leave Duel' }).click())
    act(() => socket.receive({ type: 'duel-state', duel: { ...preparedDuel(clientId), id: 'duel-2' } }))
    act(() => socket.receive({ type: 'command-rejected', command: 'leave-duel', reason: 'invalid-state' }))
    expect(router.state.location.pathname).toBe('/duel/duel-2')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Preparing the duel' })).toBeVisible()
  })
  it.each(['preparing', 'countdown', 'active', 'post-round', 'completed', 'post-duel'] as const)(
    'cancels without commands or changed content, then confirms departure during %s', (phase) => {
      const socket = renderApp('/lobby/7G8KZ')
      act(() => socket.open())
      const duel = departureDuel(sentClientId(socket), phase)
      act(() => socket.receive({ type: 'duel-state', duel }))
      const before = [...socket.sentMessages]
      const heading = screen.getAllByRole('heading')[0]!.textContent
      act(() => screen.getByRole('button', { name: 'Leave Duel' }).click())
      act(() => screen.getByRole('button', { name: 'Keep playing' }).click())
      expect(socket.sentMessages).toEqual(before)
      expect(screen.getAllByRole('heading')[0]!.textContent).toBe(heading)
      expect(router.state.location.pathname).toBe('/duel/duel-1')
      const unload = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(unload)
      expect(unload.defaultPrevented).toBe(true)
      expect(socket.sentMessages).toEqual(before)
      act(() => screen.getByRole('button', { name: 'Leave Duel' }).click())
      const confirm = screen.getByRole('button', { name: 'Confirm Leave Duel' })
      act(() => { confirm.click(); confirm.click() })
      expect(sentMessages(socket).filter((message) => message.type === 'leave-duel')).toEqual([
        { type: 'leave-duel', duelId: duel.id },
      ])
      for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled()
      if (phase === 'completed' || phase === 'post-duel') {
        act(() => socket.receive({ type: 'lobby-closed', message: 'The completed Duel\'s Lobby has closed.' }))
      } else {
        act(() => socket.receive({ type: 'duel-forfeited', duelId: duel.id, winnerId: 'opponent',
          reason: 'player-left', message: 'You left the Duel.' }))
      }
      expect(screen.getByRole('heading', { name: 'Create or join a duel' })).toBeVisible()
      expect(screen.queryByLabelText('Post-Duel')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Post-Round')).not.toBeInTheDocument()
      const after = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(after)
      expect(after.defaultPrevented).toBe(false)
    },
  )

  it('discards an old confirmation when a Rematch starts and ignores old terminal events', () => {
    const socket = renderApp('/lobby/7G8KZ')
    act(() => socket.open())
    const clientId = sentClientId(socket)
    act(() => socket.receive({ type: 'duel-state', duel: departureDuel(clientId, 'post-duel') }))
    act(() => screen.getByRole('button', { name: 'Leave Duel' }).click())
    const staleConfirm = screen.getByRole('button', { name: 'Confirm Leave Duel' })
    const rematch = { ...preparedDuel(clientId), id: 'duel-2', round: { ...preparedDuel(clientId).round, id: 'round-2' } }
    act(() => socket.receive({ type: 'duel-state', duel: rematch }))
    act(() => staleConfirm.click())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(sentMessages(socket).filter((message) => message.type === 'leave-duel')).toHaveLength(0)
    act(() => socket.receive({ type: 'duel-forfeited', duelId: 'duel-1', winnerId: clientId,
      reason: 'player-left', message: 'Old departure' }))
    expect(router.state.location.pathname).toBe('/duel/duel-2')
    expect(screen.getByRole('heading', { name: 'Preparing the duel' })).toBeVisible()
  })

  it('keeps one Opponent left notice after duplicate terminal events and a late projection', () => {
    const socket = renderApp('/lobby/7G8KZ')
    act(() => socket.open())
    const clientId = sentClientId(socket)
    const duel = preparedDuel(clientId)
    act(() => socket.receive({ type: 'duel-state', duel }))
    act(() => screen.getByRole('button', { name: 'Leave Duel' }).click())
    const notice = { type: 'duel-forfeited' as const, duelId: duel.id, winnerId: clientId,
      reason: 'player-left' as const, message: 'Your opponent left. The Duel ended by Forfeit.' }
    act(() => { socket.receive(notice); socket.receive(notice); socket.receive({ type: 'duel-state', duel }) })
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.getByRole('alert')).toHaveTextContent('Opponent left')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    act(() => screen.getByRole('button', { name: 'Dismiss message' }).click())
    expect(screen.getByRole('heading', { name: 'Create or join a duel' })).toBeVisible()
  })
  it.each([false, true])('clears a disconnected Duel and its confirmation, including departure pending: %s', (confirm) => {
    const socket = renderApp('/lobby/7G8KZ')
    act(() => socket.open())
    act(() => socket.receive({ type: 'duel-state', duel: preparedDuel(sentClientId(socket)) }))
    act(() => screen.getByRole('button', { name: 'Leave Duel' }).click())
    if (confirm) act(() => screen.getByRole('button', { name: 'Confirm Leave Duel' }).click())
    act(() => { socket.close(); socket.close() })
    expect(screen.getByRole('heading', { name: 'Create or join a duel' })).toBeVisible()
    expect(screen.getByRole('alert')).toHaveTextContent('Connection lost')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Post-Duel')).not.toBeInTheDocument()
  })
  it.each(['route', 'back'])('confirms a %s attempt, preserves the Duel on cancellation, and returns home on confirmation', async (attempt) => {
    const socket = renderApp('/lobby/7G8KZ')
    act(() => socket.open())
    const duel = preparedDuel(sentClientId(socket))
    act(() => socket.receive({ type: 'duel-state', duel }))
    const before = [...socket.sentMessages]
    const tryLeaving = async () => {
      await act(async () => {
        if (attempt === 'back') await router.navigate(-1)
        else await router.navigate('/other-route')
      })
    }
    await tryLeaving()
    expect(screen.getByRole('dialog', { name: 'Leave Duel?' })).toBeVisible()
    expect(router.state.location.pathname).toBe('/duel/duel-1')
    act(() => screen.getByRole('button', { name: 'Keep playing' }).click())
    expect(socket.sentMessages).toEqual(before)
    expect(screen.getByRole('heading', { name: 'Preparing the duel' })).toBeVisible()
    await tryLeaving()
    act(() => screen.getByRole('button', { name: 'Confirm Leave Duel' }).click())
    expect(sentMessages(socket).at(-1)).toEqual({ type: 'leave-duel', duelId: duel.id })
    act(() => socket.receive({ type: 'duel-forfeited', duelId: duel.id, winnerId: 'opponent',
      reason: 'player-left', message: 'You left the Duel.' }))
    expect(router.state.location.pathname).toBe('/')
  })
  it('sends departure once and blocks further commands while awaiting Forfeit', () => {
    const socket = renderApp('/lobby/7G8KZ')
    act(() => socket.open())
    const prepared = preparedDuel(sentClientId(socket))
    const duel = { ...prepared, phase: 'active' as const, startsAt: 99_000,
      round: { ...prepared.round, article: roundArticle } }
    act(() => socket.receive({ type: 'duel-state', duel }))
    act(() => screen.getByRole('button', { name: 'Leave Duel' }).click())
    const confirm = screen.getByRole('button', { name: 'Confirm Leave Duel' })
    act(() => { confirm.click(); confirm.click() })
    act(() => screen.getByRole('button', { name: 'Follow this link' }).click())
    expect(sentMessages(socket).filter((message) => message.type === 'leave-duel')).toHaveLength(1)
    expect(sentMessages(socket).filter((message) => message.type === 'navigate')).toHaveLength(0)
    act(() => socket.receive({ type: 'duel-forfeited', duelId: duel.id, winnerId: 'opponent',
      reason: 'player-left', message: 'You left the Duel.' }))
    expect(screen.getByRole('heading', { name: 'Create or join a duel' })).toBeVisible()
    expect(screen.queryByLabelText('Post-Duel')).not.toBeInTheDocument()
  })
  it.each(['rematch', 'back', 'opponent-back'])('handles Post-Duel intent and the authoritative %s transition', (choice) => {
    const socket = renderApp('/lobby/7G8KZ')
    act(() => socket.open())
    const clientId = sentClientId(socket)
    const lobby: Lobby = { ...hostLobby(clientId), members: [...hostLobby(clientId).members,
      { id: 'opponent', name: 'Opponent', role: 'opponent', connected: true, ready: false }] }
    act(() => socket.receive({ type: 'lobby-state', lobby }))
    const prepared = preparedDuel(clientId)
    const duel: Extract<DuelProjection, { phase: 'post-duel' }> = {
      ...prepared, phase: 'post-duel', startsAt: 99_000, rematchPlayerIds: [],
      round: { ...prepared.round, article: roundArticle },
      summary: { winnerId: clientId, endReason: 'hp-depleted',
        players: [{ id: clientId, name: 'Host', role: 'host', hp: 100 },
          { id: 'opponent', name: 'Opponent', role: 'opponent', hp: 0 }],
        rounds: [{ roundId: 'round-1', roundNumber: 1, winnerId: clientId, damage: 60 }],
      },
    }
    act(() => socket.receive({ type: 'duel-state', duel }))
    const rematch = screen.getByRole('button', { name: 'Rematch' })
    act(() => { rematch.click(); rematch.click() })
    expect(rematch).toBeDisabled()
    expect(sentMessages(socket).filter((message) => message.type === 'request-rematch')).toEqual([
      { type: 'request-rematch', duelId: 'duel-1', roundId: 'round-1' },
    ])
    expect(screen.getByLabelText('Post-Duel')).toBeVisible()
    act(() => socket.receive({ type: 'command-rejected', command: 'request-rematch', reason: 'invalid-state' }))
    expect(rematch).toBeEnabled()
    act(() => rematch.click())
    act(() => socket.receive({ type: 'duel-state', duel: { ...duel, rematchPlayerIds: [clientId] } }))
    expect(screen.getByRole('status')).toHaveTextContent('Waiting for Opponent')
    expect(rematch).toBeDisabled()
    if (choice === 'rematch') {
      act(() => socket.receive({ type: 'duel-state', duel: { ...prepared, id: 'duel-2', round: { ...prepared.round, id: 'round-2' } } }))
      expect(screen.getByRole('heading', { name: 'Preparing the duel' })).toBeVisible()
      expect(screen.getByLabelText('Your status')).toHaveTextContent('100 HP')
      expect(screen.queryByLabelText('Post-Duel')).not.toBeInTheDocument()
    } else {
      if (choice === 'back') {
        const back = screen.getByRole('button', { name: 'Back to Lobby' })
        act(() => { back.click(); back.click() })
        expect(sentMessages(socket).filter((message) => message.type === 'back-to-lobby')).toHaveLength(1)
        expect(screen.getByLabelText('Post-Duel')).toBeVisible()
      }
      act(() => socket.receive({ type: 'lobby-state', lobby }))
      expect(screen.getByRole('heading', { name: 'Waiting for the duel' })).toBeVisible()
      expect(screen.getByRole('button', { name: 'Start duel' })).toBeDisabled()
      expect(screen.queryByLabelText('Post-Duel')).not.toBeInTheDocument()
      expect(sentMessages(socket).filter((message) => message.type === 'join-lobby')).toHaveLength(1)
    }
  })
  it('locks Navigation until its result and displays only authoritative route and opponent status', () => {
    const socket = renderApp('/lobby/7G8KZ')
    act(() => socket.open())
    const prepared = preparedDuel(sentClientId(socket))
    const duel = { ...prepared, phase: 'active' as const, startsAt: 99_000,
      round: { ...prepared.round, article: roundArticle } }
    act(() => socket.receive({ type: 'duel-state', duel }))
    const link = screen.getByRole('button', { name: 'Follow this link' })
    act(() => { link.click(); link.click() })
    expect(link).toBeDisabled()
    const command = sentMessages(socket).at(-1)!
    expect(command).toMatchObject({ type: 'navigate', source: roundArticle.identity, expectedClicks: 0 })
    expect(sentMessages(socket).filter((message) => message.type === 'navigate')).toHaveLength(1)
    act(() => socket.receive({ type: 'duel-state', duel: { ...duel, opponent: { ...duel.opponent, clicks: 3 } } }))
    expect(link).toBeDisabled()
    expect(screen.getByLabelText('Opponent status')).toHaveTextContent('3 clicks')
    expect(screen.getByLabelText('Opponent status')).toHaveTextContent('Connected')
    act(() => socket.receive({ type: 'navigation-result', duelId: duel.id, roundId: duel.round.id,
      requestId: 'unrelated', accepted: false }))
    expect(link).toBeDisabled()
    act(() => socket.receive({ type: 'navigation-result', duelId: duel.id, roundId: duel.round.id,
      requestId: String(command.requestId), accepted: false }))
    expect(link).toBeEnabled()
    expect(screen.getByRole('alert')).toHaveTextContent('Navigation failed')
    const target = prepared.round.prompt.target
    act(() => link.click())
    act(() => socket.receive({ type: 'duel-state', duel: { ...duel,
      self: { ...duel.self, clicks: 1, path: [roundArticle.identity, target] },
      round: { ...duel.round, article: { ...roundArticle, identity: target } } } }))
    const path = screen.getByRole('list', { name: 'Your path' })
    expect(within(path).getAllByRole('listitem')).toHaveLength(2)
    expect(within(path).queryByRole('button')).not.toBeInTheDocument()
    expect(within(path).queryByRole('link')).not.toBeInTheDocument()
  })
  it.each(['post-round', 'completed'] as const)('stops active play when the server reports %s', (phase) => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] })
    const socket = renderApp('/lobby/7G8KZ')
    act(() => socket.open())
    const duel = preparedDuel(sentClientId(socket))
    act(() => socket.receive({ type: 'duel-state', duel: {
      ...duel, phase: 'active', startsAt: 99_000, round: { ...duel.round, article: roundArticle },
    } }))
    expect(screen.getByText(/Secret article content/)).toBeVisible()
    const ended: Extract<DuelProjection, { phase: 'post-round' | 'completed' }> = {
      ...duel, phase, startsAt: 99_000, readyPlayerIds: [], round: { ...duel.round, article: roundArticle },
      outcome: {
        roundId: 'round-1', roundNumber: 1, endReason: 'target-arrival', winnerId: duel.self.id,
        startsAt: 99_000, endedAt: 100_000, final: phase === 'completed',
        players: [
          { id: duel.self.id, path: [roundArticle.identity, duel.round.prompt.target], clicks: 1, activeElapsedMs: 1000, hp: 100 },
          { id: 'opponent', path: [roundArticle.identity], clicks: 0, activeElapsedMs: 1000, hp: phase === 'completed' ? 0 : 78 },
        ],
        damage: { winnerClicks: 1, loserClicks: 0, baseDamage: 25, clickDifferential: -1,
          clickMultiplier: 3, multiplierContribution: -3, unclampedDamage: 22,
          minimumDamage: 15, maximumDamage: 60, finalDamage: 22 },
      },
    }
    act(() => socket.receive({ type: 'duel-state', duel: ended }))
    act(() => vi.advanceTimersByTime(5000))
    expect(screen.queryByRole('button', { name: 'Follow this link' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Elapsed time')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Round ended' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Host won the Round' })).toBeVisible()
    const route = screen.getByRole('list', { name: 'Host frozen path' })
    expect(within(route).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Fixture Start One', 'Fixture Target One'])
    expect(within(route).queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Opponent Round Outcome')).toHaveTextContent(phase === 'completed' ? '0 HP' : '78 HP')
    expect(screen.getByLabelText('Host Round Outcome')).toHaveTextContent('1.000 s')
    expect(screen.getByLabelText('Damage Rule')).toHaveTextContent('Final damage22')
    const ready = screen.queryByRole('button', { name: 'Ready for Next Round' })
    if (phase === 'completed') {
      expect(ready).not.toBeInTheDocument()
      const proceed = screen.getByRole('button', { name: 'Continue to Post-Duel' })
      act(() => { proceed.click(); proceed.click() })
      expect(proceed).toBeDisabled()
      expect(sentMessages(socket).filter((message) => message.type === 'continue-post-duel')).toEqual([
        { type: 'continue-post-duel', duelId: 'duel-1', roundId: 'round-1' },
      ])
      expect(screen.queryByLabelText('Post-Duel')).not.toBeInTheDocument()
      act(() => socket.receive({ type: 'command-rejected', command: 'continue-post-duel', reason: 'invalid-state' }))
      expect(proceed).toBeEnabled()
      act(() => proceed.click())
      act(() => socket.receive({ type: 'duel-state', duel: {
        ...duel, phase: 'post-duel', rematchPlayerIds: [], startsAt: 99_000, round: { ...duel.round, article: roundArticle },
        summary: { winnerId: 'opponent', endReason: 'hp-depleted',
          players: [{ id: duel.self.id, name: 'Host', role: 'host', hp: 0 },
            { id: 'opponent', name: 'Opponent', role: 'opponent', hp: 56 }],
          rounds: [{ roundId: 'one', roundNumber: 1, winnerId: duel.self.id, damage: 44 },
            { roundId: 'two', roundNumber: 2, winnerId: 'opponent', damage: 60 }],
        },
      } }))
      expect(screen.getByRole('heading', { name: 'Opponent won the Duel' })).toBeVisible()
      expect(screen.getByLabelText('Post-Duel')).toHaveTextContent('HP reached zero')
      expect(screen.getByLabelText('Final HP')).toHaveTextContent('Host: 0 HP')
      expect(screen.getByLabelText('Final HP')).toHaveTextContent('Opponent: 56 HP')
      const rounds = within(screen.getByRole('list', { name: 'Damage by Round' })).getAllByRole('listitem')
      expect(rounds.map((item) => item.textContent)).toEqual(['Round 1: Host dealt 44 damage', 'Round 2: Opponent dealt 60 damage'])
      expect(screen.queryByLabelText('Post-Round')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Continue to Post-Duel' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Follow this link' })).not.toBeInTheDocument()
    }
    else {
      act(() => socket.receive({ type: 'duel-state', duel: { ...ended, readyPlayerIds: ['opponent'] } }))
      expect(screen.getByRole('status')).toHaveTextContent('Your opponent is ready.')
      expect(ready).toBeEnabled()
      act(() => screen.getByRole('link', { name: 'WikiDuel home' }).click())
      expect(screen.getByRole('dialog', { name: 'Leave Duel?' })).toBeVisible()
      act(() => screen.getByRole('button', { name: 'Keep playing' }).click())
      expect(sentMessages(socket).filter((message) => message.type === 'leave-duel')).toHaveLength(0)
      act(() => { ready!.click(); ready!.click() })
      expect(ready).toBeDisabled()
      expect(sentMessages(socket).filter((message) => message.type === 'ready-next-round')).toEqual([
        { type: 'ready-next-round', duelId: 'duel-1', roundId: 'round-1' },
      ])
      act(() => socket.receive({ type: 'duel-state', duel: { ...ended, readyPlayerIds: [duel.self.id] } }))
      expect(screen.getByRole('status')).toHaveTextContent('Your opponent is not ready yet.')
      expect(ready).toBeDisabled()
      act(() => socket.receive({ type: 'duel-state', duel: { ...duel, round: { ...duel.round, id: 'round-2', number: 2 } } }))
      expect(screen.getByRole('heading', { name: 'Prompt covered' })).toBeVisible()
      expect(sentMessages(socket)).toContainEqual({ type: 'round-rendered', duelId: 'duel-1', roundId: 'round-2' })
      act(() => screen.getByRole('button', { name: 'Leave Duel' }).click())
      act(() => screen.getByRole('button', { name: 'Confirm Leave Duel' }).click())
      expect(sentMessages(socket).at(-1)).toEqual({ type: 'leave-duel', duelId: 'duel-1' })
      act(() => socket.receive({ type: 'duel-forfeited', duelId: 'duel-1', winnerId: 'opponent',
        reason: 'player-left', message: 'You left the Duel.' }))
      expect(screen.getByRole('alert')).toHaveTextContent('You left the Duel.')
    }
  })

  it('acknowledges covered rendering once and uses server time for countdown and stopwatch', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] })
    const socket = renderApp('/lobby/7G8KZ')
    act(() => socket.open())
    const duel = preparedDuel(sentClientId(socket))
    act(() => socket.receive({ type: 'duel-state', duel }))
    expect(screen.getByText(/Secret article content/)).not.toBeVisible()
    expect(screen.queryByRole('button', { name: 'Follow this link' })).not.toBeInTheDocument()
    expect(sentMessages(socket).filter((message) => String(message.type).startsWith('round-'))).toEqual([
      { type: 'round-received', duelId: 'duel-1', roundId: 'round-1' },
      { type: 'round-rendered', duelId: 'duel-1', roundId: 'round-1' },
    ])
    act(() => socket.receive({ type: 'duel-state', duel }))
    expect(sentMessages(socket).filter((message) => message.type === 'round-rendered')).toHaveLength(1)
    act(() => socket.receive({ type: 'duel-state', duel: {
      ...duel, phase: 'countdown', startsAt: 103_000,
      round: { ...duel.round, article: roundArticle },
    } }))
    expect(screen.getByLabelText('Round countdown')).toHaveTextContent('3')
    expect(screen.getByText('Target: Fixture Target One')).toBeVisible()
    act(() => vi.advanceTimersByTime(2950))
    expect(screen.getByLabelText('Round countdown')).toHaveTextContent('1')
    expect(screen.getByText(/Secret article content/)).not.toBeVisible()
    act(() => vi.advanceTimersByTime(50))
    expect(screen.getByLabelText('Elapsed time')).toHaveTextContent('0:00')
    expect(screen.getByText(/Secret article content/)).toBeVisible()
    act(() => screen.getByRole('button', { name: 'Follow this link' }).click())
    expect(sentMessages(socket).at(-1)).toMatchObject({ type: 'navigate', roundId: 'round-1' })
    act(() => vi.advanceTimersByTime(65_000))
    expect(screen.getByLabelText('Elapsed time')).toHaveTextContent('1:05')
    act(() => socket.receive({ type: 'duel-interrupted', duelId: 'duel-1',
      reason: 'preparation-deadline', message: 'The Round could not prepare. No winner was assigned.' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Interruption. The Round could not prepare. No winner was assigned.')
    expect(screen.queryByLabelText('Elapsed time')).not.toBeInTheDocument()
  })

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
    expect(sentMessages(socket)).toContainEqual({ type: 'start-duel' })

    act(() => socket.receive({
      type: 'duel-state',
      duel: {
        id: 'duel-1',
        phase: 'preparing',
        serverNow: 100_000,
        round: {
          id: 'round-1',
          number: 1,
          prompt: {
            id: 'fixture-first',
            start: { pageId: 1001, title: 'Fixture Start One' },
            target: { pageId: 1002, title: 'Fixture Target One' },
          },
        },
        self: {
          id: clientId,
          name: 'host',
          role: 'host',
          hp: 100,
          path: [{ pageId: 1001, title: 'Fixture Start One' }],
          clicks: 0,
        },
        opponent: {
          clicks: 0, connected: true,
          id: 'opponent-id',
          name: 'Opponent',
          role: 'opponent',
          hp: 100,
        },
      },
    }))

    expect(await screen.findByRole('heading', { name: 'Preparing the duel' })).toBeInTheDocument()
    expect(screen.getByText('Round 1')).toBeInTheDocument()
    expect(screen.getAllByText('100 HP')).toHaveLength(2)
    expect(screen.getAllByText('0 clicks')).toHaveLength(2)
    expect(screen.queryByText('Fixture Start One')).not.toBeInTheDocument()
    expect(screen.queryByText('Fixture Target One')).not.toBeInTheDocument()

    act(() => socket.receive({
      type: 'duel-forfeited',
      duelId: 'duel-1',
      winnerId: clientId,
      reason: 'player-disconnected',
      message: 'Your opponent disconnected. The Duel ended by Forfeit.',
    }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Your opponent disconnected. The Duel ended by Forfeit.',
      )
    })
    expect(screen.getByRole('heading', { name: 'Create or join a duel' })).toBeInTheDocument()
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
