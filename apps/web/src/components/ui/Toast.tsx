'use client'

import { createContext, useCallback, useContext, useState } from 'react'

type ToastType = 'success' | 'error'
type ToastItem = { id: number; type: ToastType; message: string }

type ToastContextValue = {
  showToast: (type: ToastType, message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

// Hook de conveniencia para disparar notificaciones uniformes de
// éxito/error desde cualquier modal o acción del panel admin.
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>.')
  return ctx
}

const TOAST_STYLE: Record<ToastType, string> = {
  success: 'bg-green-50 text-green-800 border-green-200',
  error:   'bg-red-50 text-red-700 border-red-200',
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = useCallback((type: ToastType, message: string) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm px-4 sm:px-0">
        {toasts.map(toast => (
          <div
            key={toast.id}
            role="status"
            className={`rounded-xl px-4 py-3 text-sm font-medium shadow-lg border animate-fade-in ${TOAST_STYLE[toast.type]}`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
