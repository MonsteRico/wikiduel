import type { Room } from '../features/rooms/types'

export type ClientMessage =
  | { type: 'ping' }
  | { type: 'create-room'; clientId: string }
  | { type: 'join-room'; clientId: string; roomCode: string }
  | { type: 'set-ready'; ready: boolean }
  | { type: 'start-game' }
  | { type: 'leave-room' }

export type ServerMessage =
  | { type: 'welcome'; message: string; sentAt: string }
  | { type: 'pong'; message: string; sentAt: string }
  | { type: 'room-state'; room: Room; sentAt: string }
  | { type: 'room-error'; message: string; sentAt: string }
  | { type: 'room-closed'; message: string; sentAt: string }
  | { type: 'game-started'; sentAt: string }
