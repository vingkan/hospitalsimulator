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

  if (page === 'guide') {
    return <GuidePage />
  }

  return (
    <GameProvider>
      <GamePage />
    </GameProvider>
  )
}

export default App
