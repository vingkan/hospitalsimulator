interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'normal' | 'large'
}

export function Button({ variant = 'primary', size = 'normal', className = '', children, ...props }: ButtonProps) {
  const base = 'font-semibold rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer'
  const sizeClass = size === 'large' ? 'px-8 py-4 text-[18px]' : 'px-6 py-3 text-[16px]'

  const variantStyles: Record<string, string> = {
    primary: 'text-[#0F172A] hover:opacity-90 focus:ring-[#2DD4BF]',
    secondary: 'border hover:opacity-90 focus:ring-[#475569]',
    danger: 'hover:opacity-90 focus:ring-[#FB7185]',
  }

  const variantInline: Record<string, React.CSSProperties> = {
    primary: { background: 'var(--primary)', color: 'var(--bg)' },
    secondary: { background: 'var(--surface-elevated)', color: 'var(--text)', borderColor: 'var(--border)' },
    danger: { background: 'var(--crisis)', color: 'var(--bg)' },
  }

  return (
    <button
      className={`${base} ${sizeClass} ${variantStyles[variant]} ${className}`}
      style={{ fontFamily: 'var(--font-body)', ...variantInline[variant] }}
      {...props}
    >
      {children}
    </button>
  )
}
