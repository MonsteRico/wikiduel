import { Navigate, Route, Routes } from 'react-router'

import { LobbyProvider } from './features/lobby/LobbyProvider'
import { HomePage } from './pages/HomePage'
import { LobbyPage } from './pages/LobbyPage'
import { WebSocketProvider } from './websocket/WebSocketProvider'

function App() {
  return (
    <WebSocketProvider>
      <LobbyProvider>
        <Routes>
          <Route index element={<HomePage />} />
          <Route path="lobby/:lobbyCode" element={<LobbyPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </LobbyProvider>
    </WebSocketProvider>
  )
}

export default App
