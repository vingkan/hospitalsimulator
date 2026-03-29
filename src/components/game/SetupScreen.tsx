import { useGame } from '../../context/GameContext'
import { Button } from '../ui/Button'

export function SetupScreen() {
  const { state, dispatch } = useGame()
  const ms = state.engineState.moduleStates.medsurg
  const fin = state.engineState.financials

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 max-w-4xl mx-auto">
      <h1 style={{ fontFamily: 'var(--font-display)' }} className="text-[48px] font-bold mb-2">
        Riverside General Hospital
      </h1>
      <p className="text-[28px] mb-8" style={{ color: 'var(--text-muted)' }}>200-Bed Community Hospital</p>

      <div className="w-full grid grid-cols-2 gap-6 mb-8">
        <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--primary)' }} className="text-[14px] font-semibold mb-4 uppercase tracking-wider">
            Operational Status
          </h2>
          <div className="space-y-2 text-[18px]">
            <SetupMetric label="Beds" value={String(ms.beds)} />
            <SetupMetric label="Occupancy" value={`${(ms.occupancyRate * 100).toFixed(0)}%`} />
            <SetupMetric label="Avg Length of Stay" value={`${ms.lengthOfStay.toFixed(1)} days`} />
            <SetupMetric label="Quality Score" value={`${ms.qualityScore.toFixed(0)}/100`} />
            <SetupMetric label="Nurse Ratio" value={`1:${state.engineState.programs.nurseRatio}`} />
            <SetupMetric label="Readmission Rate" value={`${(ms.readmissionRate * 100).toFixed(1)}%`} />
          </div>
        </div>

        <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--primary)' }} className="text-[14px] font-semibold mb-4 uppercase tracking-wider">
            Financial Status
          </h2>
          <div className="space-y-2 text-[18px]">
            <SetupMetric label="Cash Reserves" value={`$${(fin.cashReserves / 1_000_000).toFixed(1)}M`} />
            <SetupMetric label="Revenue/Year" value={`$${(fin.revenue.total / 1_000_000).toFixed(1)}M`} />
            <SetupMetric label="Expenses/Year" value={`$${(fin.expenses.total / 1_000_000).toFixed(1)}M`} />
            <SetupMetric label="Margin" value={`${(fin.margin * 100).toFixed(1)}%`} color={fin.margin > 0.03 ? 'var(--healthy)' : fin.margin > 0 ? 'var(--warning)' : 'var(--crisis)'} />
            <SetupMetric label="Headcount" value={`${ms.headcount} FTEs`} />
          </div>
        </div>
      </div>

      <p className="text-center mb-8 max-w-2xl text-[18px]" style={{ color: 'var(--text-muted)' }}>
        You are the leadership team of Riverside General. Over the next 5 years,
        you'll make strategic and operational decisions that determine whether
        your hospital thrives or closes its doors.
      </p>

      <Button size="large" onClick={() => dispatch({ type: 'START_GAME' })}>
        Begin Year 1
      </Button>
    </div>
  )
}

function SetupMetric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between">
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="font-semibold" style={{ fontFamily: 'var(--font-data)', color: color || 'var(--text)' }}>{value}</span>
    </div>
  )
}
