interface CardProps {
  children: React.ReactNode
  className?: string
  selected?: boolean
  onClick?: () => void
}

export function Card({ children, className = '', selected, onClick }: CardProps) {
  const base = 'rounded-xl border-2 p-4 transition-all'
  const interactive = onClick ? 'cursor-pointer hover:shadow-md' : ''
  const selectedClass = selected ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white'

  return (
    <div
      className={`${base} ${interactive} ${selectedClass} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } } : undefined}
    >
      {children}
    </div>
  )
}
