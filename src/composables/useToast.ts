import { ref } from 'vue'
import type { Toast, ToastAction } from '../types/toast'

interface ToastOptions {
  duration?: number
  autoClose?: boolean
  action?: ToastAction
}

class ToastService {
  private toasts = ref<Toast[]>([])
  private toastRef: any = null

  setToastRef(ref: any) {
    this.toastRef = ref
  }

  private addToast(type: Toast['type'], title: string, message?: string, options: ToastOptions = {}) {
    if (this.toastRef) {
      return this.toastRef.addToast({
        type,
        title,
        message,
        duration: options.duration,
        autoClose: options.autoClose,
        action: options.action
      })
    }
    
    // Fallback if ref not set
    const id = Math.random().toString(36).substr(2, 9)
    const toast: Toast = {
      id,
      type,
      title,
      message,
      duration: options.duration || 5000,
      autoClose: options.autoClose !== false,
      action: options.action
    }
    
    this.toasts.value.push(toast)
    
    if (toast.autoClose) {
      setTimeout(() => {
        this.removeToast(id)
      }, toast.duration)
    }
    
    return id
  }

  success(title: string, message?: string, options?: ToastOptions) {
    return this.addToast('success', title, message, options)
  }

  error(title: string, message?: string, options?: ToastOptions) {
    return this.addToast('error', title, message, options)
  }

  warning(title: string, message?: string, options?: ToastOptions) {
    return this.addToast('warning', title, message, options)
  }

  info(title: string, message?: string, options?: ToastOptions) {
    return this.addToast('info', title, message, options)
  }

  removeToast(id: string) {
    if (this.toastRef) {
      this.toastRef.removeToast(id)
    } else {
      const index = this.toasts.value.findIndex((toast: Toast) => toast.id === id)
      if (index > -1) {
        this.toasts.value.splice(index, 1)
      }
    }
  }

  clearAll() {
    if (this.toastRef) {
      this.toastRef.toasts = []
    } else {
      this.toasts.value = []
    }
  }

  getToasts() {
    return this.toasts.value
  }
}

// Lazy singleton pattern to avoid initialization order issues
let toastService: ToastService | null = null

export function useToast() {
  if (!toastService) {
    toastService = new ToastService()
  }
  return toastService
}

export { toastService }
