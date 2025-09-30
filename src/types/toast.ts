export interface ToastAction {
  text: string
  type: 'primary' | 'secondary' | 'danger' | 'success'
  handler: () => void
}

export interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number
  autoClose?: boolean
  action?: ToastAction
}
