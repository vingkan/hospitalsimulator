import { useState, useCallback } from 'react'
import { useGame } from '../../context/GameContext'
import { HospitalSchematic } from './HospitalSchematic'
import { OperationsConsole } from './OperationsConsole'
import { ProjectionPanel } from './ProjectionPanel'
import { useProjection } from '../../hooks/useProjection'
import { defaultConsoleState } from '../../context/GameContext'
import type { OperationsConsoleState } from '../../engine/types'

export function DecisionPhase() {
  const { state, dispatch } = useGame()
  const fin = state.engineState.financials

  // Track console state for live projection
  const [consoleState, setConsoleState] = useState<OperationsConsoleState>(
    () => defaultConsoleState(state.engineState.programs)
  )

  const diff = useProjection(state.engineState, consoleState)

  const handleSubmit = useCallback((cs: OperationsConsoleState) => {
    dispatch({ type: 'SUBMIT_CONTROLS', consoleState: cs })
  }, [dispatch])

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-3" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-4">
          <span style={{ fontFamily: 'var(--font-display)' }} className="text-[28px] font-bold">
            Year {state.engineState.year}
          </span>
          <span className="text-[16px]" style={{ color: 'var(--text-muted)' }}>
            Riverside General Hospital
          </span>
        </div>
        <div className="flex gap-3">
          <HealthBadge label="MARGIN" value={`${(fin.margin * 100).toFixed(1)}%`}
            level={fin.margin > 0.05 ? 'healthy' : fin.margin > 0 ? 'warning' : 'crisis'} />
          <HealthBadge label="CASH" value={`$${(fin.cashReserves / 1_000_000).toFixed(1)}M`}
            level={fin.cashReserves > 30_000_000 ? 'healthy' : fin.cashReserves > 15_000_000 ? 'warning' : 'crisis'} />
        </div>
      </div>

      {/* Hospital schematic (top ~45%) */}
      <div className="px-4 pt-3 pb-2" style={{ flex: '0 0 auto' }}>
        <HospitalSchematic
          medsurgState={state.engineState.moduleStates.medsurg}
          orState={state.engineState.moduleStates.or}
          programs={state.engineState.programs}
        />
      </div>

      {/* Bottom panels: console + projection (replaces static financial panel) */}
      <div className="flex-1 grid grid-cols-2 gap-3 px-4 pb-4 min-h-0">
        <div className="min-h-0 overflow-hidden">
          <OperationsConsole
            programs={state.engineState.programs}
            onSubmit={handleSubmit}
            onConsoleChange={setConsoleState}
          />
        </div>
        <div className="min-h-0 overflow-y-auto hide-scrollbar">
          <ProjectionPanel diff={diff} financials={state.engineState.financials} />
        </div>
      </div>
    </div>
  )
}

function HealthBadge({ label, value, level }: { label: string; value: string; level: 'healthy' | 'warning' | 'crisis' }) {
  const colors = {
    healthy: { bg: '#064E3B40', text: 'var(--healthy)' },
    warning: { bg: '#78350F40', text: 'var(--warning)' },
    crisis: { bg: '#9F122340', text: 'var(--crisis)' },
  }
  const c = colors[level]
  return (
    <div className="flex items-center gap-2 px-4 py-1.5 rounded-full" style={{ background: c.bg }}>
      <span style={{ fontFamily: 'var(--font-data)', color: c.text }} className="text-[10px] uppercase tracking-wider">{label}</span>
      <span style={{ fontFamily: 'var(--font-data)', color: c.text }} className="text-[15px] font-semibold">{value}</span>
    </div>
  )
}
