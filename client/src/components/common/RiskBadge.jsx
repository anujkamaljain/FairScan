const riskStyles = {
  LOW: 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25',
  MODERATE: 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30',
  MEDIUM: 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30',
  HIGH: 'bg-red-500/15 text-red-400 ring-1 ring-red-500/30'
}

function RiskBadge({ level = 'LOW', className = '' }) {
  const normalizedLevel = String(level || 'LOW').toUpperCase()
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide ${riskStyles[normalizedLevel] || riskStyles.LOW} ${className}`}
    >
      {normalizedLevel}
    </span>
  )
}

export default RiskBadge
