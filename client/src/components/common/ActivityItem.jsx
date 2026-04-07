import { memo } from 'react'

function formatTimestamp(timestamp) {
  if (!timestamp) return 'Unknown time'
  return new Date(timestamp).toLocaleString()
}

const ActivityItem = memo(function ActivityItem({ timestamp, message }) {
  return (
    <div className="rounded-xl border border-gray-200/70 bg-gray-50 px-4 py-3 transition-all duration-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-950/60">
      <p className="text-xs text-gray-500 dark:text-gray-400">{formatTimestamp(timestamp)}</p>
      <p className="mt-1 text-sm text-gray-800 dark:text-gray-200">{message}</p>
    </div>
  )
})

export default ActivityItem
