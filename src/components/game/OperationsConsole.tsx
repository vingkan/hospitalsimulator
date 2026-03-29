import { useState, useCallback } from 'react'
import type { ProgramState, OperationsConsoleState, HospitalistConsoleState, DischargeConsoleState } from '../../engine/types'
import { defaultConsoleState } from '../../context/GameContext'
import { Button } from '../ui/Button'

interface Props {
  programs: ProgramState
  onSubmit: (consoleState: OperationsConsoleState) => void
  onConsoleChange?: (consoleState: OperationsConsoleState) => void
}

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div className="relative group">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded text-[11px] max-w-[240px] text-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-normal"
        style={{ background: 'var(--surface-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
        {text}
      </div>
    </div>
  )
}

export function OperationsConsole({ programs, onSubmit, onConsoleChange }: Props) {
  const [cs, setCs] = useState<OperationsConsoleState>(() => {
    const base = defaultConsoleState(programs)
    return {
      ...base,
      maParticipation: base.maParticipation ?? false,
      commercialNegotiation: base.commercialNegotiation ?? 'none',
      admissionPosture: base.admissionPosture ?? 'balanced',
    }
  })

  const update = useCallback(<K extends keyof OperationsConsoleState>(key: K, value: OperationsConsoleState[K]) => {
    setCs(prev => {
      const next = { ...prev, [key]: value }
      onConsoleChange?.(next)
      return next
    })
  }, [onConsoleChange])

  return (
    <div className="rounded-xl p-5 h-full flex flex-col" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--primary)' }}
        className="text-[13px] font-semibold uppercase tracking-wider mb-4">
        Operations Console
      </h3>

      <div className="flex-1 space-y-4 overflow-y-auto hide-scrollbar">
        {/* Compliance Strip */}
        <div className="flex justify-between items-center mb-3 px-2 py-2 rounded-lg"
          style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', minHeight: '40px' }}>
          <ComplianceItem label="HRRP" status="ok" />
          <ComplianceItem label="VBP" status="ok" />
          <ComplianceItem label="HAC" status="ok" />
        </div>

        {/* Staffing */}
        <Section title="Staffing & Labor" defaultExpanded={true}>
          <SliderControl label="Nurse Ratio" value={cs.nurseRatio} min={4} max={8} step={1}
            format={v => `1:${v}`}
            color={cs.nurseRatio <= 5 ? 'var(--healthy)' : cs.nurseRatio <= 6 ? 'var(--warning)' : 'var(--crisis)'}
            onChange={v => update('nurseRatio', v)}
            tooltip="Patients per nurse. Lower ratio = better care, higher labor cost. 4:1 is ICU-level, 8:1 is dangerously thin." />
          <SliderControl label="Compensation" value={cs.compensationChange} min={-5} max={10} step={1}
            format={v => `${v > 0 ? '+' : ''}${v}%`}
            onChange={v => update('compensationChange', v)}
            tooltip="Annual pay adjustment vs baseline. Cuts save money but increase turnover and overtime. Raises improve retention and quality." />
        </Section>

        {/* Programs */}
        <Section title="Clinical Programs" defaultExpanded={true}>
          <Toggle label="Hospitalist Program" active={cs.hospitalist.active}
            onToggle={(on) => {
              if (on) {
                update('hospitalist', { active: true, workforce: 'employed', cdiIntensity: 'light', documentationTraining: false } as HospitalistConsoleState)
              } else {
                update('hospitalist', { active: false })
              }
            }}
            tooltip="Dedicated hospital doctors managing inpatient care. Improves documentation, coding accuracy, and length of stay. Costs $3.5M/year." />
          {cs.hospitalist.active && (
            <div className="pl-4 space-y-2 mt-1">
              <SegmentControl label="Workforce"
                options={[{ value: 'employed', label: 'Employed' }, { value: 'contracted', label: 'Contracted' }]}
                value={cs.hospitalist.workforce}
                onChange={v => update('hospitalist', { ...cs.hospitalist, workforce: v as 'employed' | 'contracted' } as HospitalistConsoleState)}
                tooltip="Employed hospitalists have higher effectiveness but cost more. Contracted are cheaper but less integrated." />
              <SegmentControl label="CDI Intensity"
                options={[{ value: 'light', label: 'Light' }, { value: 'aggressive', label: 'Aggressive' }]}
                value={cs.hospitalist.cdiIntensity}
                onChange={v => update('hospitalist', { ...cs.hospitalist, cdiIntensity: v as 'light' | 'aggressive' } as HospitalistConsoleState)}
                tooltip="Clinical Documentation Improvement. Aggressive CDI captures higher DRG weights but requires compensation to retain staff." />
              <Toggle label="Documentation Training" active={cs.hospitalist.documentationTraining}
                onToggle={v => update('hospitalist', { ...cs.hospitalist, documentationTraining: v } as HospitalistConsoleState)}
                tooltip="Trains hospitalists to document more precisely. Improves DRG accuracy and supports audit defense for aggressive admissions." />
            </div>
          )}

          <Toggle label="Discharge Coordination" active={cs.dischargeCoordination.active}
            onToggle={(on) => {
              if (on) {
                update('dischargeCoordination', { active: true, model: 'dedicated_planners', postAcutePartnerships: false } as DischargeConsoleState)
              } else {
                update('dischargeCoordination', { active: false })
              }
            }}
            tooltip="Speeds patient transitions out of the hospital. Reduces length of stay and frees beds for new admissions. $400K-$1.2M/year." />
          {cs.dischargeCoordination.active && (
            <div className="pl-4 space-y-2 mt-1">
              <SegmentControl label="Model"
                options={[{ value: 'dedicated_planners', label: 'Dedicated' }, { value: 'nurse_led', label: 'Nurse-led' }]}
                value={cs.dischargeCoordination.model}
                onChange={v => update('dischargeCoordination', { ...cs.dischargeCoordination, model: v as 'dedicated_planners' | 'nurse_led' } as DischargeConsoleState)}
                tooltip="Dedicated planners are more effective but costlier. Nurse-led is cheaper but adds to nursing workload." />
              <Toggle label="Post-Acute Partnerships" active={cs.dischargeCoordination.postAcutePartnerships}
                onToggle={v => update('dischargeCoordination', { ...cs.dischargeCoordination, postAcutePartnerships: v } as DischargeConsoleState)}
                tooltip="Formal agreements with rehab facilities and SNFs. Reduces readmissions by ensuring smooth handoffs after discharge." />
            </div>
          )}
        </Section>

        {/* Revenue Strategy */}
        <Section title="Revenue Strategy" defaultExpanded={false}>
          <Toggle label="Medicare Advantage" active={cs.maParticipation}
            onToggle={v => update('maParticipation', v)}
            tooltip="Opt in to MA contracts. Guarantees +8% patient volume but each MA patient pays only 88% of standard Medicare rate." />
          <SegmentControl label="Commercial Negotiation"
            options={[
              { value: 'none', label: 'None' },
              { value: 'standard', label: 'Standard ($1M)' },
              { value: 'aggressive', label: 'Aggressive ($2.5M)' },
            ]}
            value={cs.commercialNegotiation}
            onChange={v => update('commercialNegotiation', v as 'none' | 'standard' | 'aggressive')}
            tooltip="Invest in negotiating better rates with commercial insurers. Standard costs $1M/year (requires quality > 60). Aggressive costs $2.5M/year (requires quality > 75 + surgical expansion)." />
          <SegmentControl label="Admission Posture"
            options={[
              { value: 'conservative', label: 'Conservative' },
              { value: 'balanced', label: 'Balanced' },
              { value: 'aggressive', label: 'Aggressive' },
            ]}
            value={cs.admissionPosture}
            onChange={v => update('admissionPosture', v as 'conservative' | 'balanced' | 'aggressive')}
            tooltip="How aggressively you classify patients as inpatient vs observation. Aggressive = more revenue per patient but audit risk. Conservative = safe but lower revenue." />
        </Section>

        {/* Infrastructure */}
        <Section title="Infrastructure & Supply" defaultExpanded={false}>
          <SegmentControl label="Supply Tier"
            options={[{ value: 'budget', label: 'Budget' }, { value: 'standard', label: 'Standard' }, { value: 'premium', label: 'Premium' }]}
            value={cs.supplyTier}
            onChange={v => update('supplyTier', v as 'budget' | 'standard' | 'premium')}
            tooltip="Budget saves money but hurts quality. Premium costs more but improves outcomes. Standard is the middle ground." />
          <SegmentControl label="Surgical Expansion"
            options={[{ value: 'none', label: 'None' }, { value: 'minor', label: 'Minor ($4M)' }, { value: 'major', label: 'Major ($16M)' }]}
            value={cs.surgicalExpansion}
            onChange={v => update('surgicalExpansion', v as 'none' | 'minor' | 'major')}
            tooltip="Add OR capacity. Minor ($4M) adds 80 cases/year. Major ($16M) adds 200 cases/year. High-margin but requires med/surg bed capacity." />
        </Section>
      </div>

      <Button size="large" className="w-full mt-4" onClick={() => onSubmit(cs)}>
        Advance Year
      </Button>
    </div>
  )
}

function ComplianceItem({ label, status, amount }: { label: string; status: 'ok' | 'penalty' | 'bonus'; amount?: string }) {
  const color = status === 'ok' ? 'var(--healthy)' : status === 'penalty' ? 'var(--crisis)' : 'var(--healthy)'
  return (
    <div className="text-center">
      <p className="text-[10px] uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-[13px] font-semibold" style={{ fontFamily: 'var(--font-data)', color }}>
        {status === 'ok' ? '✓' : amount || '—'}
      </p>
    </div>
  )
}

function Section({ title, children, defaultExpanded = true }: {
  title: string; children: React.ReactNode; defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  return (
    <div>
      <button onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between py-1 cursor-pointer"
        style={{ background: 'none', border: 'none' }}>
        <p style={{ fontFamily: 'var(--font-display)', color: 'var(--text-muted)' }}
          className="text-[11px] font-semibold uppercase tracking-wider">
          {title}
        </p>
        <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
          {expanded ? '▼' : '►'}
        </span>
      </button>
      {expanded && (
        <div className="space-y-2 mt-2" style={{ transition: 'all 0.2s ease-out' }}>
          {children}
        </div>
      )}
    </div>
  )
}

function SliderControl({ label, value, min, max, step, format, color, onChange, tooltip }: {
  label: string; value: number; min: number; max: number; step: number
  format: (v: number) => string; color?: string
  onChange: (v: number) => void; tooltip?: string
}) {
  return (
    <div>
      <div className="flex justify-between text-[13px] mb-1">
        {tooltip ? <Tooltip text={tooltip}><span style={{ color: 'var(--text-muted)' }}>{label}</span></Tooltip> : <span style={{ color: 'var(--text-muted)' }}>{label}</span>}
        <span style={{ fontFamily: 'var(--font-data)', color: color || 'var(--text)' }} className="font-semibold">
          {format(value)}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{ background: 'var(--surface-elevated)', accentColor: 'var(--primary)' }}
      />
    </div>
  )
}

function Toggle({ label, active, onToggle, tooltip }: { label: string; active: boolean; onToggle: (v: boolean) => void; tooltip?: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      {tooltip ? <Tooltip text={tooltip}><span className="text-[14px]" style={{ color: 'var(--text)' }}>{label}</span></Tooltip> : <span className="text-[14px]" style={{ color: 'var(--text)' }}>{label}</span>}
      <button
        onClick={() => onToggle(!active)}
        className="w-11 h-6 rounded-full relative cursor-pointer transition-colors"
        style={{ background: active ? 'var(--primary-muted)' : 'var(--surface-elevated)', border: active ? 'none' : '1px solid var(--border)' }}
        role="switch"
        aria-checked={active}
      >
        <div className="w-4.5 h-4.5 rounded-full bg-white absolute top-[3px] transition-all"
          style={{ left: active ? '22px' : '3px', width: '18px', height: '18px' }} />
      </button>
    </div>
  )
}

function SegmentControl({ label, options, value, onChange, tooltip }: {
  label: string; options: { value: string; label: string }[]; value: string
  onChange: (v: string) => void; tooltip?: string
}) {
  return (
    <div>
      {tooltip ? <Tooltip text={tooltip}><p className="text-[12px] mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p></Tooltip> : <p className="text-[12px] mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>}
      <div className="flex gap-1">
        {options.map(opt => (
          <button key={opt.value}
            onClick={() => onChange(opt.value)}
            className="px-3 py-1 rounded text-[12px] cursor-pointer transition-colors"
            style={{
              fontFamily: 'var(--font-body)',
              background: value === opt.value ? 'var(--primary-muted)' : 'var(--surface-elevated)',
              color: value === opt.value ? 'var(--text)' : 'var(--text-muted)',
              fontWeight: value === opt.value ? 600 : 400,
            }}>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
