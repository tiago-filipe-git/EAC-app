/**
 * Skeleton de carregamento reutilizável.
 * Uso:
 *   <Skeleton lines={3} />            → 3 linhas genéricas
 *   <Skeleton.Card />                 → card grande
 *   <Skeleton.Row />                  → linha com avatar
 *   <Skeleton.Hero />                 → card grande hero
 */

interface Props {
  lines?: number
  className?: string
}

export default function Skeleton({ lines = 3, className = '' }: Props) {
  return (
    <div className={`space-y-2.5 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton-block h-4"
          style={{ width: `${70 + ((i * 7) % 30)}%` }}
        />
      ))}
    </div>
  )
}

Skeleton.Card = function SkeletonCard() {
  return (
    <div className="card p-4 space-y-3">
      <div className="skeleton-block h-3 w-1/3" />
      <div className="skeleton-block h-8 w-1/2" />
      <div className="skeleton-block h-3 w-2/3" />
    </div>
  )
}

Skeleton.Row = function SkeletonRow() {
  return (
    <div className="card p-3.5 flex items-center gap-3">
      <div className="skeleton-block w-10 h-10 rounded-xl shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="skeleton-block h-3 w-1/2" />
        <div className="skeleton-block h-3 w-1/3" />
      </div>
    </div>
  )
}

Skeleton.Hero = function SkeletonHero() {
  return (
    <div className="hero-glow p-6 space-y-4">
      <div className="skeleton-block h-3 w-1/3" />
      <div className="skeleton-block h-10 w-2/3" />
      <div className="skeleton-block h-3 w-1/2" />
    </div>
  )
}