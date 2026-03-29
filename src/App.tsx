import { useState, useEffect } from 'react'
import { GameProvider } from './context/GameContext'
import { GamePage } from './pages/GamePage'
import { GuidePage } from './pages/GuidePage'

function App() {
  const [page, setPage] = useState<'game' | 'guide'>(
    window.location.hash === '#guide' ? 'guide' : 'game'
  )

  useEffect(() => {
    const handleHash = () => {
      setPage(window.location.hash === '#guide' ? 'guide' : 'game')
    }
    window.addEventListener('hashchange', handleHash)
    return () => window.removeEventListener('hashchange', handleHash)
  }, [])

  // GameProvider wraps both pages so game state persists when
  // the facilitator navigates to/from the guide mid-game
  return (
    <GameProvider>
      {page === 'guide' ? <GuidePage /> : <GamePage />}
    </GameProvider>
  )
}

export default App
