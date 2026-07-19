import { describe, expect, it } from 'vitest'
import { decodeServerMessage, type ClientMessage, type ServerMessage } from '@wikiduel/contracts'

import { WebSocketTransport, type WebSocketConnection } from './WebSocketTransport'

class ControllableWebSocket extends EventTarget implements WebSocketConnection {
  readonly sentMessages: string[] = []
  readyState: WebSocket['readyState'] = WebSocket.CONNECTING

  send(message: string) {
    this.sentMessages.push(message)
  }

  open() {
    this.readyState = WebSocket.OPEN
    this.dispatchEvent(new Event('open'))
  }

  close() {
    this.readyState = WebSocket.CLOSED
    this.dispatchEvent(new Event('close'))
  }

  receive(message: unknown) {
    this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(message) }))
  }

  receiveRaw(message: string) {
    this.dispatchEvent(new MessageEvent('message', { data: message }))
  }

  fail() {
    this.dispatchEvent(new Event('error'))
  }
}

describe('WebSocketTransport', () => {
  it('opens one shared connection and reports when it connects', () => {
    const sockets: ControllableWebSocket[] = []
    const webSocket = new WebSocketTransport('ws://example.test/ws', () => {
      const socket = new ControllableWebSocket()
      sockets.push(socket)
      return socket
    })
    const statuses: string[] = []
    webSocket.subscribeStatus((status) => statuses.push(status))

    webSocket.connect()
    webSocket.connect()
    sockets[0]?.open()

    expect(sockets).toHaveLength(1)
    expect(statuses).toEqual(['disconnected', 'connecting', 'connected'])
  })

  it('closes the shared connection and reports that it disconnected', () => {
    const socket = new ControllableWebSocket()
    const webSocket = new WebSocketTransport('ws://example.test/ws', () => socket)
    const statuses: string[] = []
    webSocket.subscribeStatus((status) => statuses.push(status))
    webSocket.connect()
    socket.open()

    webSocket.close()

    expect(socket.readyState).toBe(WebSocket.CLOSED)
    expect(statuses.at(-1)).toBe('disconnected')
  })

  it('sends typed JSON messages only while the connection is open', () => {
    const socket = new ControllableWebSocket()
    const webSocket = new WebSocketTransport<{ type: 'ping' }>(
      'ws://example.test/ws',
      () => socket,
    )

    expect(webSocket.send({ type: 'ping' })).toBe(false)
    webSocket.connect()
    socket.open()

    expect(webSocket.send({ type: 'ping' })).toBe(true)
    expect(socket.sentMessages).toEqual(['{"type":"ping"}'])
  })

  it('decodes and dispatches a server message to multiple relevant subscribers', () => {
    type ServerMessage =
      | { type: 'pong'; message: string }
      | { type: 'lobby-state'; code: string }
    const socket = new ControllableWebSocket()
    const webSocket = new WebSocketTransport<object, ServerMessage>(
      'ws://example.test/ws',
      () => socket,
    )
    const firstSubscriber: string[] = []
    const secondSubscriber: string[] = []
    webSocket.subscribe('pong', (message) => firstSubscriber.push(message.message))
    webSocket.subscribe('pong', (message) => secondSubscriber.push(message.message))
    webSocket.connect()

    socket.receive({ type: 'pong', message: 'Pong from server' })
    socket.receive({ type: 'lobby-state', code: '7G8KZ' })

    expect(firstSubscriber).toEqual(['Pong from server'])
    expect(secondSubscriber).toEqual(['Pong from server'])
  })

  it('reports unreadable messages without interrupting later delivery', () => {
    type ServerMessage = { type: 'pong'; message: string }
    const socket = new ControllableWebSocket()
    const webSocket = new WebSocketTransport<object, ServerMessage>(
      'ws://example.test/ws',
      () => socket,
    )
    const failures: string[] = []
    const received: string[] = []
    webSocket.subscribeFailure((failure) => failures.push(failure))
    webSocket.subscribe('pong', (message) => received.push(message.message))
    webSocket.connect()

    socket.receiveRaw('not-json')
    socket.receive({ type: 'pong', message: 'Still connected' })

    expect(failures).toEqual(['unreadable-message'])
    expect(received).toEqual(['Still connected'])
  })

  it('rejects malformed server messages before dispatching later valid messages', () => {
    const socket = new ControllableWebSocket()
    const webSocket = new WebSocketTransport<ClientMessage, ServerMessage>(
      'ws://example.test/ws',
      () => socket,
      decodeServerMessage,
    )
    const failures: string[] = []
    const received: string[] = []
    webSocket.subscribeFailure((failure) => failures.push(failure))
    webSocket.subscribe('pong', (message) => received.push(message.message))
    webSocket.connect()

    socket.receive({
      type: 'pong',
      message: 'Unchecked',
      sentAt: '2026-07-13T12:00:00Z',
      unexpected: true,
    })
    socket.receive({
      type: 'pong',
      message: 'Validated',
      sentAt: '2026-07-13T12:00:01Z',
    })

    expect(failures).toEqual(['unreadable-message'])
    expect(received).toEqual(['Validated'])
  })

  it('reports a stable disconnected outcome when the connection fails', () => {
    const socket = new ControllableWebSocket()
    const webSocket = new WebSocketTransport('ws://example.test/ws', () => socket)
    const failures: string[] = []
    const statuses: string[] = []
    webSocket.subscribeFailure((failure) => failures.push(failure))
    webSocket.subscribeStatus((status) => statuses.push(status))
    webSocket.connect()

    socket.fail()

    expect(failures).toEqual(['connection-error'])
    expect(statuses.at(-1)).toBe('disconnected')
  })

  it('reports the same stable outcome when opening the connection fails', () => {
    const webSocket = new WebSocketTransport('not-a-websocket-url', () => {
      throw new Error('Invalid WebSocket URL')
    })
    const failures: string[] = []
    const statuses: string[] = []
    webSocket.subscribeFailure((failure) => failures.push(failure))
    webSocket.subscribeStatus((status) => statuses.push(status))

    expect(() => webSocket.connect()).not.toThrow()
    expect(failures).toEqual(['connection-error'])
    expect(statuses.at(-1)).toBe('disconnected')
  })

  it('stops delivery after a subscriber cleans up', () => {
    type ServerMessage = { type: 'pong'; message: string }
    const socket = new ControllableWebSocket()
    const webSocket = new WebSocketTransport<object, ServerMessage>(
      'ws://example.test/ws',
      () => socket,
    )
    const received: string[] = []
    const unsubscribe = webSocket.subscribe('pong', (message) => received.push(message.message))
    webSocket.connect()

    socket.receive({ type: 'pong', message: 'Before cleanup' })
    unsubscribe()
    socket.receive({ type: 'pong', message: 'After cleanup' })

    expect(received).toEqual(['Before cleanup'])
  })

  it('does not dispatch events from a closed connection after reconnecting', () => {
    type ServerMessage = { type: 'pong'; message: string }
    const closedSocket = new ControllableWebSocket()
    const activeSocket = new ControllableWebSocket()
    let connectionCount = 0
    const webSocket = new WebSocketTransport<object, ServerMessage>(
      'ws://example.test/ws',
      () => connectionCount++ === 0 ? closedSocket : activeSocket,
    )
    const received: string[] = []
    webSocket.subscribe('pong', (message) => received.push(message.message))
    webSocket.connect()
    webSocket.close()
    webSocket.connect()

    closedSocket.receive({ type: 'pong', message: 'Stale delivery' })
    activeSocket.receive({ type: 'pong', message: 'Current delivery' })

    expect(received).toEqual(['Current delivery'])
  })
})
