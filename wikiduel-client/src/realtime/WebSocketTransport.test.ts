import { describe, expect, it } from 'vitest'

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
    const transport = new WebSocketTransport('ws://example.test/ws', () => {
      const socket = new ControllableWebSocket()
      sockets.push(socket)
      return socket
    })
    const statuses: string[] = []
    transport.subscribeStatus((status) => statuses.push(status))

    transport.connect()
    transport.connect()
    sockets[0]?.open()

    expect(sockets).toHaveLength(1)
    expect(statuses).toEqual(['disconnected', 'connecting', 'connected'])
  })

  it('closes the shared connection and reports that it disconnected', () => {
    const socket = new ControllableWebSocket()
    const transport = new WebSocketTransport('ws://example.test/ws', () => socket)
    const statuses: string[] = []
    transport.subscribeStatus((status) => statuses.push(status))
    transport.connect()
    socket.open()

    transport.close()

    expect(socket.readyState).toBe(WebSocket.CLOSED)
    expect(statuses.at(-1)).toBe('disconnected')
  })

  it('sends typed JSON messages only while the connection is open', () => {
    const socket = new ControllableWebSocket()
    const transport = new WebSocketTransport<{ type: 'ping' }>(
      'ws://example.test/ws',
      () => socket,
    )

    expect(transport.send({ type: 'ping' })).toBe(false)
    transport.connect()
    socket.open()

    expect(transport.send({ type: 'ping' })).toBe(true)
    expect(socket.sentMessages).toEqual(['{"type":"ping"}'])
  })

  it('decodes and dispatches a server message to multiple relevant subscribers', () => {
    type ServerMessage =
      | { type: 'pong'; message: string }
      | { type: 'room-state'; code: string }
    const socket = new ControllableWebSocket()
    const transport = new WebSocketTransport<object, ServerMessage>(
      'ws://example.test/ws',
      () => socket,
    )
    const firstSubscriber: string[] = []
    const secondSubscriber: string[] = []
    transport.subscribe('pong', (message) => firstSubscriber.push(message.message))
    transport.subscribe('pong', (message) => secondSubscriber.push(message.message))
    transport.connect()

    socket.receive({ type: 'pong', message: 'Pong from server' })
    socket.receive({ type: 'room-state', code: '7G8KZ' })

    expect(firstSubscriber).toEqual(['Pong from server'])
    expect(secondSubscriber).toEqual(['Pong from server'])
  })

  it('reports unreadable messages without interrupting later delivery', () => {
    type ServerMessage = { type: 'pong'; message: string }
    const socket = new ControllableWebSocket()
    const transport = new WebSocketTransport<object, ServerMessage>(
      'ws://example.test/ws',
      () => socket,
    )
    const failures: string[] = []
    const received: string[] = []
    transport.subscribeFailure((failure) => failures.push(failure))
    transport.subscribe('pong', (message) => received.push(message.message))
    transport.connect()

    socket.receiveRaw('not-json')
    socket.receive({ type: 'pong', message: 'Still connected' })

    expect(failures).toEqual(['unreadable-message'])
    expect(received).toEqual(['Still connected'])
  })

  it('reports a stable disconnected outcome when the connection fails', () => {
    const socket = new ControllableWebSocket()
    const transport = new WebSocketTransport('ws://example.test/ws', () => socket)
    const failures: string[] = []
    const statuses: string[] = []
    transport.subscribeFailure((failure) => failures.push(failure))
    transport.subscribeStatus((status) => statuses.push(status))
    transport.connect()

    socket.fail()

    expect(failures).toEqual(['connection-error'])
    expect(statuses.at(-1)).toBe('disconnected')
  })

  it('reports the same stable outcome when opening the connection fails', () => {
    const transport = new WebSocketTransport('not-a-websocket-url', () => {
      throw new Error('Invalid WebSocket URL')
    })
    const failures: string[] = []
    const statuses: string[] = []
    transport.subscribeFailure((failure) => failures.push(failure))
    transport.subscribeStatus((status) => statuses.push(status))

    expect(() => transport.connect()).not.toThrow()
    expect(failures).toEqual(['connection-error'])
    expect(statuses.at(-1)).toBe('disconnected')
  })

  it('stops delivery after a subscriber cleans up', () => {
    type ServerMessage = { type: 'pong'; message: string }
    const socket = new ControllableWebSocket()
    const transport = new WebSocketTransport<object, ServerMessage>(
      'ws://example.test/ws',
      () => socket,
    )
    const received: string[] = []
    const unsubscribe = transport.subscribe('pong', (message) => received.push(message.message))
    transport.connect()

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
    const transport = new WebSocketTransport<object, ServerMessage>(
      'ws://example.test/ws',
      () => connectionCount++ === 0 ? closedSocket : activeSocket,
    )
    const received: string[] = []
    transport.subscribe('pong', (message) => received.push(message.message))
    transport.connect()
    transport.close()
    transport.connect()

    closedSocket.receive({ type: 'pong', message: 'Stale delivery' })
    activeSocket.receive({ type: 'pong', message: 'Current delivery' })

    expect(received).toEqual(['Current delivery'])
  })
})
