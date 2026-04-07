import { memo } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const RISK_COLORS = {
  LOW: '#10b981',
  MEDIUM: '#f59e0b',
  MODERATE: '#f59e0b',
  HIGH: '#ef4444'
}

const RiskDistributionChart = memo(function RiskDistributionChart({ data }) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="2 4" stroke="#374151" opacity={0.2} />
          <XAxis dataKey="label" tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(value) => [`${value}`, 'Count']}
            contentStyle={{
              background: '#111827',
              border: '1px solid #1F2937',
              borderRadius: 12,
              color: '#F3F4F6'
            }}
          />
          <Bar dataKey="count" radius={[8, 8, 0, 0]} maxBarSize={42} isAnimationActive animationDuration={450}>
            {(data || []).map((entry) => (
              <Cell key={`risk-${entry.label}`} fill={RISK_COLORS[String(entry.label).toUpperCase()] || '#818CF8'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
})

export default RiskDistributionChart
