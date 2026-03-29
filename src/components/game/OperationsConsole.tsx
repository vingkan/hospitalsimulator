import { useState, useCallback } from 'react'
import type { ProgramState, OperationsConsoleState, HospitalistConsoleState, DischargeConsoleState } from '../../engine/types'
import { defaultConsoleState } from '../../context/GameContext'
import { Button } from '../ui/Button'

interface Props {
  programs: ProgramState
  onSubmit: (consoleState: OperationsConsoleState) => void
  onConsoleChange?: (consoleState: OperationsConsoleState) => void
}

export function OperationsConsole({ programs, onSubmit, onConsoleChange }: Props) {
  const [cs, setCs] = useState<OperationsConsoleState>(() => defaultConsoleState(programs))

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
        {/* Staffing */}
        <Section title="Staffing & Labor">
          <SliderControl label="Nurse Ratio" value={cs.nurseRatio} min={4} max={8} step={1}
            format={v => `1:${v}`}
            color={cs.nurseRatio <= 5 ? 'var(--healthy)' : cs.nurseRatio <= 6 ? 'var(--warning)' : 'var(--crisis)'}
            onChange={v => update('nurseRatio', v)} />
          <SliderControl label="Compensation" value={cs.compensationChange} min={-5} max={10} step={1}
            format={v => `${v > 0 ? '+' : ''}${v}%`}
            onChange={v => update('compensationChange', v)} />
        </Section>

        {/* Programs */}
        <Section title="Clinical Programs">
          <Toggle label="Hospitalist Program" active={cs.hospitalist.active}
            onToggle={(on) => {
              if (on) {
                update('hospitalist', { active: true, workforce: 'employed', cdiIntensity: 'light', documentationTraining: false } as HospitalistConsoleState)
              } else {
                update('hospitalist', { active: false })
              }
            }} />
          {cs.hospitalist.active && (
            <div className="pl-4 space-y-2 mt-1">
              <SegmentControl label="Workforce"
                options={[{ value: 'employed', label: 'Employed' }, { value: 'contracted', label: 'Contracted' }]}
                value={cs.hospitalist.workforce}
                onChange={v => update('hospitalist', { ...cs.hospitalist, workforce: v as 'employed' | 'contracted' } as HospitalistConsoleState)} />
              <SegmentControl label="CDI Intensity"
                options={[{ value: 'light', label: 'Light' }, { value: 'aggressive', label: 'Aggressive' }]}
                value={cs.hospitalist.cdiIntensity}
                onChange={v => update('hospitalist', { ...cs.hospitalist, cdiIntensity: v as 'light' | 'aggressive' } as HospitalistConsoleState)} />
              <Toggle label="Documentation Training" active={cs.hospitalist.documentationTraining}
                onToggle={v => update('hospitalist', { ...cs.hospitalist, documentationTraining: v } as HospitalistConsoleState)} />
            </div>
          )}

          <Toggle label="Discharge Coordination" active={cs.dischargeCoordination.active}
            onToggle={(on) => {
              if (on) {
                update('dischargeCoordination', { active: true, model: 'dedicated_planners', postAcutePartnerships: false } as DischargeConsoleState)
              } else {
                update('dischargeCoordination', { active: false })
              }
            }} />
          {cs.dischargeCoordination.active && (
            <div className="pl-4 space-y-2 mt-1">
              <SegmentControl label="Model"
                options={[{ value: 'dedicated_planners', label: 'Dedicated' }, { value: 'nurse_led', label: 'Nurse-led' }]}
                value={cs.dischargeCoordination.model}
                onChange={v => update('dischargeCoordination', { ...cs.dischargeCoordination, model: v as 'dedicated_planners' | 'nurse_led' } as DischargeConsoleState)} />
              <Toggle label="Post-Acute Partnerships" active={cs.dischargeCoordination.postAcutePartnerships}
                onToggle={v => update('dischargeCoordination', { ...cs.dischargeCoordination, postAcutePartnerships: v } as DischargeConsoleState)} />
            </div>
          )}
        </Section>

        {/* Infrastructure */}
        <Section title="Infrastructure & Supply">
          <SegmentControl label="Supply Tier"
            options={[{ value: 'budget', label: 'Budget' }, { value: 'standard', label: 'Standard' }, { value: 'premium', label: 'Premium' }]}
            value={cs.supplyTier}
            onChange={v => update('supplyTier', v as 'budget' | 'standard' | 'premium')} />
          <SegmentControl label="Surgical Expansion"
            options={[{ value: 'none', label: 'None' }, { value: 'minor', label: 'Minor ($4M)' }, { value: 'major', label: 'Major ($16M)' }]}
            value={cs.surgicalExpansion}
            onChange={v => update('surgicalExpansion', v as 'none' | 'minor' | 'major')} />
        </Section>
      </div>

      <Button size="large" className="w-full mt-4" onClick={() => onSubmit(cs)}>
        Advance Year
      </Button>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontFamily: 'var(--font-display)', color: 'var(--text-muted)' }}
        className="text-[11px] font-semibold uppercase tracking-wider mb-2">
        {title}
      </p>
      <div className="space-y-2">
        {children}
      </div>
    </div>
  )
}

function SliderControl({ label, value, min, max, step, format, color, onChange }: {
  label: string; value: number; min: number; max: number; step: number
  format: (v: number) => string; color?: string
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex justify-between text-[13px] mb-1">
        <span style={{ color: 'var(--text-muted)' }}>{label}</span>
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

function Toggle({ label, active, onToggle }: { label: string; active: boolean; onToggle: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[14px]" style={{ color: 'var(--text)' }}>{label}</span>
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

function SegmentControl({ label, options, value, onChange }: {
  label: string; options: { value: string; label: string }[]; value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <p className="text-[12px] mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
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
