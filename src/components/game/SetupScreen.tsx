import { useState } from 'react'
import { useGame } from '../../context/GameContext'
import { Button } from '../ui/Button'
import { ALL_PROFILES } from '../../engine/profiles'
import type { HospitalProfile } from '../../engine/types'

const ACCENT_COLORS: Record<HospitalProfile['id'], string> = {
  suburban: 'var(--primary)',      // #2DD4BF teal
  safety_net: 'var(--warning)',    // #FBBF24 amber
  rural: 'var(--healthy)',         // #34D399 emerald
}

const TARGET_MARGINS: Record<HospitalProfile['id'], string> = {
  suburban: '1-3%',
  safety_net: '-2% to 1%',
  rural: '0-2%',
}

export function SetupScreen() {
  const { dispatch } = useGame()
  const [selectedId, setSelectedId] = useState<HospitalProfile['id']>('suburban')

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 max-w-5xl mx-auto">
      <h1 style={{ fontFamily: 'var(--font-display)' }} className="text-[48px] font-bold mb-2">
        Hospital Simulator
      </h1>
      <p className="text-[28px] mb-10" style={{ color: 'var(--text-muted)' }}>
        Choose your hospital
      </p>

      <div className="w-full flex flex-wrap justify-center gap-6 mb-10" role="radiogroup" aria-label="Hospital profile">
        {ALL_PROFILES.map(profile => {
          const accent = ACCENT_COLORS[profile.id]
          const selected = selectedId === profile.id
          return (
            <div
              key={profile.id}
              role="radio"
              aria-checked={selected}
              tabIndex={0}
              onClick={() => setSelectedId(profile.id)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(profile.id) } }}
              className="flex-1 min-w-[300px] max-w-[400px] rounded-xl p-6 cursor-pointer transition-colors"
              style={{
                background: 'var(--surface)',
                border: selected ? `2px solid ${accent}` : '1px solid var(--border)',
                padding: selected ? '23px' : '24px', // compensate for thicker border
              }}
            >
              <h2 style={{ fontFamily: 'var(--font-display)', color: accent }} className="text-[24px] font-bold mb-1">
                {profile.name}
              </h2>
              <p className="text-[14px] mb-4" style={{ color: 'var(--text-muted)' }}>
                {profile.description}
              </p>
              <div className="flex justify-between">
                <StatItem label="Beds" value={String(profile.beds)} />
                <StatItem label="Commercial" value={`${(profile.payerMix.commercial * 100).toFixed(0)}%`} />
                <StatItem label="Target Margin" value={TARGET_MARGINS[profile.id]} />
              </div>
            </div>
          )
        })}
      </div>

      <Button size="large" onClick={() => dispatch({ type: 'START_GAME' })}>
        Begin Year 1
      </Button>
    </div>
  )
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-[11px] uppercase tracking-wider mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-muted)' }}>
        {label}
      </p>
      <p className="text-[18px] font-semibold" style={{ fontFamily: 'var(--font-data)' }}>
        {value}
      </p>
    </div>
  )
}
