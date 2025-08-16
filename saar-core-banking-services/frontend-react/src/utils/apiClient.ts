import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { store } from '../store';

export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  success: boolean;
}

export class ApiClient {
  private axiosInstance: AxiosInstance;
  private baseURL: string;

  constructor(baseURL?: string) {
  // Default to the ExpressionBuilderService running on http://localhost:5001
  // Can be overridden via REACT_APP_EXPRESSION_API_URL
  this.baseURL = baseURL || process.env.REACT_APP_EXPRESSION_API_URL || 'http://localhost:5001';
    
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor to add auth token
    this.axiosInstance.interceptors.request.use(
      (config) => {
        const state = store.getState();
        const token = state.auth?.token;

        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Add tenant ID if available
        const tenantId = state.auth?.user?.tenantId;
        if (tenantId) {
          config.headers['X-Tenant-ID'] = tenantId;
        }

        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => {
        return response;
      },
      (error) => {
        if (error.response?.status === 401) {
          // Handle unauthorized access
          store.dispatch({ type: 'auth/logout' });
          window.location.href = '/login';
        }

        if (error.response?.status === 403) {
          // Handle forbidden access
          console.warn('Access forbidden:', error.response.data);
        }

        if (error.response?.status >= 500) {
          // Handle server errors
          console.error('Server error:', error.response.data);
        }

        return Promise.reject(error);
      }
    );
  }

  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.axiosInstance.get<T>(url, config);
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async post<T = any, D = any>(url: string, data?: D, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.axiosInstance.post<T>(url, data, config);
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async put<T = any, D = any>(url: string, data?: D, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.axiosInstance.put<T>(url, data, config);
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async patch<T = any, D = any>(url: string, data?: D, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.axiosInstance.patch<T>(url, data, config);
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.axiosInstance.delete<T>(url, config);
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  private handleError(error: any): void {
    if (error.response) {
      // Server responded with error status
      console.error('API Error Response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        url: error.config?.url,
      });
    } else if (error.request) {
      // Request was made but no response received
      console.error('API Network Error:', {
        message: 'No response received from server',
        url: error.config?.url,
      });
    } else {
      // Something else happened
      console.error('API Error:', error.message);
    }
  }

  // Utility method to get full URL
  getFullUrl(endpoint: string): string {
    return `${this.baseURL}${endpoint}`;
  }

  // Method to update base URL if needed
  updateBaseURL(newBaseURL: string): void {
    this.baseURL = newBaseURL;
    this.axiosInstance.defaults.baseURL = newBaseURL;
  }
}

// Create default instance
export const apiClient = new ApiClient();
export default apiClient;
