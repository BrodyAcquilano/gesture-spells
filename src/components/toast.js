import { createContext, useContext } from 'react'

export const ToastContext = createContext(() => {})
export const ConfirmContext = createContext(async () => false)

// showMessage(text): a message fades in, stays a few seconds, and fades out
// in the centre of the screen.
export function useToast() {
  return useContext(ToastContext)
}

// await confirm(text, { confirmLabel }): a dialog in the centre of the screen
// with a confirm and a Cancel button. Resolves to true if confirmed.
export function useConfirm() {
  return useContext(ConfirmContext)
}
