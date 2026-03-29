import { useEffect, useState } from 'react'
import { useGame } from '../../context/GameContext'
import { Button } from '../ui/Button'

export function ResultsPhase() {
  const { state, dispatch } = useGame()
  const result = state.currentResult
  const [revealed, setRevealed] = useState(false)

  // Dramatic pause: 1s for Q1-Q3, 3s for Q4
  const isQ4 = result && result.quarter === 4
  const pauseDuration = isQ4 ? 3000 : 1000

  useEffect(() => {
    setRevealed(false)
    const timer = setTimeout(() => setRevealed(true), pauseDuration)
    return () => clearTimeout(timer)
  }, [result?.quarter, pauseDuration])

  if (!result) return null

  if (!revealed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <p className="text-[36px] text-slate-500 animate-pulse">
          Computing Quarter {result.quarter}...
        </p>
      </div>
    )
  }

  const fin = result.state.financial
  const isFinalQuarter = result.quarter >= 4

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-[36px] font-bold">Quarter {result.quarter} Results</h2>
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

      {/* Event card */}
      <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-6 mb-6">
        <p className="text-[18px] text-amber-600 font-semibold mb-1">External Event</p>
        <h3 className="text-[28px] font-bold text-amber-900">{result.event.title}</h3>
        <p className="text-[22px] text-amber-800 mt-1">{result.event.description}</p>
        <p className="text-[16px] text-amber-600 mt-2 italic">Teaches: {result.event.teaches}</p>
      </div>

      {/* Narrative */}
      <div className="space-y-4 mb-6">
        {result.operationalHighlights.length > 0 && (
          <div className="bg-slate-50 rounded-xl p-6">
            <h3 className="text-[22px] font-semibold text-slate-700 mb-2">What Happened</h3>
            {result.operationalHighlights.map((h, i) => (
              <p key={i} className="text-[22px] text-slate-800 mb-1">• {h}</p>
            ))}
          </div>
        )}

        {result.narrative.length > 0 && (
          <div className="bg-blue-50 rounded-xl p-6">
            <h3 className="text-[22px] font-semibold text-blue-700 mb-2">Why It Matters</h3>
            {result.narrative.map((n, i) => (
              <p key={i} className="text-[22px] text-blue-900 mb-2">{n}</p>
            ))}
          </div>
        )}

        {result.financialHighlights.length > 0 && (
          <div className="bg-emerald-50 rounded-xl p-6">
            <h3 className="text-[22px] font-semibold text-emerald-700 mb-2">Financial Impact</h3>
            {result.financialHighlights.map((h, i) => (
              <p key={i} className="text-[22px] text-emerald-900 mb-1">• {h}</p>
            ))}
          </div>
        )}
      </div>

      {/* Facilitator discussion prompt */}
      {result.decisions.length > 0 && (
        <div className="border-2 border-slate-300 rounded-xl p-6 mb-6 bg-white">
          <p className="text-[20px] text-slate-500 font-semibold mb-2">Discussion</p>
          <p className="text-[24px] text-slate-800">
            "Why did that happen? What would you do differently?"
          </p>
        </div>
      )}

      <Button
        size="large"
        className="w-full"
        onClick={() => dispatch({ type: 'NEXT_QUARTER' })}
      >
        {isFinalQuarter ? 'See Final Results' : `Continue to Quarter ${result.quarter + 1}`}
      </Button>
    </div>
  )
}
