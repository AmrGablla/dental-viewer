export class ErrorHandlingService {
  private static instance: ErrorHandlingService
  private router: any

  private constructor() {
    // We'll initialize router when needed
  }

  public static getInstance(): ErrorHandlingService {
    if (!ErrorHandlingService.instance) {
      ErrorHandlingService.instance = new ErrorHandlingService()
    }
    return ErrorHandlingService.instance
  }

  /**
   * Initialize the service with router instance
   */
  public initialize(router: any): void {
    this.router = router
  }

  /**
   * Handle API response errors and redirect to login if token is invalid
   */
  public async handleApiError(response: Response, errorMessage?: string): Promise<void> {
    if (response.status === 401 || response.status === 403) {
      try {
        const errorData = await response.json()
        if (errorData.error === 'Invalid token' || errorData.error === 'Access token required') {
          this.handleInvalidToken()
          return
        }
      } catch (parseError) {
        // If we can't parse the error response, still check for auth errors
        if (response.status === 401 || response.status === 403) {
          this.handleInvalidToken()
          return
        }
      }
    }

    // For other errors, throw with the provided message or status text
    throw new Error(errorMessage || `Request failed: ${response.status} ${response.statusText}`)
  }

  /**
   * Handle fetch errors and check for authentication issues
   */
  public handleFetchError(error: any): void {
    // Check if the error message contains authentication-related text
    const errorMessage = error.message || error.toString()
    if (errorMessage.includes('Invalid token') || 
        errorMessage.includes('Access token required') ||
        errorMessage.includes('401') ||
        errorMessage.includes('403')) {
      this.handleInvalidToken()
      return
    }

    // Re-throw other errors
    throw error
  }

  /**
   * Handle invalid token by clearing storage and redirecting to login
   */
  private handleInvalidToken(): void {
    console.warn('Invalid token detected, redirecting to login')
    
    // Clear authentication data
    localStorage.removeItem('authToken')
    localStorage.removeItem('user')
    
    // Redirect to login page
    if (this.router) {
      this.router.push('/login')
    } else {
      // Fallback: redirect to login page
      window.location.href = '/login'
    }
  }

  /**
   * Create a fetch wrapper that automatically handles authentication errors
   */
  public createAuthenticatedFetch(): (url: string, options?: RequestInit) => Promise<Response> {
    return async (url: string, options: RequestInit = {}) => {
      try {
        const response = await fetch(url, options)
        
        if (!response.ok) {
          await this.handleApiError(response)
        }
        
        return response
      } catch (error) {
        this.handleFetchError(error)
        throw error
      }
    }
  }

  /**
   * Check if the current user is authenticated
   */
  public isAuthenticated(): boolean {
    const token = localStorage.getItem('authToken')
    return !!token
  }

  /**
   * Get authentication headers for API requests
   */
  public getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('authToken')
    if (!token) {
      this.handleInvalidToken()
      return {}
    }
    
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }
}

// Export a singleton instance
export const errorHandlingService = ErrorHandlingService.getInstance()
