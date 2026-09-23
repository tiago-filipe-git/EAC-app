import { useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'

/**
 * Envolve o conteúdo de cada rota e aplica uma animação de entrada suave
 * sempre que a rota muda. Não mexe em estado, só no visual.
 */
export default function PageTransition({
  children,
}: {
  children: React.ReactNode
}) {
  const location = useLocation()
  const [key, setKey] = useState(location.pathname)

  useEffect(() => {
    setKey(location.pathname + location.search)
  }, [location.pathname, location.search])

  return (
    <div key={key} className="page-enter">
      {children}
    </div>
  )
}