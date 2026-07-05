import { Navigate, Route, Routes } from 'react-router'

import { RoomProvider } from './features/rooms/RoomProvider'
import { HomePage } from './pages/HomePage'
import { RoomPage } from './pages/RoomPage'
import { TransportProvider } from './realtime/TransportProvider'

function App() {
  return (
    <TransportProvider>
      <RoomProvider>
        <Routes>
          <Route index element={<HomePage />} />
          <Route path="room/:roomCode" element={<RoomPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </RoomProvider>
    </TransportProvider>
  )
}

export default App
