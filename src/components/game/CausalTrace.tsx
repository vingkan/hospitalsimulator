// CausalTrace: actual results visualization for ResultsPhase.
// Shows what happened and why, with year-over-year causal chain.
// Design: B1 (Flow Cards + Loopback Arrows)

import type { ProjectionDiff, CausalStep, FeedbackLoop } from '../../hooks/useProjection'

interface Props {
  diff: ProjectionDiff
}

export function CausalTrace({ diff }: Props) {
  const totalOperatingIncome = diff.departments.medsurg.margin + diff.departments.or.margin
  const orPct = totalOperatingIncome > 0
    ? Math.round((diff.departments.or.margin / totalOperatingIncome) * 100)
    : 0

  return (
    <div className="rounded-xl p-5" style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
    }}>
      <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--primary)' }}
        className="text-[13px] font-semibold uppercase tracking-wider mb-4">
        Why It Happened
      </h3>

      {/* Causal chain: horizontal flow cards (scrollable within bounds) */}
      <div className="overflow-x-auto pb-2 mb-4 hide-scrollbar">
        <div className="flex items-center gap-1.5" style={{ minWidth: 'max-content' }}>
          {diff.causalChain.map((step, i) => (
            <div key={step.id} className="flex items-center gap-1.5">
              <TraceCard step={step} />
              {i < diff.causalChain.length - 1 && <TraceArrow />}
            </div>
          ))}
        </div>
      </div>

      {/* Feedback loops + Department economics */}
      <div className="grid grid-cols-2 gap-4">
        {/* Feedback loops */}
        <div className="space-y-3">
          <p className="text-[11px] uppercase tracking-wider" style={{
            fontFamily: 'var(--font-display)',
            color: 'var(--primary)',
          }}>
            Feedback Loops
          </p>
          {diff.feedbackLoops.map(loop => (
            <LoopCard key={loop.id} loop={loop} />
          ))}
        </div>

        {/* Department contribution */}
        <div>
          <p className="text-[11px] uppercase tracking-wider mb-3" style={{
            fontFamily: 'var(--font-display)',
            color: 'var(--primary)',
          }}>
            Department Contribution
          </p>
          <div className="space-y-3">
            <DeptCard label="Med/Surg" dept={diff.departments.medsurg} />
            <DeptCard label="OR" dept={diff.departments.or} />
            <div className="flex justify-between items-center rounded-lg px-3 py-2" style={{
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border)',
            }}>
              <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>Overhead + Capital</span>
              <span className="text-[14px] font-semibold" style={{
                fontFamily: 'var(--font-data)',
                color: 'var(--crisis)',
              }}>
                -${(diff.departments.overhead / 1_000_000).toFixed(0)}M
              </span>
            </div>
          </div>

          {/* Key insight */}
          {orPct > 0 && (
            <div className="mt-3 px-3 py-2 rounded-lg" style={{
              background: '#0C4A6E20',
              border: '1px solid #0C4A6E40',
            }}>
              <p className="text-[13px] font-semibold" style={{
                fontFamily: 'var(--font-data)',
                color: 'var(--financial-pos)',
              }}>
                OR contributed {orPct}% of hospital operating income
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Trace Card (larger than ProjectionPanel's FlowCard) ──────────────

function TraceCard({ step }: { step: CausalStep }) {
  const color = step.direction === 'positive' ? 'var(--healthy)'
    : step.direction === 'negative' ? 'var(--crisis)'
    : 'var(--text-muted)'

  return (
    <div className="rounded-lg px-4 py-3 flex-shrink-0" style={{
      background: 'var(--surface-elevated)',
      border: '1px solid var(--border)',
      minWidth: '140px',
    }}>
      <p className="text-[10px] uppercase tracking-wider mb-1" style={{
        fontFamily: 'var(--font-display)',
        color: 'var(--text-muted)',
      }}>
        {step.label}
      </p>
      <p className="text-[18px] font-semibold" style={{
        fontFamily: 'var(--font-data)',
        color: 'var(--text)',
      }}>
        {formatValue(step.after, step.unit)}
      </p>
      {Math.abs(step.delta) > 0.01 && (
        <p className="text-[12px] mt-0.5" style={{ fontFamily: 'var(--font-data)', color }}>
          {step.delta > 0 ? '+' : ''}{formatDelta(step.delta, step.unit)} vs last year
        </p>
      )}
    </div>
  )
}

// ── Arrow ────────────────────────────────────────────────────────────

function TraceArrow() {
  return (
    <svg width="24" height="16" viewBox="0 0 24 16" className="flex-shrink-0">
      <line x1="0" y1="8" x2="17" y2="8" stroke="#2DD4BF" strokeWidth="2" strokeDasharray="4 2" />
      <polygon points="17,3 24,8 17,13" fill="#2DD4BF" />
    </svg>
  )
}

// ── Loop Card ────────────────────────────────────────────────────────

function LoopCard({ loop }: { loop: FeedbackLoop }) {
  const color = loop.id === 'readmissions' ? 'var(--crisis)'
    : loop.id === 'bed-pressure' ? 'var(--warning)'
    : 'var(--primary)'

  const bgColor = loop.id === 'readmissions' ? '#9F122315'
    : loop.id === 'bed-pressure' ? '#78350F15'
    : '#0D948815'

  return (
    <div className="rounded-lg px-3 py-2" style={{
      background: bgColor,
      border: `1px solid ${loop.id === 'readmissions' ? '#9F122330' : loop.id === 'bed-pressure' ? '#78350F30' : '#0D948830'}`,
    }}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[16px]" style={{ color }}>↻</span>
        <span className="text-[13px] font-semibold" style={{
          fontFamily: 'var(--font-display)',
          color,
        }}>
          {loop.label}
        </span>
      </div>
      <p className="text-[13px]" style={{ fontFamily: 'var(--font-data)', color: 'var(--text)' }}>
        {formatLoopNumbers(loop)}
      </p>
      <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
        {loop.description}
      </p>
    </div>
  )
}

// ── Department Card ──────────────────────────────────────────────────

function DeptCard({ label, dept }: { label: string; dept: { revenue: number; expenses: number; margin: number } }) {
  const maxVal = Math.max(dept.revenue, dept.expenses)
  const revPct = maxVal > 0 ? (dept.revenue / maxVal) * 100 : 0
  const expPct = maxVal > 0 ? (dept.expenses / maxVal) * 100 : 0

  return (
    <div className="rounded-lg px-3 py-2" style={{
      background: 'var(--surface-elevated)',
      border: '1px solid var(--border)',
    }}>
      <div className="flex justify-between items-center mb-2">
        <span className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>{label}</span>
        <span className="text-[14px] font-semibold" style={{
          fontFamily: 'var(--font-data)',
          color: dept.margin > 0 ? 'var(--healthy)' : 'var(--crisis)',
        }}>
          ${(dept.margin / 1_000_000).toFixed(0)}M margin
        </span>
      </div>
      {/* Revenue bar */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] w-8" style={{ color: 'var(--text-muted)' }}>Rev</span>
        <div className="flex-1 h-3 rounded-sm overflow-hidden" style={{ background: '#33415540' }}>
          <div className="h-full rounded-sm" style={{ width: `${revPct}%`, background: 'var(--primary-muted)' }} />
        </div>
        <span className="text-[10px] w-12 text-right" style={{ fontFamily: 'var(--font-data)', color: 'var(--text-muted)' }}>
          ${(dept.revenue / 1_000_000).toFixed(0)}M
        </span>
      </div>
      {/* Expense bar */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] w-8" style={{ color: 'var(--text-muted)' }}>Exp</span>
        <div className="flex-1 h-3 rounded-sm overflow-hidden" style={{ background: '#33415540' }}>
          <div className="h-full rounded-sm" style={{ width: `${expPct}%`, background: '#475569' }} />
        </div>
        <span className="text-[10px] w-12 text-right" style={{ fontFamily: 'var(--font-data)', color: 'var(--text-muted)' }}>
          ${(dept.expenses / 1_000_000).toFixed(0)}M
        </span>
      </div>
    </div>
  )
}

// ── Formatting ──────────────────────────────────────────────────────

function formatValue(value: number, unit: string): string {
  switch (unit) {
    case 'days': return `${value.toFixed(1)}d`
    case '%': return `${value.toFixed(0)}%`
    case '$M': return `$${value.toFixed(0)}M`
    case 'pp': return `${value.toFixed(1)}%`
    case 'patients': return value.toLocaleString()
    default: return value.toFixed(2)
  }
}

function formatDelta(delta: number, unit: string): string {
  switch (unit) {
    case 'days': return `${delta.toFixed(1)}d`
    case '%': return `${delta.toFixed(0)}%`
    case '$M': return `$${delta.toFixed(0)}M`
    case 'pp': return `${delta.toFixed(1)}pp`
    case 'patients': return delta.toLocaleString()
    default: return delta.toFixed(2)
  }
}

function formatLoopNumbers(loop: FeedbackLoop): string {
  if (loop.id === 'readmissions') {
    return `${loop.current.toLocaleString()} → ${loop.projected.toLocaleString()} patients`
  }
  if (loop.id === 'bed-pressure') {
    if (loop.projected === 0 && loop.current === 0) return 'No diversion'
    return `${(loop.current * 100).toFixed(0)}% → ${(loop.projected * 100).toFixed(0)}%`
  }
  return `Quality: ${loop.current.toFixed(0)} → ${loop.projected.toFixed(0)}`
}
