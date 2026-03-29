import { useEffect } from 'react'
import { useGame } from '../context/GameContext'
import { SetupScreen } from '../components/game/SetupScreen'
import { DecisionPhase } from '../components/game/DecisionPhase'
import { ResultsPhase } from '../components/game/ResultsPhase'
import { EndgameScreen } from '../components/game/EndgameScreen'
import { GameOverScreen } from '../components/game/GameOverScreen'

export function GamePage() {
  const { state, dispatch } = useGame()

  // Auto-advance from computing to results after the dramatic pause
  useEffect(() => {
    if (state.phase === 'computing') {
      dispatch({ type: 'SHOW_RESULTS' })
    }
  }, [state.phase, dispatch])

  switch (state.phase) {
    case 'setup':
      return <SetupScreen />
    case 'decision':
      return <DecisionPhase />
    case 'computing':
    case 'results':
      return <ResultsPhase />
    case 'endgame':
      return <EndgameScreen />
    case 'gameover':
      return <GameOverScreen />
    default:
      return <SetupScreen />
  }
}
