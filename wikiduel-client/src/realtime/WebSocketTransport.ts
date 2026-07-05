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
    let socket: WebSocketConnection
    try {
      socket = this.createWebSocket(this.url)
    } catch {
      this.setStatus('disconnected')
      this.reportFailure('connection-error')
      return
    }
    this.socket = socket
    socket.addEventListener('open', this.handleOpen)
    socket.addEventListener('close', this.handleClose)
    socket.addEventListener('error', this.handleError)
    socket.addEventListener('message', this.handleMessage)
  }

  close() {
    const socket = this.socket
    if (!socket) return

    this.detachSocket(socket)
    this.socket = null
    socket.close()
    this.setStatus('disconnected')
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
    if (this.socket) this.detachSocket(this.socket)
    this.socket = null
    this.setStatus('disconnected')
  }

  private readonly handleError = () => {
    this.reportFailure('connection-error')
    this.close()
  }

  private readonly handleMessage = (event: MessageEvent) => {
    let message: unknown

    try {
      message = JSON.parse(String(event.data)) as unknown
    } catch {
      this.reportFailure('unreadable-message')
      return
    }

    if (!this.isMessageEnvelope(message)) {
      this.reportFailure('unreadable-message')
      return
    }

    const listeners = this.messageListeners.get(message.type)
    if (!listeners) return

    for (const listener of listeners) listener(message as InboundMessage)
  }

  private detachSocket(socket: WebSocketConnection) {
    socket.removeEventListener('open', this.handleOpen)
    socket.removeEventListener('close', this.handleClose)
    socket.removeEventListener('error', this.handleError)
    socket.removeEventListener('message', this.handleMessage)
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
