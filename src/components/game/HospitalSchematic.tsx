import type { MedSurgState } from '../../engine/modules/medsurg'
import type { ORState } from '../../engine/modules/or'
import type { ProgramState } from '../../engine/types'

interface Props {
  medsurgState: MedSurgState
  orState: ORState
  programs: ProgramState
  reducedMotion?: boolean
}

/** Color thresholds for occupancy display */
function occupancyColor(rate: number): string {
  if (rate > 0.90) return 'var(--crisis)'
  if (rate > 0.70) return 'var(--warning)'
  return 'var(--healthy)'
}

/** Color thresholds for quality */
function qualityColor(score: number): string {
  if (score >= 70) return 'var(--healthy)'
  if (score >= 50) return 'var(--warning)'
  return 'var(--crisis)'
}

/** Color for staffing ratio */
function staffingColor(ratio: number): string {
  if (ratio <= 5) return 'var(--healthy)'
  if (ratio <= 6) return 'var(--warning)'
  return 'var(--crisis)'
}

/**
 * 2D overhead SVG hospital schematic.
 * Shows ward occupancy, OR status, staffing, quality, and key indicators.
 * CSS transitions animate state changes (300ms ease-out).
 */
export function HospitalSchematic({ medsurgState, orState, programs, reducedMotion }: Props) {
  const transitionStyle = reducedMotion ? 'none' : 'fill 300ms ease-out, opacity 300ms ease-out'

  // Distribute total occupancy across wings proportionally
  const occupancy = medsurgState.occupancyRate
  const wingOccupancies = [
    Math.min(1, occupancy * 1.1),   // Wing A: slightly above average
    Math.min(1, occupancy * 0.9),   // Wing B: slightly below
    Math.min(1, occupancy * 1.3),   // ICU: higher (realistic)
    Math.min(1, occupancy * 0.85),  // Wing C: slightly below
  ]

  const orActive = Math.min(4, Math.round(4 * orState.utilization))
  const orCases = Math.round(orState.orCapacity * orState.utilization)
  const edBoarding = occupancy > 0.95

  return (
    <svg
      viewBox="0 0 1000 320"
      className="w-full"
      style={{ maxHeight: '380px' }}
      role="img"
      aria-label="Hospital overhead schematic"
    >
      {/* Background */}
      <rect x="0" y="0" width="1000" height="320" fill="var(--bg)" rx="8" />

      {/* === Row 1: Wing A, Wing B, ICU, OR === */}

      {/* Med/Surg Wing A */}
      <Ward
        x={30} y={20} w={200} h={130}
        name="Med/Surg A" beds={60}
        occupancy={wingOccupancies[0]}
        transition={transitionStyle}
      />

      {/* Med/Surg Wing B */}
      <Ward
        x={250} y={20} w={200} h={130}
        name="Med/Surg B" beds={60}
        occupancy={wingOccupancies[1]}
        transition={transitionStyle}
      />

      {/* ICU */}
      <Ward
        x={470} y={20} w={160} h={130}
        name="ICU" beds={20}
        occupancy={wingOccupancies[2]}
        transition={transitionStyle}
      />

      {/* OR Suites */}
      <g>
        <rect x={650} y={20} width={160} height={130} rx={4}
          fill="var(--surface)" stroke="var(--border)" strokeWidth={1} />
        <text x={730} y={52} textAnchor="middle"
          fontFamily="var(--font-display)" fontSize={13} fontWeight={700} fill="var(--text)">
          OR Suites
        </text>
        {/* 4 OR indicators */}
        {[0, 1, 2, 3].map(i => (
          <circle key={i} cx={694 + i * 24} cy={80} r={10}
            fill={i < orActive ? 'var(--healthy)' : 'var(--surface-elevated)'}
            style={{ transition: transitionStyle }}
            opacity={i < orActive ? 0.9 : 0.5}
          />
        ))}
        <text x={730} y={115} textAnchor="middle"
          fontFamily="var(--font-data)" fontSize={12} fill="var(--text-muted)">
          {orActive}/4 active
        </text>
        <text x={730} y={135} textAnchor="middle"
          fontFamily="var(--font-data)" fontSize={11} fill="var(--text-muted)">
          {orCases} cases/yr
        </text>
      </g>

      {/* === Row 2: Wing C, ED, Discharge === */}

      {/* Med/Surg Wing C */}
      <Ward
        x={30} y={170} w={200} h={130}
        name="Med/Surg C" beds={60}
        occupancy={wingOccupancies[3]}
        transition={transitionStyle}
      />

      {/* Emergency Department */}
      <g>
        <rect x={250} y={170} width={200} height={130} rx={4}
          fill="var(--surface)" stroke="var(--border)" strokeWidth={1} />
        <text x={350} y={205} textAnchor="middle"
          fontFamily="var(--font-display)" fontSize={13} fontWeight={700} fill="var(--text)">
          Emergency Dept
        </text>
        <text x={350} y={230} textAnchor="middle"
          fontFamily="var(--font-data)" fontSize={14}
          fill={edBoarding ? 'var(--crisis)' : 'var(--healthy)'}
          style={{ transition: transitionStyle }}>
          {edBoarding ? 'BOARDING' : 'Normal flow'}
        </text>
        {edBoarding && (
          <text x={350} y={250} textAnchor="middle"
            fontFamily="var(--font-data)" fontSize={11} fill="var(--crisis)">
            Beds full, patients waiting
          </text>
        )}
      </g>

      {/* Discharge Area */}
      <g>
        <rect x={470} y={170} width={160} height={130} rx={4}
          fill="var(--surface)"
          stroke={programs.dischargeCoordination?.active ? 'var(--primary)' : 'var(--border)'}
          strokeWidth={programs.dischargeCoordination?.active ? 2 : 1}
          style={{ transition: transitionStyle }}
        />
        <text x={550} y={205} textAnchor="middle"
          fontFamily="var(--font-display)" fontSize={13} fontWeight={700} fill="var(--text)">
          Discharge
        </text>
        {programs.dischargeCoordination?.active ? (
          <>
            <text x={550} y={230} textAnchor="middle"
              fontFamily="var(--font-data)" fontSize={13} fill="var(--primary)">
              Coord: Active
            </text>
            <text x={550} y={250} textAnchor="middle"
              fontFamily="var(--font-data)" fontSize={11} fill="var(--text-muted)">
              {programs.dischargeCoordination.model === 'dedicated_planners' ? 'Dedicated planners' : 'Nurse-led'}
            </text>
            {programs.dischargeCoordination.postAcutePartnerships && (
              <text x={550} y={268} textAnchor="middle"
                fontFamily="var(--font-data)" fontSize={10} fill="var(--healthy)">
                Post-acute partnerships
              </text>
            )}
          </>
        ) : (
          <text x={550} y={230} textAnchor="middle"
            fontFamily="var(--font-data)" fontSize={13} fill="var(--text-muted)">
            No coordination
          </text>
        )}
      </g>

      {/* === Right column: Hospital-wide indicators === */}

      {/* Staffing */}
      <g>
        <rect x={835} y={20} width={145} height={60} rx={4}
          fill="var(--surface)" stroke="var(--border)" strokeWidth={1} />
        <text x={907} y={42} textAnchor="middle"
          fontFamily="var(--font-display)" fontSize={10} fontWeight={600} fill="var(--text-muted)"
          letterSpacing="0.08em">
          STAFFING
        </text>
        <text x={907} y={68} textAnchor="middle"
          fontFamily="var(--font-data)" fontSize={22} fontWeight={700}
          fill={staffingColor(programs.nurseRatio)}
          style={{ transition: transitionStyle }}>
          1:{programs.nurseRatio}
        </text>
        {programs.nurseRatio >= 7 && (
          <text x={907} y={20} textAnchor="middle"
            fontFamily="var(--font-data)" fontSize={9} fill="var(--crisis)"
            fontWeight={700} letterSpacing="0.1em">
            OVERTIME
          </text>
        )}
      </g>

      {/* Quality */}
      <g>
        <rect x={835} y={95} width={145} height={60} rx={4}
          fill="var(--surface)" stroke="var(--border)" strokeWidth={1} />
        <text x={907} y={117} textAnchor="middle"
          fontFamily="var(--font-display)" fontSize={10} fontWeight={600} fill="var(--text-muted)"
          letterSpacing="0.08em">
          QUALITY
        </text>
        <text x={907} y={143} textAnchor="middle"
          fontFamily="var(--font-data)" fontSize={22} fontWeight={700}
          fill={qualityColor(medsurgState.qualityScore)}
          style={{ transition: transitionStyle }}>
          {medsurgState.qualityScore.toFixed(0)}
        </text>
      </g>

      {/* DRG Accuracy */}
      <g>
        <rect x={835} y={170} width={145} height={60} rx={4}
          fill="var(--surface)" stroke="var(--border)" strokeWidth={1} />
        <text x={907} y={192} textAnchor="middle"
          fontFamily="var(--font-display)" fontSize={10} fontWeight={600} fill="var(--text-muted)"
          letterSpacing="0.08em">
          DRG ACCURACY
        </text>
        <text x={907} y={218} textAnchor="middle"
          fontFamily="var(--font-data)" fontSize={22} fontWeight={700}
          fill="var(--text)"
          style={{ transition: transitionStyle }}>
          {(medsurgState.drgAccuracy * 100).toFixed(0)}%
        </text>
      </g>

      {/* Readmission Rate */}
      <g>
        <rect x={835} y={245} width={145} height={55} rx={4}
          fill="var(--surface)" stroke="var(--border)" strokeWidth={1} />
        <text x={907} y={265} textAnchor="middle"
          fontFamily="var(--font-display)" fontSize={10} fontWeight={600} fill="var(--text-muted)"
          letterSpacing="0.08em">
          READMISSION
        </text>
        <text x={907} y={290} textAnchor="middle"
          fontFamily="var(--font-data)" fontSize={20} fontWeight={700}
          fill={medsurgState.readmissionRate > 0.15 ? 'var(--crisis)' : medsurgState.readmissionRate > 0.12 ? 'var(--warning)' : 'var(--healthy)'}
          style={{ transition: transitionStyle }}>
          {(medsurgState.readmissionRate * 100).toFixed(1)}%
        </text>
      </g>
    </svg>
  )
}

/** Reusable ward rectangle with occupancy display */
function Ward({ x, y, w, h, name, beds, occupancy, transition }: {
  x: number; y: number; w: number; h: number
  name: string; beds: number; occupancy: number; transition: string
}) {
  const color = occupancyColor(occupancy)
  const pct = Math.round(occupancy * 100)

  return (
    <g>
      {/* Background */}
      <rect x={x} y={y} width={w} height={h} rx={4}
        fill="var(--surface)" stroke="var(--border)" strokeWidth={1} />
      {/* Occupancy overlay */}
      <rect x={x} y={y} width={w} height={h} rx={4}
        fill={color} opacity={0.12}
        style={{ transition }} />
      {/* Ward name */}
      <text x={x + w/2} y={y + 30} textAnchor="middle"
        fontFamily="var(--font-display)" fontSize={13} fontWeight={700} fill="var(--text)">
        {name}
      </text>
      {/* Bed count */}
      <text x={x + w/2} y={y + 50} textAnchor="middle"
        fontFamily="var(--font-data)" fontSize={11} fill="var(--text-muted)">
        {beds} beds
      </text>
      {/* Occupancy percentage */}
      <text x={x + w/2} y={y + h - 20} textAnchor="middle"
        fontFamily="var(--font-data)" fontSize={24} fontWeight={700}
        fill={color}
        style={{ transition }}>
        {pct}%
      </text>
    </g>
  )
}
