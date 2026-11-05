import { useCallback, useEffect, useRef, useState } from 'react'
import { ConfirmContext, ToastContext } from './toast.js'

// Pop-ups in the centre of the screen:
//   a message that fades in and out on its own (useToast)
//   a confirm dialog with a confirm and a Cancel button (useConfirm). Escape
//   or clicking outside cancels; Enter confirms.
export default function ToastProvider({ children }) {
  const [toast, setToast] = useState(null) // { text, key }
  const [dialog, setDialog] = useState(null) // { text, confirmLabel, resolve }
  const confirmButton = useRef(null)

  const showMessage = useCallback((text) => {
    setToast({ text, key: Date.now() })
  }, [])

  const confirm = useCallback(
    (text, { confirmLabel = 'Delete' } = {}) =>
      new Promise((resolve) => {
        setDialog({ text, confirmLabel, resolve })
      }),
    [],
  )

  const close = useCallback(
    (answer) => {
      dialog?.resolve(answer)
      setDialog(null)
    },
    [dialog],
  )

  useEffect(() => {
    if (!dialog) return
    confirmButton.current?.focus()
    const onKey = (event) => {
      if (event.key === 'Escape') close(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dialog, close])

  return (
    <ToastContext.Provider value={showMessage}>
      <ConfirmContext.Provider value={confirm}>
        {children}
        {toast && (
          <div className="toast-layer" role="status" aria-live="polite">
            <div key={toast.key} className="toast" onAnimationEnd={() => setToast(null)}>
              {toast.text}
            </div>
          </div>
        )}
        {dialog && (
          <div className="dialog-layer" onClick={() => close(false)}>
            <div className="dialog" role="alertdialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
              <p>{dialog.text}</p>
              <div className="button-row">
                <button ref={confirmButton} className="neon-button danger" onClick={() => close(true)}>
                  {dialog.confirmLabel}
                </button>
                <button className="neon-button" onClick={() => close(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  )
}
