interface FABProps {
  onClick: () => void
  icon: React.ReactNode
  label: string
  variant?: 'primary' | 'neutral'
}

export default function FAB({ onClick, icon, label, variant = 'neutral' }: FABProps) {
  const styles =
    variant === 'primary'
      ? 'bg-primary hover:bg-primary-hover text-bg shadow-[0_10px_28px_rgba(245,184,0,0.4)]'
      : 'bg-surface hover:bg-surface-2 text-primary border border-border shadow-[0_10px_28px_rgba(0,0,0,0.5)]'

  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`pressable w-14 h-14 rounded-full flex items-center justify-center ${styles}`}
    >
      {icon}
    </button>
  )
}