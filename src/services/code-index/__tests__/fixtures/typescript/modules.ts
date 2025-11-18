/**
 * Test fixture: TypeScript import/export patterns
 * 
 * Tests:
 * - Named exports
 * - Default exports
 * - Re-exports
 * - Namespace imports
 * - Dynamic imports
 * - Type-only imports
 */

// Named exports
export const API_VERSION = 'v1'
export const MAX_RETRIES = 3
export const TIMEOUT_MS = 5000

// Export type
export type ApiResponse<T> = {
  data: T
  status: number
  message: string
}

// Export interface
export interface ApiClient {
  get<T>(url: string): Promise<ApiResponse<T>>
  post<T>(url: string, data: any): Promise<ApiResponse<T>>
  put<T>(url: string, data: any): Promise<ApiResponse<T>>
  delete<T>(url: string): Promise<ApiResponse<T>>
}

// Export class
export class HttpClient implements ApiClient {
  private baseUrl: string
  private headers: Record<string, string>

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
    this.headers = {
      'Content-Type': 'application/json'
    }
  }

  async get<T>(url: string): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseUrl}${url}`, {
      method: 'GET',
      headers: this.headers
    })
    return this.parseResponse<T>(response)
  }

  async post<T>(url: string, data: any): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseUrl}${url}`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(data)
    })
    return this.parseResponse<T>(response)
  }

  async put<T>(url: string, data: any): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseUrl}${url}`, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify(data)
    })
    return this.parseResponse<T>(response)
  }

  async delete<T>(url: string): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseUrl}${url}`, {
      method: 'DELETE',
      headers: this.headers
    })
    return this.parseResponse<T>(response)
  }

  private async parseResponse<T>(response: Response): Promise<ApiResponse<T>> {
    const data = await response.json()
    return {
      data,
      status: response.status,
      message: response.statusText
    }
  }
}

// Export function
export function createApiClient(baseUrl: string): ApiClient {
  return new HttpClient(baseUrl)
}

// Export async function
export async function fetchWithRetry<T>(
  url: string,
  retries: number = MAX_RETRIES
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url)
      return await response.json()
    } catch (error) {
      if (i === retries - 1) throw error
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
    }
  }
  throw new Error('Max retries exceeded')
}

// Default export
export default class DefaultApiClient extends HttpClient {
  constructor() {
    super('https://api.example.com')
  }

  setAuthToken(token: string): void {
    this.headers['Authorization'] = `Bearer ${token}`
  }
}

// Re-export from other modules (simulated)
export { User, AdminUser } from './classes'
export type { UserProfile, Config } from './interfaces'
export * from './functions'

// Namespace export
export namespace Utils {
  export function isValidUrl(url: string): boolean {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  export function parseQueryString(query: string): Record<string, string> {
    return Object.fromEntries(new URLSearchParams(query))
  }

  export const constants = {
    DEFAULT_TIMEOUT: 30000,
    MAX_PAYLOAD_SIZE: 1024 * 1024 * 10 // 10MB
  }
}

// Type-only export
export type { ApiClient as IApiClient }

// Export with alias
export { HttpClient as Client }

