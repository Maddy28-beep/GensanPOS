import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'

type ConfirmTone = 'default' | 'danger'

interface ConfirmOptions {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: ConfirmTone
}

interface ConfirmRequest extends ConfirmOptions {
  resolve: (value: boolean) => void
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextValue | undefined>(undefined)

export function ConfirmProvider({ children }: PropsWithChildren) {
  const [request, setRequest] = useState<ConfirmRequest | null>(null)

  const close = useCallback((value: boolean) => {
    if (request) {
      request.resolve(value)
      setRequest(null)
    }
  }, [request])

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setRequest({
        ...options,
        resolve,
      })
    })
  }, [])

  const value = useMemo(() => ({ confirm }), [confirm])

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {request ? (
        <div className="modal-backdrop">
          <div className="modal-card">
            <p className="eyebrow">Please Confirm</p>
            <h3>{request.title}</h3>
            <p className="page-copy">{request.message}</p>
            <div className="action-row">
              <button className="ghost-button" type="button" onClick={() => close(false)}>
                {request.cancelLabel ?? 'Cancel'}
              </button>
              <button
                className={request.tone === 'danger' ? 'danger-button' : 'primary-button'}
                type="button"
                onClick={() => close(true)}
              >
                {request.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const context = useContext(ConfirmContext)
  if (!context) {
    throw new Error('useConfirm must be used within ConfirmProvider.')
  }

  return context
}
