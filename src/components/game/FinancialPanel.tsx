import type { HospitalState } from '../../engine/types'

interface Props {
  financial: HospitalState['financial']
}

export function FinancialPanel({ financial }: Props) {
  const fin = financial
  const marginColor = fin.margin > 0.05 ? 'var(--healthy)' : fin.margin > 0 ? 'var(--warning)' : 'var(--crisis)'

  return (
    <div className="rounded-xl p-5 h-full" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--primary)' }}
        className="text-[13px] font-semibold uppercase tracking-wider mb-4">
        Financial Summary
      </h3>

      {/* Hero metric: margin */}
      <div className="text-center py-3 mb-3">
        <p style={{ fontFamily: 'var(--font-display)', color: marginColor }}
          className="text-[48px] font-bold leading-none">
          {(fin.margin * 100).toFixed(1)}%
        </p>
        <p className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>Operating Margin</p>
      </div>

      {/* Financial rows */}
      <div className="space-y-0">
        <FinRow label="Revenue" value={fin.revenue.total} color="var(--financial-pos)" />
        <FinRow label="  Medical" value={fin.revenue.medical} muted />
        <FinRow label="  Surgical" value={fin.revenue.surgical} muted />

        <div style={{ borderTop: '1px solid var(--border)', margin: '6px 0' }} />

        <FinRow label="Expenses" value={fin.expenses.total} />
        <FinRow label="  Labor" value={fin.expenses.labor.amount} muted />
        <FinRow label="  Supplies" value={fin.expenses.supplies.amount} muted />
        <FinRow label="  Overhead" value={fin.expenses.overhead.amount} muted />
        <FinRow label="  Capital" value={fin.expenses.capital.amount} muted />
        {fin.expenses.programSubsidies > 0 && (
          <FinRow label="  Programs" value={fin.expenses.programSubsidies} muted />
        )}

        <div style={{ borderTop: '1px solid var(--border)', margin: '6px 0' }} />

        <FinRow label="Cash Reserves" value={fin.cashReserves}
          color={fin.cashReserves > 10_000_000 ? 'var(--healthy)' : fin.cashReserves > 5_000_000 ? 'var(--warning)' : 'var(--crisis)'} />

        <div style={{ borderTop: '1px solid var(--border)', margin: '6px 0' }} />

        {/* Payer mix summary */}
        <p className="text-[12px] mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-muted)' }}>
          PAYER MIX
        </p>
        <div className="flex gap-2 text-[11px]" style={{ fontFamily: 'var(--font-data)', color: 'var(--text-muted)' }}>
          <span>MCR {(fin.payers.medicare.share * 100).toFixed(0)}%</span>
          <span>COM {(fin.payers.commercial.share * 100).toFixed(0)}%</span>
          <span>MCD {(fin.payers.medicaid.share * 100).toFixed(0)}%</span>
          <span>SP {(fin.payers.selfPay.share * 100).toFixed(0)}%</span>
        </div>
      </div>
    </div>
  )
}

function FinRow({ label, value, color, muted }: { label: string; value: number; color?: string; muted?: boolean }) {
  const formattedValue = value >= 1_000_000
    ? `$${(value / 1_000_000).toFixed(1)}M`
    : `$${(value / 1_000).toFixed(0)}K`

  return (
    <div className="flex justify-between py-0.5">
      <span className={muted ? 'text-[12px]' : 'text-[14px]'} style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      <span className={`font-semibold ${muted ? 'text-[12px]' : 'text-[14px]'}`}
        style={{ fontFamily: 'var(--font-data)', color: color || 'var(--text)' }}>
        {formattedValue}
      </span>
    </div>
  )
}
