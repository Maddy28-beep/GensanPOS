import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'

type ToastTone = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  title: string
  message?: string
  tone: ToastTone
}

interface ToastContextValue {
  showToast: (toast: Omit<ToastItem, 'id'>) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

const toastIcons: Record<ToastTone, string> = {
  success: '✓',
  error: '!',
  info: 'i',
}

export function ToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const removeToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback(
    (toast: Omit<ToastItem, 'id'>) => {
      const id = Date.now() + Math.floor(Math.random() * 1000)
      setToasts((current) => [...current, { ...toast, id }])
      window.setTimeout(() => removeToast(id), 3500)
    },
    [removeToast],
  )

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast-item ${toast.tone}`}>
            <span className="toast-icon" aria-hidden="true">
              {toastIcons[toast.tone]}
            </span>
            <div className="toast-copy">
              <strong>{toast.title}</strong>
              {toast.message ? <span>{toast.message}</span> : null}
              <button
                className="toast-close"
                type="button"
                onClick={() => removeToast(toast.id)}
              >
                Close
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider.')
  }

  return context
}
