import { useGame } from '../../context/GameContext'
import { Button } from '../ui/Button'

export function SetupScreen() {
  const { state, dispatch } = useGame()
  const ops = state.hospitalState.operational
  const fin = state.hospitalState.financial

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 max-w-4xl mx-auto">
      <h1 className="text-[48px] font-bold text-slate-900 mb-4">
        Riverside General Hospital
      </h1>
      <p className="text-slate-500 text-[28px] mb-8">200-Bed Community Hospital</p>

      <div className="w-full grid grid-cols-2 gap-6 mb-8">
        <div className="bg-slate-50 rounded-xl p-6">
          <h2 className="text-[28px] font-semibold mb-4">Operational Status</h2>
          <div className="space-y-2 text-[22px]">
            <div className="flex justify-between"><span>Beds</span><span className="font-bold">{ops.beds.total}</span></div>
            <div className="flex justify-between"><span>Occupancy</span><span className="font-bold">{(ops.beds.occupancyRate * 100).toFixed(0)}%</span></div>
            <div className="flex justify-between"><span>Avg Length of Stay</span><span className="font-bold">{ops.lengthOfStay.toFixed(1)} days</span></div>
            <div className="flex justify-between"><span>Quality Score</span><span className="font-bold">{ops.qualityScore.toFixed(0)}/100</span></div>
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-6">
          <h2 className="text-[28px] font-semibold mb-4">Financial Status</h2>
          <div className="space-y-2 text-[22px]">
            <div className="flex justify-between"><span>Cash Reserves</span><span className="font-bold">${(fin.cashReserves / 1_000_000).toFixed(1)}M</span></div>
            <div className="flex justify-between"><span>Revenue/Quarter</span><span className="font-bold">${(fin.revenue.total / 1_000_000).toFixed(1)}M</span></div>
            <div className="flex justify-between"><span>Expenses/Quarter</span><span className="font-bold">${(fin.expenses.total / 1_000_000).toFixed(1)}M</span></div>
            <div className="flex justify-between"><span>Margin</span><span className="font-bold">{(fin.margin * 100).toFixed(1)}%</span></div>
          </div>
        </div>
      </div>

      <p className="text-slate-600 text-center mb-8 max-w-2xl">
        You are the leadership team of Riverside General. Over the next 4 quarters,
        you'll make strategic and implementation decisions that determine whether
        your hospital thrives or closes its doors.
      </p>

      <Button size="large" onClick={() => dispatch({ type: 'START_GAME' })}>
        Begin Quarter 1
      </Button>
    </div>
  )
}
