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
  const fin = state.hospitalState.financial
  const ops = state.hospitalState.operational
  const history = state.hospitalState.history

  // Compare to national median
  const nationalMedianMargin = 0.02
  const beat = fin.margin > nationalMedianMargin

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto">
      <h1 className="text-[48px] font-bold text-center mb-2">
        Riverside General: Year End
      </h1>
      <p className={`text-[32px] font-bold text-center mb-8 ${
        fin.margin > 0.05 ? 'text-emerald-600' :
        fin.margin > 0 ? 'text-amber-600' :
        'text-rose-600'
      }`}>
        {fin.margin > 0.05 ? 'Your hospital is thriving.' :
         fin.margin > 0 ? 'Your hospital survived, barely.' :
         'Your hospital is in crisis.'}
      </p>

      {/* Final metrics */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <MetricBox label="Final Margin" value={`${(fin.margin * 100).toFixed(1)}%`} color={fin.margin > 0.05 ? 'emerald' : fin.margin > 0 ? 'amber' : 'rose'} />
        <MetricBox label="Cash Reserves" value={`$${(fin.cashReserves / 1_000_000).toFixed(1)}M`} color={fin.cashReserves > 5_000_000 ? 'emerald' : 'amber'} />
        <MetricBox label="Quality Score" value={`${ops.qualityScore.toFixed(0)}/100`} color={ops.qualityScore > 70 ? 'emerald' : ops.qualityScore > 50 ? 'amber' : 'rose'} />
        <MetricBox label="vs National" value={beat ? 'Above Median' : 'Below Median'} color={beat ? 'emerald' : 'rose'} />
      </div>

      {/* Quarter-by-quarter summary */}
      <div className="bg-slate-50 rounded-xl p-6 mb-8">
        <h3 className="text-[24px] font-semibold mb-4">Quarter-by-Quarter</h3>
        <div className="space-y-3">
          {history.map((r, i) => (
            <div key={i} className="flex items-center gap-4 text-[20px]">
              <span className="font-bold w-12">Q{r.quarter}</span>
              <span className={`px-3 py-1 rounded ${
                r.state.financial.margin > 0.05 ? 'bg-emerald-100 text-emerald-700' :
                r.state.financial.margin > 0 ? 'bg-amber-100 text-amber-700' :
                'bg-rose-100 text-rose-700'
              }`}>
                {(r.state.financial.margin * 100).toFixed(1)}% margin
              </span>
              <span className="text-slate-500">Event: {r.event.title}</span>
              {r.operationalHighlights[0] && (
                <span className="text-slate-400 truncate">{r.operationalHighlights[0]}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Debrief prompts */}
      <div className="mb-8">
        <h3 className="text-[28px] font-semibold mb-4">
          Now think about our product...
        </h3>
        <div className="space-y-4">
          {DEBRIEF_PROMPTS.map((dp, i) => (
            <div key={i} className="border-2 border-slate-200 rounded-xl p-5 bg-white">
              <p className="text-[20px] font-semibold text-slate-700 mb-2">{i + 1}. {dp.title}</p>
              <p className="text-[20px] text-slate-600">{dp.prompt}</p>
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

const COLOR_MAP: Record<string, { bg: string; text: string }> = {
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-700' },
}

function MetricBox({ label, value, color }: { label: string; value: string; color: string }) {
  const colors = COLOR_MAP[color] ?? COLOR_MAP.amber
  return (
    <div className={`${colors.bg} rounded-xl p-4 text-center`}>
      <p className={`text-[36px] font-bold ${colors.text}`}>{value}</p>
      <p className="text-[18px] text-slate-500">{label}</p>
    </div>
  )
}
