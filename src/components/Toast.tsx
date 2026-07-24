import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { CheckCircle2, TriangleAlert, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message {
  id: number
  texte: string
  ton: 'succes' | 'erreur'
}

interface ToastContexte {
  succes: (texte: string) => void
  erreur: (texte: string) => void
}

const Contexte = createContext<ToastContexte | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([])

  const ajouter = useCallback((texte: string, ton: Message['ton']) => {
    const id = Date.now() + Math.random()
    setMessages((m) => [...m, { id, texte, ton }])
  }, [])

  const valeur = useMemo<ToastContexte>(
    () => ({
      succes: (texte) => ajouter(texte, 'succes'),
      erreur: (texte) => ajouter(texte, 'erreur'),
    }),
    [ajouter],
  )

  const retirer = useCallback((id: number) => {
    setMessages((m) => m.filter((x) => x.id !== id))
  }, [])

  return (
    <Contexte.Provider value={valeur}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6">
        {messages.map((m) => (
          <Bulle key={m.id} message={m} onFermer={() => retirer(m.id)} />
        ))}
      </div>
    </Contexte.Provider>
  )
}

function Bulle({ message, onFermer }: { message: Message; onFermer: () => void }) {
  useEffect(() => {
    const minuteur = setTimeout(onFermer, 5000)
    return () => clearTimeout(minuteur)
  }, [onFermer])

  return (
    <div
      role="status"
      className={cn(
        'animate-fade-in pointer-events-auto flex w-full max-w-md items-start gap-2.5 rounded-xl px-4 py-3 text-sm shadow-lg',
        message.ton === 'succes' ? 'bg-ardoise-900 text-white' : 'bg-red-600 text-white',
      )}
    >
      {message.ton === 'succes' ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
      ) : (
        <TriangleAlert className="mt-0.5 size-4 shrink-0" />
      )}
      <span className="min-w-0 flex-1">{message.texte}</span>
      <button onClick={onFermer} aria-label="Fermer" className="shrink-0 opacity-60 hover:opacity-100">
        <X className="size-4" />
      </button>
    </div>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastContexte {
  const contexte = useContext(Contexte)
  if (!contexte) throw new Error('useToast doit être utilisé dans un ToastProvider')
  return contexte
}
