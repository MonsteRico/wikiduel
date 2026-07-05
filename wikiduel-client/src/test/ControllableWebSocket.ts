import type { ServerMessage } from '../websocket/messages'

type WithoutTimestamp<Message> = Message extends unknown ? Omit<Message, 'sentAt'> : never

export class ControllableWebSocket extends EventTarget {
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

export const sockets: ControllableWebSocket[] = []
