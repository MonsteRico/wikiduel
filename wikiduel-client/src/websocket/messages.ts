import type { Lobby } from '../features/lobby/types'

export type ClientMessage =
  | { type: 'ping' }
  | { type: 'create-lobby'; clientId: string }
  | { type: 'join-lobby'; clientId: string; lobbyCode: string }
  | { type: 'set-ready'; ready: boolean }
  | { type: 'start-game' }
  | { type: 'leave-lobby' }

export type ServerMessage =
  | { type: 'welcome'; message: string; sentAt: string }
  | { type: 'pong'; message: string; sentAt: string }
  | { type: 'lobby-state'; lobby: Lobby; sentAt: string }
  | { type: 'lobby-error'; message: string; sentAt: string }
  | { type: 'lobby-closed'; message: string; sentAt: string }
  | { type: 'game-started'; sentAt: string }
