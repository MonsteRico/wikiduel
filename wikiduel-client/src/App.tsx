import { Navigate, Route, Routes } from 'react-router'

import './App.css'
import { RoomProvider } from './features/rooms/RoomProvider'
import { HomePage } from './pages/HomePage'
import { RoomPage } from './pages/RoomPage'

function App() {
  return (
    <RoomProvider>
      <Routes>
        <Route index element={<HomePage />} />
        <Route path="room/:roomCode" element={<RoomPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </RoomProvider>
  )
}

export default App
