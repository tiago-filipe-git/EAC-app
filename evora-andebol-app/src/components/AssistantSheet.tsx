import { useEffect, useRef, useState } from 'react'
import { X, Mic, Send, Sparkles } from 'lucide-react'
import { streamChatMessage } from '../lib/api'
import MarkdownMessage from './MarkdownMessage'

interface Props {
  open: boolean
  onClose: () => void
}

interface Msg {
  role: 'user' | 'ai'
  text: string
  /** true enquanto a resposta está a ser recebida em streaming */
  streaming?: boolean
  /** true se a mensagem representa um erro */
  error?: boolean
}

export default function AssistantSheet({ open, onClose }: Props) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<any>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  // Cancela o streaming pendente ao fechar/fechar o componente.
  useEffect(() => {
    if (!open && abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
  }, [open])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return

    setMessages((m) => [...m, { role: 'user', text }])
    setInput('')
    setLoading(true)

    // Cria já a bolha da resposta e vai-lhe acrescentando os tokens.
    setMessages((m) => [...m, { role: 'ai', text: '', streaming: true }])
    const aiIndex = messages.length + 1

    const updateAi = (updater: (prev: Msg) => Msg) =>
      setMessages((m) => m.map((msg, i) => (i === aiIndex ? updater(msg) : msg)))

    const controller = new AbortController()
    abortRef.current = controller

    let receivedAny = false

    await streamChatMessage(
      text,
      {
        onToken: (token) => {
          receivedAny = true
          updateAi((prev) => ({ ...prev, text: prev.text + token }))
        },
        onError: (message) => {
          updateAi((prev) => ({
            ...prev,
            text: prev.text || message,
            error: true,
          }))
        },
        onDone: () => {
          updateAi((prev) => ({ ...prev, streaming: false }))
        },
      },
      controller.signal,
    )

    // Garante que a bolha deixa de mostrar "a escrever" mesmo sem evento done.
    updateAi((prev) => ({ ...prev, streaming: false, text: prev.text }))

    if (receivedAny) {
      // Notifica todas as páginas que algo pode ter mudado
      window.dispatchEvent(new CustomEvent('data-changed'))
    }

    setLoading(false)
    abortRef.current = null
  }

  const startVoice = () => {
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    if (!SR) {
      alert('Este browser não suporta reconhecimento de voz.')
      return
    }
    const rec = new SR()
    rec.lang = 'pt-PT'
    rec.interimResults = false
    rec.onstart = () => setListening(true)
    rec.onresult = (e: any) => {
      setInput(e.results[0][0].transcript)
      setListening(false)
    }
    rec.onerror = () => setListening(false)
    rec.onend = () => setListening(false)
    recognitionRef.current = rec
    rec.start()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-center animate-fade" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md h-full flex flex-col bg-bg animate-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-surface border-b border-border px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary-soft flex items-center justify-center">
            <Sparkles size={18} strokeWidth={2} className="text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-text">Assistente IA</p>
            <p className="text-[11px] text-text-muted">Évora Andebol Clube</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-surface-2 flex items-center justify-center transition-colors"
          >
            <X size={20} strokeWidth={2} className="text-text-muted" />
          </button>
        </div>

        {/* Mensagens */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-10 px-4">
              <div className="w-14 h-14 rounded-2xl bg-primary-soft flex items-center justify-center mx-auto mb-4">
                <Sparkles size={26} strokeWidth={1.75} className="text-primary" />
              </div>
              <p className="text-sm font-bold text-text">Como posso ajudar?</p>
              <p className="text-xs text-text-muted mt-2">
                Podes pedir para aplicar multas, consultar valores, marcar
                presenças, ou simplesmente perguntar.
              </p>
            </div>
          )}
          {messages.map((m, i) => {
            if (m.role === 'user') {
              return (
                <div
                  key={i}
                  className="max-w-[85%] ml-auto px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed bg-primary text-bg font-medium"
                >
                  {m.text}
                </div>
              )
            }

            // Enquanto não chegou nenhum token, mostra o indicador "a pensar".
            if (m.streaming && !m.text) {
              return (
                <div
                  key={i}
                  className="bg-surface border border-border px-3.5 py-2.5 rounded-2xl text-sm text-text-muted max-w-[85%] flex items-center gap-2"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  A pensar...
                </div>
              )
            }

            return (
              <div
                key={i}
                className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl ${
                  m.error
                    ? 'bg-danger-soft border border-danger/40 text-danger'
                    : 'bg-surface border border-border text-text'
                }`}
              >
                <MarkdownMessage content={m.text} />
                {m.streaming && (
                  <span className="inline-block w-1.5 h-4 ml-0.5 align-middle bg-primary animate-pulse rounded-sm" />
                )}
              </div>
            )
          })}
        </div>

        {/* Input */}
        <div className="border-t border-border bg-surface p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-2">
            <button
              onClick={startVoice}
              className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition ${
                listening
                  ? 'bg-danger text-white animate-pulse'
                  : 'bg-surface-2 hover:bg-border text-primary'
              }`}
            >
              <Mic size={20} strokeWidth={2} />
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Escreve ou usa o microfone..."
              className="flex-1 px-4 py-3 bg-surface-2 border border-border rounded-full text-sm text-text placeholder-text-dim focus:outline-none focus:border-primary transition-colors"
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="w-11 h-11 rounded-full bg-primary hover:bg-primary-hover disabled:opacity-40 flex items-center justify-center shrink-0 transition"
            >
              <Send size={18} strokeWidth={2.4} className="text-bg" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}