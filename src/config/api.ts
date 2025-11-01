/**
 * API Configuration
 * 
 * Centralizes API endpoint configuration for the application.
 * 
 * Usage:
 * 1. Import: import { buildApiUrl } from '@/config/api'
 * 2. Use: buildApiUrl('/cases') to build full URLs
 * 
 * Environment Variables:
 * - VITE_API_BASE_URL: API base URL (default: https://mvp.mylinealigners.com/api)
 * 
 * Example .env file:
 * VITE_API_BASE_URL=https://your-api-domain.com/api
 */

// Get API base URL from environment or use default
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://mvp.mylinealigners.com/api";

// API Configuration
export const API_CONFIG = {
  BASE_URL: API_BASE_URL,
  
  // API endpoints
  ENDPOINTS: {
    HEALTH: "/health",
    AUTH: {
      LOGIN: "/auth/login",
      REGISTER: "/auth/register",
      LOGOUT: "/auth/logout"
    },
    CASES: {
      LIST: "/cases",
      GET: (id: string) => `/cases/${id}`,
      CREATE: "/cases",
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

// Helper function to build direct upload URLs (bypasses API, served directly by nginx)
// This is MUCH faster than going through the API
export const buildUploadUrl = (path: string): string => {
  // Extract base URL from API_BASE_URL (remove /api)
  const baseUrl = API_BASE_URL.replace('/api', '');
  // Ensure path starts with /
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}/uploads${cleanPath}`;
}

// Export API base URL for services that need direct access
export { API_BASE_URL as apiBaseUrl };