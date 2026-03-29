import { useState } from 'react'
import { useGame } from '../../context/GameContext'
import { DecisionCard } from './DecisionCard'
import { Button } from '../ui/Button'
import type { SelectedDecision } from '../../engine/types'

export function DecisionPhase() {
  const { state, dispatch } = useGame()
  const [expandedPkg, setExpandedPkg] = useState<string | null>(null)
  const [decisions, setDecisions] = useState<SelectedDecision[]>([])

  const ops = state.hospitalState.operational
  const fin = state.hospitalState.financial


  return (
    <div className="min-h-screen p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-[36px] font-bold">Quarter {state.hospitalState.quarter} of 4</h2>
        <div className="flex gap-4">
          <span className={`text-[28px] font-bold px-4 py-1 rounded-lg ${
            fin.margin > 0.05 ? 'bg-emerald-100 text-emerald-700' :
            fin.margin > 0 ? 'bg-amber-100 text-amber-700' :
            'bg-rose-100 text-rose-700'
          }`}>
            Margin: {(fin.margin * 100).toFixed(1)}%
          </span>
          <span className={`text-[28px] font-bold px-4 py-1 rounded-lg ${
            fin.cashReserves > 5_000_000 ? 'bg-emerald-100 text-emerald-700' :
            fin.cashReserves > 2_000_000 ? 'bg-amber-100 text-amber-700' :
            'bg-rose-100 text-rose-700'
          }`}>
            Cash: ${(fin.cashReserves / 1_000_000).toFixed(1)}M
          </span>
        </div>
      </div>

      {/* Three-zone layout */}
      <div className="grid grid-cols-[1fr_2fr_1fr] gap-4">
        {/* Left: Operational */}
        <div className="bg-slate-50 rounded-xl p-4">
          <h3 className="text-[22px] font-semibold mb-3 text-slate-700">Operations</h3>
          <div className="space-y-2 text-[20px]">
            <Metric label="Bed Occupancy" value={`${(ops.beds.occupancyRate * 100).toFixed(0)}%`} />
            <Metric label="Avg LOS" value={`${ops.lengthOfStay.toFixed(1)} days`} />
            <Metric label="Surgical Cases" value={`${ops.surgical.casesCompleted}`} />
            <Metric label="Cancelled" value={`${ops.surgical.casesCancelled}`} warn={ops.surgical.casesCancelled > 0} />
            <Metric label="Readmission" value={`${(ops.readmissionRate * 100).toFixed(1)}%`} warn={ops.readmissionRate > 0.15} />
            <Metric label="Quality" value={`${ops.qualityScore.toFixed(0)}/100`} />
            <Metric label="DRG Accuracy" value={`${(ops.drgAccuracy * 100).toFixed(0)}%`} />
          </div>
        </div>

        {/* Center: Decisions */}
        <div>
          <h3 className="text-[24px] font-semibold mb-3">Decisions This Quarter</h3>
          {state.availablePackages.map(pkg => (
            <DecisionCard
              key={pkg.id}
              pkg={pkg}
              expanded={expandedPkg === pkg.id}
              onToggle={() => setExpandedPkg(expandedPkg === pkg.id ? null : pkg.id)}
              onDecide={(decision) => {
                setDecisions(prev => [...prev.filter(d => d.packageId !== pkg.id), decision])
                setExpandedPkg(null)
              }}
            />
          ))}

          {decisions.length > 0 && (
            <div className="mt-4 p-4 bg-blue-50 rounded-xl">
              <p className="text-[20px] text-blue-700 mb-2">
                {decisions.length} of {state.availablePackages.length} decisions made
              </p>
              <Button
                onClick={() => dispatch({ type: 'SUBMIT_DECISIONS', decisions })}
                size="large"
                className="w-full"
              >
                Submit All Decisions
              </Button>
            </div>
          )}
        </div>

        {/* Right: Financial */}
        <div className="bg-slate-50 rounded-xl p-4">
          <h3 className="text-[22px] font-semibold mb-3 text-slate-700">Finances</h3>
          <div className="space-y-2 text-[20px]">
            <Metric label="Revenue" value={`$${(fin.revenue.total / 1_000_000).toFixed(1)}M`} />
            <Metric label="  Medical" value={`$${(fin.revenue.medical / 1_000_000).toFixed(1)}M`} />
            <Metric label="  Surgical" value={`$${(fin.revenue.surgical / 1_000_000).toFixed(1)}M`} />
            <div className="border-t border-slate-300 my-1" />
            <Metric label="Expenses" value={`$${(fin.expenses.total / 1_000_000).toFixed(1)}M`} />
            <Metric label="  Labor" value={`$${(fin.expenses.labor.amount / 1_000_000).toFixed(1)}M`} />
            <Metric label="  Supplies" value={`$${(fin.expenses.supplies.amount / 1_000_000).toFixed(1)}M`} />
            <Metric label="  Overhead" value={`$${(fin.expenses.overhead.amount / 1_000_000).toFixed(1)}M`} />
            <Metric label="  Programs" value={`$${(fin.expenses.programSubsidies / 1_000_000).toFixed(1)}M`} />
          </div>
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-600">{label}</span>
      <span className={`font-semibold ${warn ? 'text-rose-600' : ''}`}>{value}</span>
    </div>
  )
}
