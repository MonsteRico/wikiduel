export type LobbyMember = {
  id: string
  name: string
  role: 'host' | 'opponent'
  connected: boolean
  ready: boolean
}

export type Lobby = {
  code: string
  members: LobbyMember[]
}
