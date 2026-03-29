import { useEffect, useState } from 'react'
import { useGame } from '../../context/GameContext'
import { Button } from '../ui/Button'

export function ResultsPhase() {
  const { state, dispatch } = useGame()
  const result = state.currentResult
  const [revealed, setRevealed] = useState(false)

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
        <p className="text-[36px] animate-pulse" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-muted)' }}>
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
        <h2 style={{ fontFamily: 'var(--font-display)' }} className="text-[36px] font-bold">
          Quarter {result.quarter} Results
        </h2>
        <div className="flex gap-3">
          <HealthBadge label="MARGIN" value={`${(fin.margin * 100).toFixed(1)}%`}
            level={fin.margin > 0.05 ? 'healthy' : fin.margin > 0 ? 'warning' : 'crisis'} />
          <HealthBadge label="CASH" value={`$${(fin.cashReserves / 1_000_000).toFixed(1)}M`}
            level={fin.cashReserves > 10_000_000 ? 'healthy' : fin.cashReserves > 5_000_000 ? 'warning' : 'crisis'} />
        </div>
      </div>

      {/* Event card */}
      <div className="rounded-xl p-6 mb-6" style={{
        background: 'var(--surface)',
        borderLeft: '3px solid var(--warning)',
        border: '1px solid var(--border)',
        borderLeftWidth: '3px',
        borderLeftColor: 'var(--warning)',
      }}>
        <p style={{ fontFamily: 'var(--font-data)', color: 'var(--warning)' }} className="text-[11px] uppercase tracking-wider mb-2">
          External Event
        </p>
        <h3 style={{ fontFamily: 'var(--font-display)' }} className="text-[24px] font-bold mb-2">
          {result.event.title}
        </h3>
        <p className="text-[16px] mb-2" style={{ color: 'var(--text-muted)' }}>{result.event.description}</p>
        <p className="text-[13px] italic" style={{ color: 'var(--text-muted)' }}>Teaches: {result.event.teaches}</p>
      </div>

      {/* Narrative sections */}
      <div className="space-y-4 mb-6">
        {result.operationalHighlights.length > 0 && (
          <NarrativeSection title="What Happened" items={result.operationalHighlights} />
        )}

        {result.narrative.length > 0 && (
          <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--primary)' }} className="text-[14px] font-semibold uppercase tracking-wider mb-3">
              Why It Matters
            </h3>
            {result.narrative.map((n, i) => (
              <p key={i} className="text-[18px] mb-3 leading-relaxed" style={{ color: 'var(--text)' }}>{n}</p>
            ))}
          </div>
        )}

        {result.financialHighlights.length > 0 && (
          <NarrativeSection title="Financial Impact" items={result.financialHighlights} />
        )}
      </div>

      {/* Discussion prompt */}
      {result.programs && (
        <div className="rounded-xl p-5 mb-6" style={{
          background: 'var(--surface)',
          borderLeft: '3px solid var(--primary)',
        }}>
          <p style={{ fontFamily: 'var(--font-display)', color: 'var(--primary)' }} className="text-[12px] font-semibold uppercase tracking-wider mb-2">
            Discussion
          </p>
          <p className="text-[18px]" style={{ color: 'var(--text)' }}>
            Why did that happen? What would you do differently?
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

function HealthBadge({ label, value, level }: { label: string; value: string; level: 'healthy' | 'warning' | 'crisis' }) {
  const colors = {
    healthy: { bg: '#064E3B40', text: 'var(--healthy)' },
    warning: { bg: '#78350F40', text: 'var(--warning)' },
    crisis: { bg: '#9F122340', text: 'var(--crisis)' },
  }
  const c = colors[level]
  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: c.bg }}>
      <span style={{ fontFamily: 'var(--font-data)', color: c.text }} className="text-[11px] uppercase tracking-wider">{label}</span>
      <span style={{ fontFamily: 'var(--font-data)', color: c.text }} className="text-[16px] font-semibold">{value}</span>
    </div>
  )
}

function NarrativeSection({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--primary)' }} className="text-[14px] font-semibold uppercase tracking-wider mb-3">
        {title}
      </h3>
      {items.map((h, i) => (
        <p key={i} className="text-[16px] mb-1" style={{ color: 'var(--text)' }}>{h}</p>
      ))}
    </div>
  )
}
