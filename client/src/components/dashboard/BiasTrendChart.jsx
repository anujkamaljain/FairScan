import { memo } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const BiasTrendChart = memo(function BiasTrendChart({ data }) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="2 4" stroke="#374151" opacity={0.2} />
          <XAxis dataKey="label" tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 1]} tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(value) => [Number(value || 0).toFixed(4), 'Bias score']}
            contentStyle={{
              background: '#111827',
              border: '1px solid #1F2937',
              borderRadius: 12,
              color: '#F3F4F6'
            }}
          />
          <Line type="monotone" dataKey="score" stroke="#6366F1" strokeWidth={3} dot={false} isAnimationActive animationDuration={450} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
})

export default BiasTrendChart
