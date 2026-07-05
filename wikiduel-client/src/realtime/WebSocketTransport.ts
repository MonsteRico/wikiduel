export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'
export type TransportFailure = 'connection-error' | 'unreadable-message'

export type WebSocketConnection = Pick<
  WebSocket,
  'addEventListener' | 'close' | 'readyState' | 'removeEventListener' | 'send'
>

type WebSocketFactory = (url: string) => WebSocketConnection
type StatusListener = (status: ConnectionStatus) => void
type FailureListener = (failure: TransportFailure) => void
type MessageEnvelope = { type: string }
type MessageListener<Message> = (message: Message) => void

export class WebSocketTransport<
  OutboundMessage extends object = object,
  InboundMessage extends MessageEnvelope = MessageEnvelope,
> {
  private readonly createWebSocket: WebSocketFactory
  private readonly failureListeners = new Set<FailureListener>()
  private readonly messageListeners = new Map<string, Set<MessageListener<InboundMessage>>>()
  private readonly statusListeners = new Set<StatusListener>()
  private socket: WebSocketConnection | null = null
  private status: ConnectionStatus = 'disconnected'
  private readonly url: string

  constructor(
    url: string,
    createWebSocket: WebSocketFactory = (socketUrl) => new WebSocket(socketUrl),
  ) {
    this.url = url
    this.createWebSocket = createWebSocket
  }

  connect() {
    if (this.socket) return

    this.setStatus('connecting')
    const socket = this.createWebSocket(this.url)
    this.socket = socket
    socket.addEventListener('open', this.handleOpen)
    socket.addEventListener('close', this.handleClose)
    socket.addEventListener('error', this.handleError)
    socket.addEventListener('message', this.handleMessage)
  }

  close() {
    this.socket?.close()
  }

  send(message: OutboundMessage) {
    if (this.socket?.readyState !== WebSocket.OPEN) return false

    this.socket.send(JSON.stringify(message))
    return true
  }

  subscribeStatus(listener: StatusListener) {
    this.statusListeners.add(listener)
    listener(this.status)
    return () => {
      this.statusListeners.delete(listener)
    }
  }

  subscribeFailure(listener: FailureListener) {
    this.failureListeners.add(listener)
    return () => {
      this.failureListeners.delete(listener)
    }
  }

  subscribe<Type extends InboundMessage['type']>(
    type: Type,
    listener: MessageListener<Extract<InboundMessage, { type: Type }>>,
  ) {
    const listeners = this.messageListeners.get(type) ?? new Set()
    const receive: MessageListener<InboundMessage> = (message) => {
      listener(message as Extract<InboundMessage, { type: Type }>)
    }
    listeners.add(receive)
    this.messageListeners.set(type, listeners)

    return () => {
      listeners.delete(receive)
    }
  }

  private readonly handleOpen = () => {
    this.setStatus('connected')
  }

  private readonly handleClose = () => {
    this.socket = null
    this.setStatus('disconnected')
  }

  private readonly handleError = () => {
    this.setStatus('disconnected')
    this.reportFailure('connection-error')
  }

  private readonly handleMessage = (event: MessageEvent) => {
    try {
      const message = JSON.parse(String(event.data)) as unknown
      if (!this.isMessageEnvelope(message)) throw new Error('Unreadable message')
      const listeners = this.messageListeners.get(message.type)
      if (!listeners) return

      for (const listener of listeners) listener(message as InboundMessage)
    } catch {
      this.reportFailure('unreadable-message')
    }
  }

  private isMessageEnvelope(message: unknown): message is MessageEnvelope {
    return typeof message === 'object'
      && message !== null
      && 'type' in message
      && typeof message.type === 'string'
  }

  private reportFailure(failure: TransportFailure) {
    for (const listener of this.failureListeners) listener(failure)
  }

  private setStatus(status: ConnectionStatus) {
    this.status = status
    for (const listener of this.statusListeners) listener(status)
  }
}
