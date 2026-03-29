export function GuidePage() {
  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-[36px] font-bold">Facilitator Guide</h1>
        <a href="#" className="text-blue-600 text-[22px] hover:underline">Back to Game</a>
      </div>

      <section className="mb-8">
        <h2 className="text-[28px] font-semibold mb-3">Pre-Session Prep</h2>
        <ul className="space-y-2 text-[22px] text-slate-700">
          <li>Open the game on a projector or shared screen</li>
          <li>Have 6-12 team members in the room (cross-functional works best)</li>
          <li>Plan for 45-75 minutes total</li>
          <li>The facilitator drives the laptop. The team discusses and decides together.</li>
          <li>There are no wrong answers. The goal is building intuition, not winning.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-[28px] font-semibold mb-3">How to Facilitate Each Quarter</h2>
        <div className="space-y-4">
          <div className="bg-slate-50 rounded-xl p-5">
            <h3 className="text-[22px] font-semibold mb-2">1. Review the Dashboard (~2 min)</h3>
            <p className="text-[20px] text-slate-600">
              "Let's look at where our hospital stands." Point out key metrics: bed occupancy, LOS, margin, cash.
              Ask the team: "What's our biggest challenge right now?"
            </p>
          </div>
          <div className="bg-slate-50 rounded-xl p-5">
            <h3 className="text-[22px] font-semibold mb-2">2. Make Decisions (~7 min)</h3>
            <p className="text-[20px] text-slate-600">
              Expand each decision card. Read the strategic question aloud. Let the team debate.
              For implementation choices, ask: "What are the trade-offs here?" Don't rush. The discussion IS the learning.
            </p>
          </div>
          <div className="bg-slate-50 rounded-xl p-5">
            <h3 className="text-[22px] font-semibold mb-2">3. Review Results (~3 min)</h3>
            <p className="text-[20px] text-slate-600">
              After the dramatic reveal, read the narrative aloud. Ask: "Why did that happen?"
              and "What would you do differently?" Connect the operational changes to financial outcomes.
            </p>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-[28px] font-semibold mb-3">Key Aha Moments to Surface</h2>
        <ul className="space-y-3 text-[22px] text-slate-700">
          <li>
            <span className="font-semibold">Indirect revenue is real but invisible.</span>{' '}
            A hospitalist program "loses money" but freed beds can generate 2-3x the subsidy in surgical revenue.
          </li>
          <li>
            <span className="font-semibold">Overtime is nonlinear.</span>{' '}
            Going from 1:6 to 1:8 nurse ratio costs more in overtime than going from 1:4 to 1:6.
          </li>
          <li>
            <span className="font-semibold">Implementation matters more than strategy.</span>{' '}
            Contracted + aggressive CDI = hospitalists disengage. Same strategy, different implementation, different outcome.
          </li>
          <li>
            <span className="font-semibold">Length of stay is the master lever.</span>{' '}
            Reducing LOS frees beds, which enables high-margin surgical cases. Everything flows through beds.
          </li>
          <li>
            <span className="font-semibold">You can't charge more for doing more (Medicare).</span>{' '}
            But you CAN capture more through better documentation. Same patient, same care, 15% revenue difference.
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-[28px] font-semibold mb-3">Hospital Economics Cheat Sheet</h2>
        <div className="grid grid-cols-2 gap-4 text-[20px]">
          <div className="bg-slate-50 rounded-xl p-4">
            <h4 className="font-semibold mb-2">Cost Structure</h4>
            <ul className="space-y-1 text-slate-600">
              <li>Labor: ~55% of expenses</li>
              <li>Supplies: ~15%</li>
              <li>Overhead: ~20%</li>
              <li>Capital: ~10%</li>
            </ul>
          </div>
          <div className="bg-slate-50 rounded-xl p-4">
            <h4 className="font-semibold mb-2">Revenue Sources</h4>
            <ul className="space-y-1 text-slate-600">
              <li>Medicare: ~45% of cases (fixed DRG rates)</li>
              <li>Commercial: ~35% (negotiated, highest rates)</li>
              <li>Medicaid: ~15% (below cost)</li>
              <li>Self-pay: ~5% (high bad debt)</li>
            </ul>
          </div>
          <div className="bg-slate-50 rounded-xl p-4">
            <h4 className="font-semibold mb-2">Key Metrics</h4>
            <ul className="space-y-1 text-slate-600">
              <li>National median margin: ~2%</li>
              <li>Average LOS: ~5 days</li>
              <li>Readmission penalty threshold: 15%</li>
              <li>Surgical cases: highest margin category</li>
            </ul>
          </div>
          <div className="bg-slate-50 rounded-xl p-4">
            <h4 className="font-semibold mb-2">The Death Spiral</h4>
            <ul className="space-y-1 text-slate-600">
              <li>Cut costs → quality drops</li>
              <li>Quality drops → readmissions rise</li>
              <li>Readmissions → Medicare penalties</li>
              <li>Penalties → revenue drops</li>
              <li>Revenue drops → cut more costs...</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}
