import { useState } from 'react'
import type { DecisionPackage, SelectedDecision } from '../../engine/types'
import { Card } from '../ui/Card'

interface DecisionCardProps {
  pkg: DecisionPackage
  onDecide: (decision: SelectedDecision) => void
  expanded: boolean
  onToggle: () => void
}

export function DecisionCard({ pkg, onDecide, expanded, onToggle }: DecisionCardProps) {
  const [strategicChoice, setStrategicChoice] = useState<string | null>(null)
  const [implChoices, setImplChoices] = useState<Record<string, string>>({})

  const isAffirmative = strategicChoice && strategicChoice !== 'skip' && strategicChoice !== 'maintain'

  const handleSubmit = () => {
    if (!strategicChoice) return
    onDecide({
      packageId: pkg.id,
      strategicOptionId: strategicChoice,
      implementationOptionIds: Object.values(implChoices),
    })
  }

  const requiredImplChoices = pkg.implementationChoices.filter(
    ic => !ic.dependsOnStrategic || ic.dependsOnStrategic === strategicChoice
  )
  const allImplChosen = requiredImplChoices.every(ic => implChoices[ic.id])
  const canSubmit = strategicChoice && (!isAffirmative || allImplChosen)

  return (
    <Card className="mb-4">
      <div
        className="flex justify-between items-center cursor-pointer"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle() } }}
      >
        <div>
          <h3 className="text-[28px] font-semibold">{pkg.name}</h3>
          <p className="text-slate-500 text-[20px]">{pkg.description}</p>
        </div>
        <span className="text-[28px] text-slate-400">{expanded ? '−' : '+'}</span>
      </div>

      {expanded && (
        <div className="mt-4 space-y-4">
          <div>
            <p className="font-semibold text-[22px] mb-2">{pkg.strategicChoice.question}</p>
            <div className="space-y-2">
              {pkg.strategicChoice.options.map(opt => (
                <Card
                  key={opt.id}
                  selected={strategicChoice === opt.id}
                  onClick={() => {
                    setStrategicChoice(opt.id)
                    setImplChoices({})
                  }}
                  className="!p-3"
                >
                  <p className="font-semibold text-[22px]">{opt.label}</p>
                  <p className="text-slate-500 text-[18px]">{opt.description}</p>
                </Card>
              ))}
            </div>
          </div>

          {isAffirmative && requiredImplChoices.map(ic => (
            <div key={ic.id}>
              <p className="font-semibold text-[22px] mb-2">{ic.question}</p>
              <div className="space-y-2">
                {ic.options.map(opt => (
                  <Card
                    key={opt.id}
                    selected={implChoices[ic.id] === opt.id}
                    onClick={() => setImplChoices(prev => ({ ...prev, [ic.id]: opt.id }))}
                    className="!p-3"
                  >
                    <p className="font-semibold text-[20px]">{opt.label}</p>
                    <p className="text-slate-500 text-[16px]">{opt.description}</p>
                  </Card>
                ))}
              </div>
            </div>
          ))}

          {canSubmit && (
            <button
              onClick={handleSubmit}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold text-[22px] hover:bg-blue-700 transition-colors"
            >
              Confirm Decision
            </button>
          )}
        </div>
      )}
    </Card>
  )
}
