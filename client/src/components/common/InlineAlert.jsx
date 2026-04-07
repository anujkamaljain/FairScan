function InlineAlert({ tone = 'info', title, children, className = '' }) {
  const tones = {
    info: 'border-sky-400/30 bg-sky-500/10 text-sky-200',
    success: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
    warning: 'border-amber-400/30 bg-amber-500/10 text-amber-200',
    error: 'border-red-400/30 bg-red-500/10 text-red-200'
  }

  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${tones[tone] || tones.info} ${className}`}>
      {title && <p className="font-semibold">{title}</p>}
      <p className={title ? 'mt-1' : ''}>{children}</p>
    </div>
  )
}

export default InlineAlert
