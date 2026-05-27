import { apiClient } from './client';
import {
  Server,
  UserProfile,
  ServerMetric,
  BackupJob,
  BackupStatusEntry,
  BillingInfo,
  Transaction,
  CostEstimate,
  LogEntry,
} from '../types';

export const endpoints = {
  auth: {
    login: (email: string, password: string) =>
      apiClient.post<{ token: string; user: UserProfile }>('/api/auth/login', { email, password }),
    register: (email: string, password: string, displayName: string) =>
      apiClient.post<{ token: string; user: UserProfile }>('/api/auth/register', {
        email,
        password,
        displayName,
      }),
    me: () => apiClient.get<UserProfile>('/api/user'),
  },

  servers: {
    list: () => apiClient.get<Server[]>('/api/apps'),
    get: (id: string) => apiClient.get<Server>(`/api/apps/${id}`),
    create: (data: Partial<Server>) => apiClient.post<Server>('/api/apps', data),
    update: (id: string, data: Partial<Server>) =>
      apiClient.patch<Server>(`/api/apps/${id}`, data),
    delete: (id: string) => apiClient.delete<void>(`/api/apps/${id}`),
    start: (id: string) => apiClient.post<Server>(`/api/apps/${id}/start`),
    stop: (id: string) => apiClient.post<Server>(`/api/apps/${id}/stop`),
    restart: (id: string) => apiClient.post<Server>(`/api/apps/${id}/restart`),
  },

  logs: {
    get: (appId: string, limit = 100, offset = 0) =>
      apiClient.get<LogEntry[]>(`/api/apps/${appId}/logs`, { limit, offset }),
    search: (
      appId: string,
      params: { query?: string; level?: string; from?: string; to?: string; page?: number; limit?: number }
    ) =>
      apiClient.get<{ logs: LogEntry[]; total: number; page: number }>(
        `/api/apps/${appId}/logs`,
        params
      ),
  },

  metrics: {
    get: (appId: string, range = '30m') =>
      apiClient.get<ServerMetric[]>(`/api/apps/${appId}/metrics`, { range }),
    aggregated: () => apiClient.get<any>('/api/metrics/aggregated'),
  },

  backups: {
    list: () => apiClient.get<BackupJob[]>('/api/backup-jobs'),
    create: (job: Partial<BackupJob>) => apiClient.post<BackupJob>('/api/backup-jobs', job),
    update: (id: string, updates: Partial<BackupJob>) =>
      apiClient.patch<BackupJob>(`/api/backup-jobs/${id}`, updates),
    delete: (id: string) => apiClient.delete<void>(`/api/backup-jobs/${id}`),
    status: (jobId: string) =>
      apiClient.get<BackupStatusEntry[]>(`/api/backup-jobs/${jobId}/status`),
  },

  billing: {
    balance: () => apiClient.get<BillingInfo>('/api/billing/balance'),
    topUp: (amount: number) => apiClient.post<BillingInfo>('/api/billing/topup', { amount }),
    transactions: () => apiClient.get<Transaction[]>('/api/billing/transactions'),
    costEstimate: (cpu: number, ram: number, storage: number) =>
      apiClient.get<CostEstimate>('/api/billing/cost-estimate', { cpu, ram, storage }),
    rates: () => apiClient.get<any>('/api/billing/rates'),
  },

  health: () => apiClient.get<{ status: string }>('/health'),
};
