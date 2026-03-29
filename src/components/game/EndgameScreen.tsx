import { useGame } from '../../context/GameContext'
import { Button } from '../ui/Button'
import { MetricsChart } from './MetricsChart'

const DEBRIEF_PROMPTS = [
  {
    title: 'Surgery expansion ripple effects',
    prompt: 'You expanded surgery last year. What happened to med/surg?',
  },
  {
    title: 'Hospitalist program underperformance',
    prompt: 'The hospitalist program isn\'t performing. Why not? Look at compensation.',
  },
  {
    title: 'Efficiency vs. quality tradeoffs',
    prompt: 'You cut supply costs AND sped up discharge. What happened to readmissions?',
  },
  {
    title: 'Unexpected consequences',
    prompt: 'Which of your decisions created unexpected consequences in a different department?',
  },
  {
    title: 'Hindsight strategy',
    prompt: 'If you played again, which Year 1 decision would you change?',
  },
]

export function EndgameScreen() {
  const { state, dispatch } = useGame()
  const fin = state.engineState.financials
  const ms = state.engineState.moduleStates.medsurg
  const history = state.engineState.history

  const nationalMedianMargin = 0.02
  const beat = fin.margin > nationalMedianMargin

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto">
      <h1 style={{ fontFamily: 'var(--font-display)' }} className="text-[48px] font-bold text-center mb-2">
        Riverside General: 5-Year Review
      </h1>
      <p style={{ fontFamily: 'var(--font-display)' }} className={`text-[32px] font-bold text-center mb-8`}>
        <span style={{ color: fin.margin >= 0.03 ? 'var(--healthy)' : fin.margin > 0 ? 'var(--warning)' : 'var(--crisis)' }}>
          {fin.margin >= 0.03 ? 'Your hospital is thriving.' :
           fin.margin > 0 ? 'Your hospital survived, barely.' :
           'Your hospital is in crisis.'}
        </span>
      </p>

      {/* Final metrics */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <MetricBox label="Final Margin" value={`${(fin.margin * 100).toFixed(1)}%`}
          level={fin.margin >= 0.03 ? 'healthy' : fin.margin > 0 ? 'warning' : 'crisis'} />
        <MetricBox label="Cash Reserves" value={`$${(fin.cashReserves / 1_000_000).toFixed(1)}M`}
          level={fin.cashReserves > 30_000_000 ? 'healthy' : 'warning'} />
        <MetricBox label="Quality Score" value={`${ms.qualityScore.toFixed(0)}/100`}
          level={ms.qualityScore > 70 ? 'healthy' : ms.qualityScore > 50 ? 'warning' : 'crisis'} />
        <MetricBox label="vs National" value={beat ? 'Above Median' : 'Below Median'}
          level={beat ? 'healthy' : 'crisis'} />
      </div>

      {/* Year-over-year trends chart */}
      <div className="mb-8">
        <MetricsChart history={history} />
      </div>

      {/* Year-by-year summary */}
      <div className="rounded-xl p-6 mb-8" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--primary)' }} className="text-[14px] font-semibold uppercase tracking-wider mb-4">
          Year-by-Year
        </h3>
        <div className="space-y-3">
          {history.map((r, i) => (
            <div key={i} className="flex items-center gap-4 text-[18px]">
              <span className="font-bold w-16" style={{ fontFamily: 'var(--font-display)' }}>Y{r.year}</span>
              <span className="px-3 py-1 rounded" style={{
                fontFamily: 'var(--font-data)',
                background: r.financials.margin >= 0.03 ? '#064E3B40' :
                  r.financials.margin > 0 ? '#78350F40' : '#9F122340',
                color: r.financials.margin >= 0.03 ? 'var(--healthy)' :
                  r.financials.margin > 0 ? 'var(--warning)' : 'var(--crisis)',
              }}>
                {(r.financials.margin * 100).toFixed(1)}% margin
              </span>
              <span style={{ color: 'var(--text-muted)' }}>Event: {r.event.title}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Debrief prompts */}
      <div className="mb-8">
        <h3 style={{ fontFamily: 'var(--font-display)' }} className="text-[28px] font-semibold mb-4">
          Now think about our product...
        </h3>
        <div className="space-y-4">
          {DEBRIEF_PROMPTS.map((dp, i) => (
            <div key={i} className="rounded-xl p-5" style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
            }}>
              <p className="text-[18px] font-semibold mb-2" style={{ color: 'var(--primary)' }}>
                {i + 1}. {dp.title}
              </p>
              <p className="text-[16px]" style={{ color: 'var(--text-muted)' }}>{dp.prompt}</p>
            </div>
          ))}
        </div>
      </div>

      <Button size="large" className="w-full" onClick={() => dispatch({ type: 'RESET' })}>
        Play Again
      </Button>
    </div>
  )
}

function MetricBox({ label, value, level }: { label: string; value: string; level: 'healthy' | 'warning' | 'crisis' }) {
  const colors = {
    healthy: { bg: '#064E3B40', text: 'var(--healthy)' },
    warning: { bg: '#78350F40', text: 'var(--warning)' },
    crisis: { bg: '#9F122340', text: 'var(--crisis)' },
  }
  const c = colors[level]
  return (
    <div className="rounded-xl p-4 text-center" style={{ background: c.bg }}>
      <p style={{ fontFamily: 'var(--font-display)', color: c.text }} className="text-[36px] font-bold">{value}</p>
      <p className="text-[14px]" style={{ color: 'var(--text-muted)' }}>{label}</p>
    </div>
  )
}
