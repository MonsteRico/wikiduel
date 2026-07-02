export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

export type RoomMember = {
  id: string
  name: string
  role: 'host' | 'opponent'
  connected: boolean
  ready: boolean
}

export type Room = {
  code: string
  members: RoomMember[]
}

export type ServerMessage =
  | { type: 'welcome' | 'pong'; message: string; sentAt: string }
  | { type: 'room-state'; room: Room; sentAt: string }
  | { type: 'room-error' | 'room-closed'; message: string; sentAt: string }
  | { type: 'game-started'; sentAt: string }
