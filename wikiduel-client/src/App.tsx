import { Navigate, Route, Routes } from 'react-router'

import { LobbyProvider } from './features/lobby/LobbyProvider'
import { HomePage } from './pages/HomePage'
import { LabPage } from './pages/LabPage'
import { LobbyPage } from './pages/LobbyPage'
import { isPlayableArticleLabEnabled } from './pages/labAvailability'
import { WebSocketProvider } from './websocket/WebSocketProvider'

function App() {
  const labRoute = import.meta.env.DEV && isPlayableArticleLabEnabled()
    ? <Route path="lab" element={<LabPage />} />
    : null

  return (
    <WebSocketProvider>
      <LobbyProvider>
        <Routes>
          <Route index element={<HomePage />} />
          <Route path="lobby/:lobbyCode" element={<LobbyPage />} />
          {labRoute}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </LobbyProvider>
    </WebSocketProvider>
  )
}

export default App
