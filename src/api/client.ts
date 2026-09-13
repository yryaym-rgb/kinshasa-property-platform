import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { supabase } from '@/config/supabase';
import { APP_CONFIG } from '@/config/app.config';
import type { ApiError } from '@/types';

const MAX_RETRIES = 3;

export const apiClient = axios.create({
  baseURL: APP_CONFIG.apiBaseUrl,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  config.headers.apikey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as InternalAxiosRequestConfig & { _retryCount?: number };

    if (error.response?.status === 401 && config) {
      const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError && session) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
        return apiClient(config);
      }
    }

    if (config && (!config._retryCount || config._retryCount < MAX_RETRIES)) {
      config._retryCount = (config._retryCount ?? 0) + 1;
      const delay = Math.pow(2, config._retryCount) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return apiClient(config);
    }

    return Promise.reject(normalizeError(error));
  },
);

export function normalizeError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string; code?: string } | undefined;
    return {
      message: data?.message ?? error.message ?? 'Une erreur est survenue',
      code: data?.code ?? String(error.response?.status ?? 'UNKNOWN'),
    };
  }
  if (error instanceof Error) {
    return { message: error.message };
  }
  return { message: 'Une erreur inattendue est survenue' };
}

export default apiClient;
