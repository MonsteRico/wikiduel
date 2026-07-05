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
