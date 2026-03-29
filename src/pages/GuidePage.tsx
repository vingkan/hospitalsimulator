export function GuidePage() {
  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 style={{ fontFamily: 'var(--font-display)' }} className="text-[36px] font-bold">Facilitator Guide</h1>
        <a href="#" style={{ color: 'var(--primary)' }} className="text-[18px] hover:underline">Back to Game</a>
      </div>

      <GuideSection title="Pre-Session Prep">
        <ul className="space-y-2 text-[16px]" style={{ color: 'var(--text-muted)' }}>
          <li>Open the game on the 80" TV or share screen via Zoom</li>
          <li>8-12 team members: in-person + remote. Cross-functional works best.</li>
          <li>Plan for 45-75 minutes total</li>
          <li>The facilitator drives the laptop. The team discusses and decides together.</li>
          <li>There are no wrong answers. The goal is building intuition, not winning.</li>
        </ul>
      </GuideSection>

      <GuideSection title="Per-Quarter Focus Areas">
        <div className="space-y-3">
          <QuarterGuide quarter={1} focus="Staffing & Hospitalist Program"
            prompt="Focus the team on staffing decisions and whether to start a hospitalist program. Ask: 'Should we invest $500K/quarter in hospitalists? What workforce model? What CDI approach?' This quarter teaches the relationship between staffing, quality, and indirect revenue."
          />
          <QuarterGuide quarter={2} focus="Discharge & Surgical Expansion"
            prompt="Now that they've seen Q1 results, guide them toward discharge coordination and surgical expansion. Ask: 'Did the hospitalist investment pay off? Where are the bottlenecks?' This quarter teaches throughput and capacity management."
          />
          <QuarterGuide quarter={3} focus="Optimization"
            prompt="Challenge them to optimize. They've seen two quarters of results. Ask: 'What's working? What's not? If you could change one thing, what would it be?' This quarter teaches iteration and the cost of switching strategies."
          />
          <QuarterGuide quarter={4} focus="Final Adjustments"
            prompt="Final adjustments. Ask: 'What do you wish you'd done differently in Q1? What did the game teach you about hospital economics that you didn't know before?' Build the bridge to product decisions."
          />
        </div>
      </GuideSection>

      <GuideSection title="How to Facilitate Each Quarter">
        <div className="space-y-3">
          <StepCard step="1" title="Review the Hospital Schematic (~2 min)"
            body="'Let's look at where our hospital stands.' Point at the color-coded wards: 'Wing A is amber at 78% occupancy. ICU is red at 92%. What does that tell us?' Point at staffing, quality, readmission badges." />
          <StepCard step="2" title="Adjust Operations Console (~7 min)"
            body="Walk through each lever section. Read the labels aloud. Let the team debate trade-offs. 'If we cut nurse ratio to 1:7, we save on labor but quality drops and overtime spikes. Is it worth it?' The discussion IS the learning." />
          <StepCard step="3" title="Review Results (~3 min)"
            body="After the dramatic reveal, read the narrative aloud. Ask: 'Why did that happen?' and 'What would you do differently?' Connect the operational changes to financial outcomes." />
        </div>
      </GuideSection>

      <GuideSection title="Key Aha Moments to Surface">
        <ul className="space-y-3 text-[16px]" style={{ color: 'var(--text)' }}>
          <li>
            <span className="font-semibold" style={{ color: 'var(--primary)' }}>Indirect revenue is real but invisible.</span>{' '}
            <span style={{ color: 'var(--text-muted)' }}>A hospitalist program "loses money" but freed beds can generate 2-3x the subsidy in surgical revenue.</span>
          </li>
          <li>
            <span className="font-semibold" style={{ color: 'var(--primary)' }}>Overtime is nonlinear.</span>{' '}
            <span style={{ color: 'var(--text-muted)' }}>Going from 1:6 to 1:8 nurse ratio costs more in overtime than going from 1:4 to 1:6.</span>
          </li>
          <li>
            <span className="font-semibold" style={{ color: 'var(--primary)' }}>Implementation matters more than strategy.</span>{' '}
            <span style={{ color: 'var(--text-muted)' }}>Contracted + aggressive CDI = hospitalists disengage. Same strategy, different implementation, different outcome.</span>
          </li>
          <li>
            <span className="font-semibold" style={{ color: 'var(--primary)' }}>Length of stay is the master lever.</span>{' '}
            <span style={{ color: 'var(--text-muted)' }}>Reducing LOS frees beds, which enables high-margin surgical cases. Everything flows through beds.</span>
          </li>
          <li>
            <span className="font-semibold" style={{ color: 'var(--primary)' }}>You can't charge more for doing more (Medicare).</span>{' '}
            <span style={{ color: 'var(--text-muted)' }}>But you CAN capture more through better documentation. Same patient, same care, 15% revenue difference.</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection title="Hospital Economics Cheat Sheet">
        <div className="grid grid-cols-2 gap-4 text-[14px]">
          <CheatCard title="Cost Structure" items={[
            'Labor: ~56% of expenses',
            'Supplies: ~16%',
            'Overhead: ~21%',
            'Capital: ~7%',
          ]} />
          <CheatCard title="Revenue Sources" items={[
            'Medicare: ~45% of cases ($14K avg DRG)',
            'Commercial: ~35% ($20K, highest rates)',
            'Medicaid: ~15% ($8K, below cost)',
            'Self-pay: ~5% ($3K, high bad debt)',
          ]} />
          <CheatCard title="Key Metrics" items={[
            'National median margin: ~2%',
            'Average LOS: ~5.2 days',
            'Readmission penalty threshold: 15%',
            'Surgical cases: highest margin category',
          ]} />
          <CheatCard title="The Death Spiral" items={[
            'Cut costs → quality drops',
            'Quality drops → readmissions rise',
            'Readmissions → Medicare penalties',
            'Penalties → revenue drops',
            'Revenue drops → cut more costs...',
          ]} />
        </div>
      </GuideSection>
    </div>
  )
}

function GuideSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 style={{ fontFamily: 'var(--font-display)' }} className="text-[24px] font-semibold mb-4">{title}</h2>
      {children}
    </section>
  )
}

function QuarterGuide({ quarter, focus, prompt }: { quarter: number; focus: string; prompt: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-baseline gap-3 mb-2">
        <span style={{ fontFamily: 'var(--font-display)', color: 'var(--primary)' }} className="text-[18px] font-bold">Q{quarter}</span>
        <span className="font-semibold text-[16px]">{focus}</span>
      </div>
      <p className="text-[14px]" style={{ color: 'var(--text-muted)' }}>{prompt}</p>
    </div>
  )
}

function StepCard({ step, title, body }: { step: string; title: string; body: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <h3 className="text-[16px] font-semibold mb-2">
        <span style={{ color: 'var(--primary)' }}>{step}.</span> {title}
      </h3>
      <p className="text-[14px]" style={{ color: 'var(--text-muted)' }}>{body}</p>
    </div>
  )
}

function CheatCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <h4 className="font-semibold mb-2" style={{ color: 'var(--primary)', fontFamily: 'var(--font-display)', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>{title}</h4>
      <ul className="space-y-1" style={{ color: 'var(--text-muted)' }}>
        {items.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    </div>
  )
}
