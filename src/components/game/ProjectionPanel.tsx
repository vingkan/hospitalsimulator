// ProjectionPanel: live causal trace for DecisionPhase.
// Shows projected impact of player decisions as sliders move.
// Design: B1 (Flow Cards + Loopback Arrows)

import type { ProjectionDiff, CausalStep, FeedbackLoop } from '../../hooks/useProjection'
import type { HospitalFinancials } from '../../engine/modules/finance'

interface Props {
  diff: ProjectionDiff | null
  financials: HospitalFinancials
}

export function ProjectionPanel({ diff, financials }: Props) {
  const marginColor = financials.margin > 0.05 ? 'var(--healthy)' : financials.margin > 0 ? 'var(--warning)' : 'var(--crisis)'

  return (
    <div className="rounded-xl p-5 h-full flex flex-col" style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
    }}>
      {/* Hero margin */}
      <div className="text-center py-2 mb-3">
        <p style={{ fontFamily: 'var(--font-display)', color: marginColor }}
          className="text-[42px] font-bold leading-none">
          {diff
            ? `${(diff.financials.margin.after * 100).toFixed(1)}%`
            : `${(financials.margin * 100).toFixed(1)}%`
          }
        </p>
        <p className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>
          {diff && Math.abs(diff.financials.margin.delta) > 0.001
            ? `Projected Margin (${diff.financials.margin.delta > 0 ? '+' : ''}${(diff.financials.margin.delta * 100).toFixed(1)}pp)`
            : 'Operating Margin'
          }
        </p>
      </div>

      {diff ? (
        <div className="flex-1 overflow-y-auto space-y-3">
          {/* Causal chain: horizontal flow cards */}
          <div>
            <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--primary)' }}
              className="text-[11px] font-semibold uppercase tracking-wider mb-2">
              Projected Impact
            </h3>
            <div className="overflow-x-auto pb-1 hide-scrollbar">
              <div className="flex items-center gap-1" style={{ minWidth: 'max-content' }}>
                {diff.causalChain.map((step, i) => (
                  <div key={step.id} className="flex items-center gap-1">
                    <FlowCard step={step} />
                    {i < diff.causalChain.length - 1 && <Arrow />}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Feedback loops + Department economics */}
          <div className="grid grid-cols-2 gap-3">
            <FeedbackLoops loops={diff.feedbackLoops} />
            <DepartmentEconomics departments={diff.departments} />
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <FinancialRows financials={financials} />
        </div>
      )}
    </div>
  )
}

// ── Static financial rows (shown before first slider change) ─────────

function FinancialRows({ financials }: { financials: HospitalFinancials }) {
  return (
    <div className="space-y-0">
      <FinRow label="Revenue" value={financials.revenue.total} color="var(--financial-pos)" />
      <FinRow label="  Medical" value={financials.revenue.medical} muted />
      <FinRow label="  Surgical" value={financials.revenue.surgical} muted />
      <div style={{ borderTop: '1px solid var(--border)', margin: '6px 0' }} />
      <FinRow label="Expenses" value={financials.expenses.total} />
      <FinRow label="  Labor" value={financials.expenses.labor} muted />
      <FinRow label="  Supplies" value={financials.expenses.supplies} muted />
      <FinRow label="  Overhead" value={financials.expenses.overhead} muted />
      <FinRow label="  Capital" value={financials.expenses.capital} muted />
      {financials.expenses.programs > 0 && (
        <FinRow label="  Programs" value={financials.expenses.programs} muted />
      )}
      <div style={{ borderTop: '1px solid var(--border)', margin: '6px 0' }} />
      <FinRow label="Cash Reserves" value={financials.cashReserves}
        color={financials.cashReserves > 30_000_000 ? 'var(--healthy)' : financials.cashReserves > 15_000_000 ? 'var(--warning)' : 'var(--crisis)'} />
    </div>
  )
}

function FinRow({ label, value, color, muted }: { label: string; value: number; color?: string; muted?: boolean }) {
  const formattedValue = value >= 1_000_000
    ? `$${(value / 1_000_000).toFixed(1)}M`
    : `$${(value / 1_000).toFixed(0)}K`
  return (
    <div className="flex justify-between py-0.5">
      <span className={muted ? 'text-[12px]' : 'text-[14px]'} style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className={`font-semibold ${muted ? 'text-[12px]' : 'text-[14px]'}`}
        style={{ fontFamily: 'var(--font-data)', color: color || 'var(--text)' }}>
        {formattedValue}
      </span>
    </div>
  )
}

// ── Flow Card ───────────────────────────────────────────────────────

function FlowCard({ step }: { step: CausalStep }) {
  const color = step.direction === 'positive' ? 'var(--healthy)'
    : step.direction === 'negative' ? 'var(--crisis)'
    : 'var(--text-muted)'

  return (
    <div className="rounded-lg px-3 py-2 flex-shrink-0" style={{
      background: 'var(--surface-elevated)',
      border: '1px solid var(--border)',
      minWidth: '120px',
    }}>
      <p className="text-[10px] uppercase tracking-wider mb-1" style={{
        fontFamily: 'var(--font-display)',
        color: 'var(--text-muted)',
      }}>
        {step.label}
      </p>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[14px]" style={{ fontFamily: 'var(--font-data)', color: 'var(--text)' }}>
          {formatValue(step.after, step.unit)}
        </span>
        {Math.abs(step.delta) > 0.01 && (
          <span className="text-[11px] px-1.5 py-0.5 rounded-full" style={{
            fontFamily: 'var(--font-data)',
            color,
            background: step.direction === 'positive' ? '#064E3B40'
              : step.direction === 'negative' ? '#9F122340'
              : '#33415540',
          }}>
            {step.delta > 0 ? '+' : ''}{formatDelta(step.delta, step.unit)}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Arrow connector ──────────────────────────────────────────────────

function Arrow() {
  return (
    <svg width="20" height="16" viewBox="0 0 20 16" className="flex-shrink-0">
      <line x1="0" y1="8" x2="14" y2="8" stroke="#2DD4BF" strokeWidth="1.5" strokeDasharray="3 2" />
      <polygon points="14,4 20,8 14,12" fill="#2DD4BF" />
    </svg>
  )
}

// ── Feedback Loops ──────────────────────────────────────────────────

function FeedbackLoops({ loops }: { loops: FeedbackLoop[] }) {
  return (
    <div className="rounded-lg p-3" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}>
      <p className="text-[10px] uppercase tracking-wider mb-2" style={{
        fontFamily: 'var(--font-display)',
        color: 'var(--primary)',
      }}>
        Feedback Loops
      </p>
      <div className="space-y-2">
        {loops.map(loop => (
          <LoopRow key={loop.id} loop={loop} />
        ))}
      </div>
    </div>
  )
}

function LoopRow({ loop }: { loop: FeedbackLoop }) {
  const color = loop.id === 'readmissions' ? 'var(--crisis)'
    : loop.id === 'bed-pressure' ? 'var(--warning)'
    : 'var(--primary)'

  return (
    <div className="flex items-start gap-2">
      <span className="text-[14px] mt-0.5" style={{ color }}>↻</span>
      <div>
        <p className="text-[12px] font-semibold" style={{ fontFamily: 'var(--font-data)', color: 'var(--text)' }}>
          {loop.label}: {formatLoopValue(loop)}
        </p>
        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          {loop.description}
        </p>
      </div>
    </div>
  )
}

// ── Department Economics ─────────────────────────────────────────────

function DepartmentEconomics({ departments }: { departments: ProjectionDiff['departments'] }) {
  const totalOperatingIncome = departments.medsurg.margin + departments.or.margin
  const orPct = totalOperatingIncome > 0
    ? Math.round((departments.or.margin / totalOperatingIncome) * 100)
    : 0

  return (
    <div className="rounded-lg p-3" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}>
      <p className="text-[10px] uppercase tracking-wider mb-2" style={{
        fontFamily: 'var(--font-display)',
        color: 'var(--primary)',
      }}>
        Department Economics
      </p>
      <div className="space-y-1.5">
        <DeptRow label="Med/Surg" revenue={departments.medsurg.revenue} expenses={departments.medsurg.expenses} margin={departments.medsurg.margin} />
        <DeptRow label="OR" revenue={departments.or.revenue} expenses={departments.or.expenses} margin={departments.or.margin} />
        <div className="flex justify-between text-[11px] pt-1" style={{ borderTop: '1px solid var(--border)' }}>
          <span style={{ color: 'var(--text-muted)' }}>Overhead</span>
          <span style={{ fontFamily: 'var(--font-data)', color: 'var(--crisis)' }}>
            -${(departments.overhead / 1_000_000).toFixed(0)}M
          </span>
        </div>
      </div>
      {orPct > 0 && (
        <p className="text-[10px] mt-2 px-2 py-1 rounded" style={{
          fontFamily: 'var(--font-data)',
          color: 'var(--financial-pos)',
          background: '#0C4A6E20',
        }}>
          OR contributes {orPct}% of operating income
        </p>
      )}
    </div>
  )
}

function DeptRow({ label, revenue, expenses, margin }: { label: string; revenue: number; expenses: number; margin: number }) {
  const marginColor = margin > 0 ? 'var(--healthy)' : 'var(--crisis)'
  return (
    <div className="flex justify-between items-center text-[11px]">
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <div className="flex gap-2" style={{ fontFamily: 'var(--font-data)' }}>
        <span style={{ color: 'var(--text-muted)' }}>${(revenue / 1_000_000).toFixed(0)}M rev</span>
        <span style={{ color: 'var(--text-muted)' }}>${(expenses / 1_000_000).toFixed(0)}M exp</span>
        <span style={{ color: marginColor, fontWeight: 600 }}>
          = ${(margin / 1_000_000).toFixed(0)}M
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

function formatLoopValue(loop: FeedbackLoop): string {
  if (loop.id === 'readmissions') {
    return `${loop.current.toLocaleString()} → ${loop.projected.toLocaleString()}`
  }
  if (loop.id === 'bed-pressure') {
    return loop.projected > 0 ? `${(loop.projected * 100).toFixed(0)}% diversion` : 'None'
  }
  return `${loop.current.toFixed(0)} → ${loop.projected.toFixed(0)}`
}
