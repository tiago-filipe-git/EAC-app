import { Plus, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { canManageFines } from '../lib/permissions'
import FAB from './FAB'
import AssistantSheet from './AssistantSheet'
import ApplyFineModal from './ApplyFineModal'

export default function FABs() {
  const { user } = useAuth()
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [applyOpen, setApplyOpen] = useState(false)

  useEffect(() => {
    const open = () => setAssistantOpen(true)
    window.addEventListener('open-assistant', open)
    return () => window.removeEventListener('open-assistant', open)
  }, [])

  if (!user) return null

  const showNewFine = canManageFines(user.role)

  const handleFineApplied = () => {
    // Notifica quem estiver interessado (a página Fines, por exemplo)
    window.dispatchEvent(new CustomEvent('fine-applied'))
  }

  return (
    <>
      {/* Container centrado — mesma largura que o AppShell */}
      <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pointer-events-none">
        <div className="w-full max-w-md relative pointer-events-none">
          {/* FABs ancorados ao canto inferior direito DESTE container (alinhado com a app) */}
          <div className="absolute bottom-28 right-5 flex flex-col gap-3 pointer-events-auto">
            {showNewFine && (
              <FAB
                onClick={() => setApplyOpen(true)}
                icon={<Plus size={24} strokeWidth={2.5} />}
                label="Nova multa"
                variant="primary"
              />
            )}
            <FAB
              onClick={() => setAssistantOpen(true)}
              icon={<Sparkles size={22} strokeWidth={2} />}
              label="Assistente IA"
            />
          </div>
        </div>
      </div>

      {/* Modais globais */}
      <AssistantSheet
        open={assistantOpen}
        onClose={() => setAssistantOpen(false)}
      />
      <ApplyFineModal
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        onSuccess={handleFineApplied}
      />
    </>
  )
}