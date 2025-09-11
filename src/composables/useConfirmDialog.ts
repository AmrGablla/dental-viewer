import { ref } from 'vue'

interface ConfirmDialogOptions {
  title: string
  message: string
  type?: 'danger' | 'warning' | 'info' | 'success'
  confirmText?: string
  cancelText?: string
  showCancelButton?: boolean
}

interface ConfirmDialogState extends ConfirmDialogOptions {
  isVisible: boolean
  resolve?: (value: boolean) => void
}

class ConfirmDialogService {
  private dialogState = ref<ConfirmDialogState>({
    isVisible: false,
    title: '',
    message: '',
    type: 'warning',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    showCancelButton: true
  })

  setDialogRef(_ref: any) {
    // This method is kept for future use if needed
    // Currently the dialog state is managed directly
  }

  getDialogState() {
    return this.dialogState
  }

  async confirm(options: ConfirmDialogOptions): Promise<boolean> {
    return new Promise((resolve) => {
      this.dialogState.value = {
        ...options,
        isVisible: true,
        resolve
      }
    })
  }

  handleConfirm() {
    if (this.dialogState.value.resolve) {
      this.dialogState.value.resolve(true)
    }
    this.hideDialog()
  }

  handleCancel() {
    if (this.dialogState.value.resolve) {
      this.dialogState.value.resolve(false)
    }
    this.hideDialog()
  }

  handleClose() {
    if (this.dialogState.value.resolve) {
      this.dialogState.value.resolve(false)
    }
    this.hideDialog()
  }

  private hideDialog() {
    this.dialogState.value.isVisible = false
  }

  // Convenience methods
  async confirmDelete(message: string = 'Are you sure you want to delete this item?'): Promise<boolean> {
    return this.confirm({
      title: 'Confirm Deletion',
      message,
      type: 'danger',
      confirmText: 'Delete',
      cancelText: 'Cancel'
    })
  }

  async confirmAction(title: string, message: string, type: 'warning' | 'info' = 'warning'): Promise<boolean> {
    return this.confirm({
      title,
      message,
      type,
      confirmText: 'Continue',
      cancelText: 'Cancel'
    })
  }
}

// Create a singleton instance
const confirmDialogService = new ConfirmDialogService()

export function useConfirmDialog() {
  return confirmDialogService
}

export { confirmDialogService }
