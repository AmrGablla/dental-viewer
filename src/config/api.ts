// API Configuration
export const API_CONFIG = {
  // In production, this will be the deployed server
  // In development, this will be localhost
  BASE_URL: import.meta.env.VITE_API_BASE_URL || 'https://mvp.mylinealigners.com/api',
  
  // API endpoints
  ENDPOINTS: {
    HEALTH: '/health',
    AUTH: {
      LOGIN: '/auth/login',
      REGISTER: '/auth/register',
      LOGOUT: '/auth/logout'
    },
    CASES: {
      LIST: '/cases',
      GET: (id: string) => `/cases/${id}`,
      CREATE: '/cases',
      DELETE: (id: string) => `/cases/${id}`,
      UPLOAD: (id: string) => `/cases/${id}/upload`,
      RAW: (id: string) => `/cases/${id}/raw`,
      SEGMENTS: (id: string) => `/cases/${id}/segments`,
      SEGMENT: (caseId: string, segmentId: string) => `/cases/${caseId}/segments/${segmentId}`,
      MIGRATE: (id: string) => `/cases/${id}/segments/migrate`
    }
  }
}

// Helper function to build full URLs
export const buildApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.BASE_URL}${endpoint}`
}
