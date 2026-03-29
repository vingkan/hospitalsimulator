import { createContext, useContext, useReducer, type ReactNode } from 'react'
import type { HospitalState, SelectedDecision, QuarterResult, GamePhase } from '../engine/types'
import { createInitialState } from '../engine/constants'
import { shuffleEvents, drawEvent } from '../engine/events'
import { simulateQuarter } from '../engine/simulate'
import { getAvailablePackages } from '../decisions'

interface GameState {
  phase: GamePhase
  hospitalState: HospitalState
  currentResult: QuarterResult | null
  availablePackages: ReturnType<typeof getAvailablePackages>
}

type GameAction =
  | { type: 'START_GAME' }
  | { type: 'SUBMIT_DECISIONS'; decisions: SelectedDecision[] }
  | { type: 'SHOW_RESULTS' }
  | { type: 'NEXT_QUARTER' }
  | { type: 'RESET' }

function createInitialGameState(): GameState {
  const deck = shuffleEvents()
  const hospitalState = createInitialState(deck)
  return {
    phase: 'setup',
    hospitalState,
    currentResult: null,
    availablePackages: getAvailablePackages(hospitalState),
  }
}

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_GAME':
      return {
        ...state,
        phase: 'decision',
        availablePackages: getAvailablePackages(state.hospitalState),
      }

    case 'SUBMIT_DECISIONS': {
      const event = drawEvent(
        state.hospitalState.eventDeck,
        state.hospitalState.quarter - 1
      )
      const result = simulateQuarter(state.hospitalState, action.decisions, event)
      return {
        ...state,
        phase: 'computing',
        hospitalState: result.state,
        currentResult: result,
      }
    }

    case 'SHOW_RESULTS': {
      return {
        ...state,
        phase: state.hospitalState.gameOver ? 'gameover' : 'results',
      }
    }

    case 'NEXT_QUARTER': {
      if (state.hospitalState.quarter > 4) {
        return { ...state, phase: 'endgame' }
      }
      return {
        ...state,
        phase: 'decision',
        availablePackages: getAvailablePackages(state.hospitalState),
      }
    }

    case 'RESET':
      return createInitialGameState()

    default:
      return state
  }
}

const GameContext = createContext<{
  state: GameState
  dispatch: React.Dispatch<GameAction>
} | null>(null)

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, null, createInitialGameState)
  return (
    <GameContext.Provider value={{ state, dispatch }}>
      {children}
    </GameContext.Provider>
  )
}

export function useGame() {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used within GameProvider')
  return ctx
}
