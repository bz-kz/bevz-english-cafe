/**
 * API Client Configuration
 * バックエンドAPIとの通信を管理するクライアント
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

// API設定
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
const API_TIMEOUT = 30000; // 30秒

// Axiosインスタンスの作成
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// リクエストインターセプター
apiClient.interceptors.request.use(
  (config) => {
    // リクエスト送信前の処理
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    
    // 認証トークンがある場合は追加
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// レスポンスインターセプター
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    // レスポンス成功時の処理
    console.log(`API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    // レスポンスエラー時の処理
    console.error('API Response Error:', error);
    
    if (error.response) {
      // サーバーからのエラーレスポンス
      const { status, data } = error.response;
      
      switch (status) {
        case 401:
          // 認証エラー
          if (typeof window !== 'undefined') {
            localStorage.removeItem('auth_token');
            window.location.href = '/login';
          }
          break;
        case 403:
          // 権限エラー
          console.error('Access forbidden');
          break;
        case 404:
          // リソースが見つからない
          console.error('Resource not found');
          break;
        case 422:
          // バリデーションエラー
          console.error('Validation error:', data);
          break;
        case 500:
          // サーバーエラー
          console.error('Internal server error');
          break;
        default:
          console.error(`HTTP Error ${status}:`, data);
      }
      
      // エラーメッセージを統一形式で返す
      const errorMessage = data?.message || data?.error || `HTTP Error ${status}`;
      error.message = errorMessage;
    } else if (error.request) {
      // ネットワークエラー
      error.message = 'ネットワークエラーが発生しました。インターネット接続を確認してください。';
    } else {
      // その他のエラー
      error.message = '予期しないエラーが発生しました。';
    }
    
    return Promise.reject(error);
  }
);

// API関数の型定義
export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  success: boolean;
}

export interface ApiError {
  message: string;
  status?: number;
  errors?: Record<string, string[]>;
}

export interface ContactFormData {
  name: string;
  email: string;
  phone?: string;
  lesson_type: string;
  preferred_contact: string;
  message: string;
}

// 汎用API関数
export const api = {
  // GET リクエスト
  get: async <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    const response = await apiClient.get<ApiResponse<T>>(url, config);
    return response.data.data;
  },

  // POST リクエスト
  post: async <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
    const response = await apiClient.post<ApiResponse<T>>(url, data, config);
    return response.data.data;
  },

  // PUT リクエスト
  put: async <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
    const response = await apiClient.put<ApiResponse<T>>(url, data, config);
    return response.data.data;
  },

  // PATCH リクエスト
  patch: async <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
    const response = await apiClient.patch<ApiResponse<T>>(url, data, config);
    return response.data.data;
  },

  // DELETE リクエスト
  delete: async <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    const response = await apiClient.delete<ApiResponse<T>>(url, config);
    return response.data.data;
  },

  // ファイルアップロード
  upload: async <T = any>(url: string, file: File, onProgress?: (progress: number) => void): Promise<T> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post<ApiResponse<T>>(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });

    return response.data.data;
  },
};

// モックAPIのインポート
import { mockApi, USE_MOCK_API } from './mock-api';

// 特定のAPIエンドポイント
export const contactApi = {
  // ヘルスチェック
  healthCheck: async () => {
    try {
      const response = await apiClient.get('/health');
      return { success: true, data: response.data };
    } catch (error: any) {
      console.error('Health check failed:', error);
      return { 
        success: false, 
        error: error.message || 'API接続に失敗しました' 
      };
    }
  },

  // 問い合わせ送信（フロントエンド用のフィールド名に対応）
  submit: async (contactData: {
    name: string;
    email: string;
    phone?: string;
    lessonType: string;
    preferredContact: string;
    message: string;
  }) => {
    try {
      if (USE_MOCK_API) {
        const response = await mockApi.submitContact({
          name: contactData.name,
          email: contactData.email,
          phone: contactData.phone,
          lesson_type: contactData.lessonType,
          preferred_contact: contactData.preferredContact,
          message: contactData.message
        });
        return {
          success: response.success,
          message: response.message,
          id: response.data.id,
          timestamp: response.data.createdAt
        };
      }
      
      // フィールド名をバックエンド形式に変換
      const backendData = {
        name: contactData.name,
        email: contactData.email,
        phone: contactData.phone,
        lesson_type: contactData.lessonType,
        preferred_contact: contactData.preferredContact,
        message: contactData.message
      };
      
      const response = await apiClient.post('/api/v1/contacts/', backendData);
      return { 
        success: true, 
        message: response.data.message || 'お問い合わせを受け付けました',
        id: response.data.contact_id,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      console.error('Contact submission failed:', error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'お問い合わせの送信に失敗しました'
      };
    }
  },

  // 問い合わせ送信（バックエンド形式のフィールド名）
  submitContact: async (contactData: {
    name: string;
    email: string;
    phone?: string;
    lesson_type: string;
    preferred_contact: string;
    message: string;
  }) => {
    try {
      if (USE_MOCK_API) {
        const response = await mockApi.submitContact(contactData);
        return response.data;
      }
      
      const response = await apiClient.post('/api/v1/contacts/', contactData);
      return { 
        success: true, 
        message: response.data.message,
        id: response.data.contact_id,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      console.error('Contact submission failed:', error);
      throw new Error(error.response?.data?.detail || error.message || 'お問い合わせの送信に失敗しました');
    }
  },

  // 問い合わせ一覧取得（管理者用）
  getAll: async (params?: { page?: number; limit?: number; status?: string }) => {
    if (USE_MOCK_API) {
      const response = await mockApi.getContacts(params);
      return response.data;
    }
    return api.get('/contact', { params });
  },

  // 問い合わせ詳細取得（管理者用）
  getById: async (id: string) => {
    if (USE_MOCK_API) {
      const response = await mockApi.getContactById(id);
      return response.data;
    }
    return api.get(`/contact/${id}`);
  },

  // 問い合わせステータス更新（管理者用）
  updateStatus: async (id: string, status: string) => {
    if (USE_MOCK_API) {
      const response = await mockApi.updateContactStatus(id, status);
      return response.data;
    }
    return api.patch(`/contact/${id}/status`, { status });
  },
};

export default apiClient;