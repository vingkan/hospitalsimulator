import { useGame } from '../../context/GameContext'
import { Button } from '../ui/Button'

const DEBRIEF_PROMPTS = [
  {
    title: 'CDI uplift vs discharge throughput',
    prompt: 'You just saw both levers in action. Which created more value in your hospital? Now think about our product: if we build for CDI uplift, we\'re increasing the DRG accuracy multiplier. If we build for discharge throughput, we\'re reducing LOS and freeing beds. Which matters more for the hospitals we sell to?',
  },
  {
    title: 'The feature clinicians don\'t use',
    prompt: 'You saw that a good strategy with bad implementation fails. Our pre-admission feature sounds right to buyers but clinicians don\'t use it. What did the game teach you about the difference between what hospital leadership wants to buy and what clinicians will actually adopt?',
  },
  {
    title: 'Where does the information actually live?',
    prompt: 'In the simulation, your DRG accuracy improved when documentation captured the full patient picture. Our product shifted from ambient scribing to chart-based solutions for the same reason. What does the game tell you about where we should look for the next source of documentation improvement?',
  },
  {
    title: 'Building for the wrong workflow',
    prompt: 'In the game, you saw that understanding the exact clinical workflow determines whether a program creates value. We built POA on H&P notes, which is useless because all H&P conditions are already assumed to be POA. What does the game teach you about the cost of building features without understanding the clinical workflow deeply enough?',
  },
  {
    title: 'The feature the customer demanded that didn\'t work',
    prompt: 'In the game, you learned that external constraints are real but your response to them matters. Our customer insisted on EHR write-back, we built it, and it was too clunky. That work came at the cost of other CDI or documentation features. What does the game teach you about navigating customer demands vs. building what actually works?',
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
        <span style={{ color: fin.margin > 0.05 ? 'var(--healthy)' : fin.margin > 0 ? 'var(--warning)' : 'var(--crisis)' }}>
          {fin.margin > 0.05 ? 'Your hospital is thriving.' :
           fin.margin > 0 ? 'Your hospital survived, barely.' :
           'Your hospital is in crisis.'}
        </span>
      </p>

      {/* Final metrics */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <MetricBox label="Final Margin" value={`${(fin.margin * 100).toFixed(1)}%`}
          level={fin.margin > 0.05 ? 'healthy' : fin.margin > 0 ? 'warning' : 'crisis'} />
        <MetricBox label="Cash Reserves" value={`$${(fin.cashReserves / 1_000_000).toFixed(1)}M`}
          level={fin.cashReserves > 30_000_000 ? 'healthy' : 'warning'} />
        <MetricBox label="Quality Score" value={`${ms.qualityScore.toFixed(0)}/100`}
          level={ms.qualityScore > 70 ? 'healthy' : ms.qualityScore > 50 ? 'warning' : 'crisis'} />
        <MetricBox label="vs National" value={beat ? 'Above Median' : 'Below Median'}
          level={beat ? 'healthy' : 'crisis'} />
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
                background: r.financials.margin > 0.05 ? '#064E3B40' :
                  r.financials.margin > 0 ? '#78350F40' : '#9F122340',
                color: r.financials.margin > 0.05 ? 'var(--healthy)' :
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
