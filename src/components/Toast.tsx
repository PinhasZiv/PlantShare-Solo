import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'

interface ToastAction {
  label: string
  run: () => void | Promise<void>
}

interface ToastMessage {
  id: number
  text: string
  tone: 'info' | 'error'
  action?: ToastAction
}

interface ToastContextValue {
  show: (text: string, options?: { action?: ToastAction; tone?: 'info' | 'error' }) => void
  showError: (cause: unknown) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const VISIBLE_MS = 6000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const timer = useRef<number>()

  const show = useCallback<ToastContextValue['show']>((text, options) => {
    window.clearTimeout(timer.current)
    const id = Date.now()
    setToast({ id, text, tone: options?.tone ?? 'info', action: options?.action })
    // ביטול שנעלם בזמן שמושיטים אליו יד גרוע יותר מלא להציע ביטול בכלל,
    // ולכן החלון נדיב.
    timer.current = window.setTimeout(() => setToast((current) => (current?.id === id ? null : current)), VISIBLE_MS)
  }, [])

  const showError = useCallback(
    (cause: unknown) => {
      show(cause instanceof Error ? cause.message : String(cause), { tone: 'error' })
    },
    [show],
  )

  const value = useMemo(() => ({ show, showError }), [show, showError])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <div className={`toast toast-${toast.tone}`} role="status" aria-live="polite">
          <span>{toast.text}</span>
          {toast.action && (
            <button
              type="button"
              className="toast-action"
              onClick={() => {
                setToast(null)
                void toast.action?.run()
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext)
  if (!value) throw new Error('useToast must be used inside ToastProvider')
  return value
}
