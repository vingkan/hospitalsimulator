import { createContext, useContext, useReducer, type ReactNode } from 'react'
import type { OperationsConsoleState, ProgramState, GamePhase, HospitalProfile } from '../engine/types'
import { DEFAULT_PROFILE } from '../engine/profiles'
import { simulateYear, initializeGame, type GameState as EngineState, type YearResult } from '../engine/orchestrator'
import { shuffleEvents, drawEvent, EVENTS_ENABLED, NO_EVENT } from '../engine/events'
import { buildNarrative, type NarrativeResult } from '../engine/narrative'

// ── UI result type (engine result + narrative) ─────────────────────

export interface UIYearResult extends NarrativeResult {
  year: number
  engineResult: YearResult
}

// ── Game context state ─────────────────────────────────────────────

interface GameState {
  phase: GamePhase
  engineState: EngineState
  currentResult: UIYearResult | null
}

type GameAction =
  | { type: 'START_GAME' }
  | { type: 'SUBMIT_CONTROLS'; consoleState: OperationsConsoleState }
  | { type: 'SHOW_RESULTS' }
  | { type: 'NEXT_YEAR' }
  | { type: 'RESET' }
  | { type: 'SELECT_PROFILE'; profile: HospitalProfile }

// ── Console → ProgramState mapping ─────────────────────────────────

function consoleToProgramState(cs: OperationsConsoleState): ProgramState {
  return {
    nurseRatio: cs.nurseRatio,
    compensationChange: cs.compensationChange,
    supplyTier: cs.supplyTier,
    hospitalist: cs.hospitalist.active
      ? {
          active: true,
          workforce: cs.hospitalist.workforce,
          cdiIntensity: cs.hospitalist.cdiIntensity,
          documentationTraining: cs.hospitalist.documentationTraining,
          effectiveness: 1.0,
        }
      : undefined,
    dischargeCoordination: cs.dischargeCoordination.active
      ? {
          active: true,
          model: cs.dischargeCoordination.model,
          postAcutePartnerships: cs.dischargeCoordination.postAcutePartnerships,
        }
      : undefined,
    surgicalExpansion: cs.surgicalExpansion !== 'none'
      ? { active: true, investmentLevel: cs.surgicalExpansion }
      : undefined,
    maParticipation: cs.maParticipation,
    commercialNegotiation: cs.commercialNegotiation,
    admissionPosture: cs.admissionPosture,
  }
}

// ── Default console state from ProgramState ────────────────────────

export function defaultConsoleState(programs: ProgramState): OperationsConsoleState {
  return {
    nurseRatio: programs.nurseRatio,
    compensationChange: programs.compensationChange,
    hospitalist: programs.hospitalist?.active
      ? { active: true, workforce: programs.hospitalist.workforce, cdiIntensity: programs.hospitalist.cdiIntensity, documentationTraining: programs.hospitalist.documentationTraining }
      : { active: false },
    dischargeCoordination: programs.dischargeCoordination?.active
      ? { active: true, model: programs.dischargeCoordination.model, postAcutePartnerships: programs.dischargeCoordination.postAcutePartnerships }
      : { active: false },
    supplyTier: programs.supplyTier,
    surgicalExpansion: programs.surgicalExpansion?.active ? programs.surgicalExpansion.investmentLevel : 'none',
    maParticipation: programs.maParticipation ?? false,
    commercialNegotiation: programs.commercialNegotiation ?? 'none',
    admissionPosture: programs.admissionPosture ?? 'balanced',
  }
}

// ── Narrative from YearResult ──────────────────────────────────────

function buildUIResult(engineResult: YearResult, prevResult: YearResult | null): UIYearResult {
  const prev = prevResult
    ? {
        financials: prevResult.financials,
        medsurg: prevResult.moduleOutputs.medsurg,
        or: prevResult.moduleOutputs.or,
      }
    : null

  const current = {
    financials: engineResult.financials,
    medsurg: engineResult.moduleOutputs.medsurg,
    or: engineResult.moduleOutputs.or,
  }

  const narrativeResult = buildNarrative(prev, current, engineResult.event.title)

  return {
    year: engineResult.year,
    engineResult,
    ...narrativeResult,
  }
}

// ── Initial state ──────────────────────────────────────────────────

function createInitialGameState(profile: HospitalProfile = DEFAULT_PROFILE): GameState {
  const deck = EVENTS_ENABLED
    ? shuffleEvents()
    : [NO_EVENT, NO_EVENT, NO_EVENT, NO_EVENT, NO_EVENT]
  const engineState = initializeGame(profile, deck)
  return {
    phase: 'setup',
    engineState,
    currentResult: null,
  }
}

// ── Reducer ────────────────────────────────────────────────────────

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_GAME':
      return { ...state, phase: 'decision' }

    case 'SUBMIT_CONTROLS': {
      const programs = consoleToProgramState(action.consoleState)
      const event = drawEvent(
        state.engineState.eventDeck,
        state.engineState.year - 1,
      )
      const engineResult = simulateYear(state.engineState, programs, event)

      // Find previous year's result for narrative comparison
      const prevResult = state.engineState.history.length > 0
        ? state.engineState.history[state.engineState.history.length - 1]
        : null

      const uiResult = buildUIResult(engineResult, prevResult)

      return {
        ...state,
        phase: 'computing',
        engineState: engineResult.state,
        currentResult: uiResult,
      }
    }

    case 'SHOW_RESULTS':
      return {
        ...state,
        phase: state.engineState.gameOver ? 'gameover' : 'results',
      }

    case 'NEXT_YEAR': {
      if (state.engineState.year > 5) {
        return { ...state, phase: 'endgame' }
      }
      return { ...state, phase: 'decision' }
    }

    case 'RESET':
      return createInitialGameState()

    case 'SELECT_PROFILE':
      return createInitialGameState(action.profile)

    default:
      return state
  }
}

// ── Context ────────────────────────────────────────────────────────

const GameContext = createContext<{
  state: GameState
  dispatch: React.Dispatch<GameAction>
} | null>(null)

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, null, () => createInitialGameState())
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
