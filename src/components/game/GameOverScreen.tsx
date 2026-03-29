import { useGame } from '../../context/GameContext'
import { Button } from '../ui/Button'

export function GameOverScreen() {
  const { state, dispatch } = useGame()
  const history = state.hospitalState.history
  const lastResult = history[history.length - 1]

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 max-w-3xl mx-auto">
      <h1 className="text-[48px] font-bold text-rose-700 mb-4">
        Riverside General Has Closed Its Doors
      </h1>

      <p className="text-[28px] text-slate-600 text-center mb-8">
        Cash reserves hit zero in Quarter {lastResult?.quarter ?? '?'}.
        The hospital could no longer meet its obligations.
      </p>

      {history.length > 0 && (
        <div className="w-full bg-rose-50 rounded-xl p-6 mb-8">
          <h3 className="text-[24px] font-semibold text-rose-800 mb-3">What Went Wrong</h3>
          <div className="space-y-2">
            {history.map((r, i) => (
              <div key={i} className="text-[20px]">
                <span className="font-bold">Q{r.quarter}:</span>{' '}
                <span className="text-rose-700">
                  Margin {(r.state.financial.margin * 100).toFixed(1)}%
                </span>
                {r.operationalHighlights[0] && (
                  <span className="text-slate-500"> — {r.operationalHighlights[0]}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[22px] text-slate-500 text-center mb-8">
        This is a valid outcome. Many real hospitals face this pressure.
        The question is: what decisions led here, and what would you do differently?
      </p>

      <Button size="large" onClick={() => dispatch({ type: 'RESET' })}>
        Try Again
      </Button>
    </div>
  )
}
