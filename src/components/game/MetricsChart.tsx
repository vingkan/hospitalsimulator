import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { YearResult } from '../../engine/orchestrator'
import type { MedSurgState } from '../../engine/modules/medsurg'

interface MetricsChartProps {
  history: YearResult[]
}

export function MetricsChart({ history }: MetricsChartProps) {
  if (history.length < 2) return null

  const data = history.map((r) => ({
    year: `Y${r.year}`,
    margin: +(r.financials.margin * 100).toFixed(1),
    readmissionRate: +(r.moduleOutputs.medsurg.signals.readmissionRate * 100).toFixed(1),
    occupancy: +((r.state.moduleStates.medsurg as MedSurgState).occupancyRate * 100).toFixed(1),
  }))

  return (
    <div
      className="rounded-xl p-6"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <h3
        style={{ fontFamily: 'var(--font-display)', color: 'var(--primary)' }}
        className="text-[14px] font-semibold uppercase tracking-wider mb-4"
      >
        Year-over-Year Trends
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#475569" strokeOpacity={0.4} />
          <XAxis
            dataKey="year"
            tick={{ fill: '#94A3B8', fontFamily: 'var(--font-data)', fontSize: 13 }}
            axisLine={{ stroke: '#475569' }}
            tickLine={{ stroke: '#475569' }}
          />
          <YAxis
            tick={{ fill: '#94A3B8', fontFamily: 'var(--font-data)', fontSize: 12 }}
            axisLine={{ stroke: '#475569' }}
            tickLine={{ stroke: '#475569' }}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              background: '#1E293B',
              border: '1px solid #475569',
              borderRadius: 8,
              fontFamily: 'var(--font-data)',
              fontSize: 13,
              color: '#F1F5F9',
            }}
            formatter={(value, name) => [`${value}%`, name]}
            labelStyle={{ color: '#94A3B8', fontFamily: 'var(--font-display)', fontWeight: 600 }}
          />
          <Legend
            wrapperStyle={{
              fontFamily: 'var(--font-data)',
              fontSize: 12,
              color: '#94A3B8',
            }}
          />
          <Line
            type="monotone"
            dataKey="margin"
            name="Margin"
            stroke="#2DD4BF"
            strokeWidth={2}
            dot={{ fill: '#2DD4BF', r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="readmissionRate"
            name="Readmission Rate"
            stroke="#FB7185"
            strokeWidth={2}
            dot={{ fill: '#FB7185', r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="occupancy"
            name="Occupancy"
            stroke="#38BDF8"
            strokeWidth={2}
            dot={{ fill: '#38BDF8', r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
