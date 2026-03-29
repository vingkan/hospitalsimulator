import { useGame } from '../../context/GameContext'
import { Button } from '../ui/Button'

export function GameOverScreen() {
  const { state, dispatch } = useGame()
  const history = state.engineState.history
  const lastResult = history[history.length - 1]

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 max-w-3xl mx-auto">
      <h1 style={{ fontFamily: 'var(--font-display)', color: 'var(--crisis)' }} className="text-[48px] font-bold mb-4">
        Riverside General Has Closed Its Doors
      </h1>

      <p className="text-[22px] text-center mb-8" style={{ color: 'var(--text-muted)' }}>
        Cash reserves hit zero in Year {lastResult?.year ?? '?'}.
        The hospital could no longer meet its obligations.
      </p>

      {history.length > 0 && (
        <div className="w-full rounded-xl p-6 mb-8" style={{ background: '#9F122320', border: '1px solid var(--crisis)' }}>
          <h3 style={{ fontFamily: 'var(--font-display)' }} className="text-[20px] font-semibold mb-3" >
            What Went Wrong
          </h3>
          <div className="space-y-2">
            {history.map((r, i) => (
              <div key={i} className="text-[16px]">
                <span className="font-bold" style={{ fontFamily: 'var(--font-display)' }}>Y{r.year}:</span>{' '}
                <span style={{ fontFamily: 'var(--font-data)', color: 'var(--crisis)' }}>
                  Margin {(r.financials.margin * 100).toFixed(1)}%
                </span>
                <span style={{ color: 'var(--text-muted)' }}> — Event: {r.event.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[18px] text-center mb-8" style={{ color: 'var(--text-muted)' }}>
        This is a valid outcome. Many real hospitals face this pressure.
        The question is: what decisions led here, and what would you do differently?
      </p>

      <Button size="large" onClick={() => dispatch({ type: 'RESET' })}>
        Try Again
      </Button>
    </div>
  )
}
