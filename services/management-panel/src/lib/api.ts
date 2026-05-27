import axios, { AxiosInstance } from 'axios';
import { DockerApp, SetupStatus, UserProfile, AppConfig, Customer, ServerPreset, ServerMetric, AccessLog, ConfigVersion, MaintenanceWindow, BackupJob, BackupStatusEntry, AlertConfig, AlertHistoryEntry, HealthCheck, ScheduledTask, GitDeployment, Database, BillingInfo, Transaction, BillingRates, CostEstimate, Modpack, ModpackInstallation } from './types';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

class APIClient {
  private api: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.api = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  setToken(token: string) {
    this.token = token;
    this.api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  clearToken() {
    this.token = null;
    delete this.api.defaults.headers.common['Authorization'];
  }

  // Setup endpoints
  async getSetupStatus(): Promise<SetupStatus> {
    const res = await this.api.get('/api/setup/status');
    return res.data;
  }

  async initSetup(email: string, password: string, displayName: string, mode: 'personal' | 'business') {
    const res = await this.api.post('/api/setup/init', {
      email,
      password,
      displayName,
      mode,
    });
    return res.data;
  }



  async listPresets(): Promise<ServerPreset[]> {
    const res = await this.api.get('/api/presets');
    return res.data;
  }

  // Docker app endpoints
  async listApps(): Promise<DockerApp[]> {
    const res = await this.api.get('/api/apps');
    return res.data;
  }

  async getApp(appId: string): Promise<DockerApp> {
    const res = await this.api.get(`/api/apps/${appId}`);
    return res.data;
  }

  async createApp(app: Partial<DockerApp>): Promise<DockerApp> {
    const res = await this.api.post('/api/apps', app);
    return res.data;
  }

  async updateApp(appId: string, updates: Partial<DockerApp>): Promise<DockerApp> {
    const res = await this.api.patch(`/api/apps/${appId}`, updates);
    return res.data;
  }

  async deleteApp(appId: string): Promise<void> {
    await this.api.delete(`/api/apps/${appId}`);
  }

  // Container control endpoints
  async startApp(appId: string): Promise<DockerApp> {
    const res = await this.api.post(`/api/apps/${appId}/start`);
    return res.data;
  }

  async stopApp(appId: string): Promise<DockerApp> {
    const res = await this.api.post(`/api/apps/${appId}/stop`);
    return res.data;
  }

  async restartApp(appId: string): Promise<DockerApp> {
    const res = await this.api.post(`/api/apps/${appId}/restart`);
    return res.data;
  }

  async getLogs(appId: string, limit = 50, offset = 0): Promise<Array<any>> {
    const res = await this.api.get(`/api/apps/${appId}/logs`, {
      params: { limit, offset },
    });
    return res.data;
  }

  async searchLogs(appId: string, params: { query?: string; level?: string; from?: string; to?: string; page?: number; limit?: number }): Promise<{ logs: any[]; total: number; page: number }> {
    const res = await this.api.get(`/api/apps/${appId}/logs`, {
      params: { search: params.query, level: params.level, from: params.from, to: params.to, page: params.page, limit: params.limit },
    });
    return { logs: res.data.data || [], total: res.data.total || 0, page: res.data.page || 1 };
  }

  // User endpoints
  async getUser(): Promise<UserProfile> {
    const res = await this.api.get('/api/user');
    return res.data;
  }

  // Config endpoints
  async getConfig(): Promise<AppConfig> {
    const res = await this.api.get('/api/config/mode');
    return res.data;
  }

  // Customers (Business Mode MVP)
  async getCustomers(): Promise<Customer[]> {
    const res = await this.api.get('/api/customers');
    return res.data;
  }

  async createCustomer(customer: Partial<Customer>): Promise<Customer> {
    const res = await this.api.post('/api/customers', customer);
    return res.data;
  }

  async updateCustomer(customerId: string, updates: Partial<Customer>): Promise<any> {
    const res = await this.api.patch(`/api/customers/${customerId}`, updates);
    return res.data;
  }

  async deleteCustomer(customerId: string): Promise<any> {
    const res = await this.api.delete(`/api/customers/${customerId}`);
    return res.data;
  }

  // Seed demo data (customers + apps)
  async seedDemo(): Promise<any> {
    const res = await this.api.post('/api/seed-demo');
    return res.data;
  }

  // Phase 4: Server Metrics
  async getServerMetrics(appId: string, range = '30m'): Promise<ServerMetric[]> {
    const res = await this.api.get(`/api/apps/${appId}/metrics`, { params: { range } });
    return res.data;
  }

  async getAggregatedMetrics(): Promise<any> {
    const res = await this.api.get('/api/metrics/aggregated');
    return res.data;
  }

  // Access Logs
  async getAccessLogs(limit = 50, offset = 0): Promise<AccessLog[]> {
    const res = await this.api.get('/api/logs/access', { params: { limit, offset } });
    return res.data;
  }

  // Config Versions
  async getConfigVersions(appId: string): Promise<ConfigVersion[]> {
    const res = await this.api.get(`/api/apps/${appId}/config-versions`);
    return res.data;
  }

  async createConfigVersion(appId: string, snapshot: Record<string, any>, summary: string): Promise<ConfigVersion> {
    const res = await this.api.post(`/api/apps/${appId}/config-versions`, { config_snapshot: snapshot, change_summary: summary });
    return res.data;
  }

  async rollbackConfig(appId: string, version: number): Promise<ConfigVersion> {
    const res = await this.api.post(`/api/apps/${appId}/config-versions/${version}/rollback`);
    return res.data;
  }

  // Maintenance Windows
  async getMaintenanceWindows(): Promise<MaintenanceWindow[]> {
    const res = await this.api.get('/api/maintenance-windows');
    return res.data;
  }

  async createMaintenanceWindow(window: Partial<MaintenanceWindow>): Promise<MaintenanceWindow> {
    const res = await this.api.post('/api/maintenance-windows', window);
    return res.data;
  }

  async updateMaintenanceWindow(id: string, updates: Partial<MaintenanceWindow>): Promise<MaintenanceWindow> {
    const res = await this.api.patch(`/api/maintenance-windows/${id}`, updates);
    return res.data;
  }

  // Backup Jobs
  async getBackupJobs(): Promise<BackupJob[]> {
    const res = await this.api.get('/api/backup-jobs');
    return res.data;
  }

  async createBackupJob(job: Partial<BackupJob>): Promise<BackupJob> {
    const res = await this.api.post('/api/backup-jobs', job);
    return res.data;
  }

  async updateBackupJob(id: string, updates: Partial<BackupJob>): Promise<BackupJob> {
    const res = await this.api.patch(`/api/backup-jobs/${id}`, updates);
    return res.data;
  }

  async deleteBackupJob(id: string): Promise<void> {
    await this.api.delete(`/api/backup-jobs/${id}`);
  }

  async getBackupStatus(jobId: string): Promise<BackupStatusEntry[]> {
    const res = await this.api.get(`/api/backup-jobs/${jobId}/status`);
    return res.data;
  }

  // Alert Configs
  async getAlertConfigs(): Promise<AlertConfig[]> {
    const res = await this.api.get('/api/alert-configs');
    return res.data;
  }

  async createAlertConfig(config: Partial<AlertConfig>): Promise<AlertConfig> {
    const res = await this.api.post('/api/alert-configs', config);
    return res.data;
  }

  async updateAlertConfig(id: string, updates: Partial<AlertConfig>): Promise<AlertConfig> {
    const res = await this.api.patch(`/api/alert-configs/${id}`, updates);
    return res.data;
  }

  async deleteAlertConfig(id: string): Promise<void> {
    await this.api.delete(`/api/alert-configs/${id}`);
  }

  async getAlertHistory(): Promise<AlertHistoryEntry[]> {
    const res = await this.api.get('/api/alert-history');
    return res.data;
  }

  async acknowledgeAlert(id: number): Promise<void> {
    await this.api.post(`/api/alert-history/${id}/acknowledge`);
  }

  // Health Checks
  async getHealthChecks(appId?: string): Promise<HealthCheck[]> {
    const params = appId ? { app_id: appId } : {};
    const res = await this.api.get('/api/health-checks', { params });
    return res.data;
  }

  async getReports(startDate?: string, endDate?: string): Promise<any> {
    const params: any = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const res = await this.api.get('/api/reports', { params });
    return res.data;
  }

  async exportReport(format: 'pdf' | 'csv', startDate?: string, endDate?: string): Promise<Blob> {
    const params: any = { format };
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const res = await this.api.get('/api/reports/export', { params, responseType: 'blob' });
    return res.data;
  }

  // Scheduled Tasks
  async getScheduledTasks(): Promise<ScheduledTask[]> {
    const res = await this.api.get('/api/scheduled-tasks');
    return res.data;
  }

  async createScheduledTask(task: Partial<ScheduledTask>): Promise<ScheduledTask> {
    const res = await this.api.post('/api/scheduled-tasks', task);
    return res.data;
  }

  async updateScheduledTask(id: string, updates: Partial<ScheduledTask>): Promise<ScheduledTask> {
    const res = await this.api.patch(`/api/scheduled-tasks/${id}`, updates);
    return res.data;
  }

  async deleteScheduledTask(id: string): Promise<void> {
    await this.api.delete(`/api/scheduled-tasks/${id}`);
  }

  async toggleScheduledTask(id: string): Promise<ScheduledTask> {
    const res = await this.api.post(`/api/scheduled-tasks/${id}/toggle`);
    return res.data;
  }

  // Discord token validation
  async validateDiscordToken(token: string): Promise<{valid: boolean; botName?: string; guildCount?: number; error?: string}> {
    const res = await this.api.post('/api/validate/discord-token', { token });
    return res.data;
  }

  // Config file management
  async listConfigFiles(appId: string, path?: string): Promise<{files: any[]; currentPath: string}> {
    const params: any = {};
    if (path) params.path = path;
    const res = await this.api.get(`/api/apps/${appId}/config`, { params });
    return res.data;
  }

  async readConfigFile(appId: string, filePath: string): Promise<{content: string; path: string; language: string}> {
    const res = await this.api.get(`/api/apps/${appId}/config/read`, { params: { file: filePath } });
    return res.data;
  }

  async writeConfigFile(appId: string, filePath: string, content: string): Promise<{success: boolean; backupPath: string}> {
    const res = await this.api.post(`/api/apps/${appId}/config/write`, { path: filePath, content });
    return res.data;
  }

  async validateConfigFile(appId: string, filePath: string): Promise<{valid: boolean; errors: string[]}> {
    const res = await this.api.get(`/api/apps/${appId}/config/validate`, { params: { file: filePath } });
    return res.data;
  }

  // Git Deployments
  async getDeployments(): Promise<GitDeployment[]> {
    const res = await this.api.get('/api/deployments');
    return res.data;
  }

  async createDeployment(deployment: Partial<GitDeployment>): Promise<GitDeployment> {
    const res = await this.api.post('/api/deployments', deployment);
    return res.data;
  }

  async deleteDeployment(id: string): Promise<void> {
    await this.api.delete(`/api/deployments/${id}`);
  }

  async toggleDeployment(id: string): Promise<GitDeployment> {
    const res = await this.api.patch(`/api/deployments/${id}/toggle`);
    return res.data;
  }

  async getDeploymentHistory(id: string): Promise<{history: any[]}> {
    const res = await this.api.get(`/api/deployments/${id}/history`);
    return res.data;
  }

  // Database endpoints
  async getDatabases(): Promise<Database[]> {
    const res = await this.api.get('/api/databases');
    return res.data;
  }

  async createDatabase(name: string, appId?: string): Promise<Database> {
    const res = await this.api.post('/api/databases', { name, appId });
    return res.data;
  }

  async getDatabase(id: string): Promise<Database> {
    const res = await this.api.get(`/api/databases/${id}`);
    return res.data;
  }

  async deleteDatabase(id: string): Promise<void> {
    await this.api.delete(`/api/databases/${id}`);
  }

  // Billing endpoints
  async getBalance(): Promise<BillingInfo> {
    const res = await this.api.get('/api/billing/balance');
    return res.data;
  }

  async topUp(amount: number): Promise<BillingInfo> {
    const res = await this.api.post('/api/billing/topup', { amount });
    return res.data;
  }

  async getTransactions(): Promise<Transaction[]> {
    const res = await this.api.get('/api/billing/transactions');
    return res.data;
  }

  async getCostEstimate(cpu: number, ram: number, storage: number): Promise<CostEstimate> {
    const res = await this.api.get('/api/billing/cost-estimate', { params: { cpu, ram, storage } });
    return res.data;
  }

  async getBillingRates(): Promise<BillingRates> {
    const res = await this.api.get('/api/billing/rates');
    return res.data;
  }

  // Real-time metrics
  async getRealtimeMetrics(appId?: string): Promise<any> {
    const params = appId ? { appId } : {};
    const res = await this.api.get('/api/metrics/realtime', { params });
    return res.data;
  }

  async getMetricsHistory(appId?: string, period = '1h', resolution = '5m'): Promise<any> {
    const params: any = { period, resolution };
    if (appId) params.appId = appId;
    const res = await this.api.get('/api/metrics/history', { params });
    return res.data;
  }

  async configureMetricsSource(config: { type: string; url: string; apiKey?: string }): Promise<any> {
    const res = await this.api.post('/api/metrics/stream/config', config);
    return res.data;
  }

  async getGrafanaUrl(): Promise<{ url: string | null }> {
    const res = await this.api.get('/api/metrics/grafana-url');
    return res.data;
  }

  // Modpack endpoints
  async searchModpacks(query: string, platform?: string): Promise<Modpack[]> {
    const params: any = { query };
    if (platform) params.platform = platform;
    const res = await this.api.get('/api/modpacks/search', { params });
    return res.data.results || [];
  }

  async installModpack(appId: string, modpackId: string, platform: string): Promise<ModpackInstallation> {
    const res = await this.api.post(`/api/apps/${appId}/modpacks/install`, { modpackId, platform });
    return res.data;
  }

  async getModpackInstallationStatus(appId: string): Promise<ModpackInstallation[]> {
    const res = await this.api.get(`/api/apps/${appId}/modpacks/status`);
    return res.data;
  }

  // Knowledge Base API
  async listArticles(): Promise<import('./types').KBArticle[]> {
    const res = await this.api.get('/api/kb/articles');
    return res.data;
  }

  async getArticle(id: string): Promise<import('./types').KBArticle> {
    const res = await this.api.get(`/api/kb/articles/${id}`);
    return res.data;
  }

  async createArticle(data: Partial<import('./types').KBArticle>): Promise<import('./types').KBArticle> {
    const res = await this.api.post('/api/kb/articles', data);
    return res.data;
  }

  async updateArticle(id: string, data: Partial<import('./types').KBArticle>): Promise<import('./types').KBArticle> {
    const res = await this.api.put(`/api/kb/articles/${id}`, data);
    return res.data;
  }

  async deleteArticle(id: string): Promise<void> {
    await this.api.delete(`/api/kb/articles/${id}`);
  }

  async searchArticles(query: string): Promise<import('./types').KBArticle[]> {
    const res = await this.api.get('/api/kb/search', { params: { q: query } });
    return res.data;
  }

  async getCategories(): Promise<import('./types').KBCategory[]> {
    const res = await this.api.get('/api/kb/categories');
    return res.data;
  }

  async createCategory(data: Partial<import('./types').KBCategory>): Promise<import('./types').KBCategory> {
    const res = await this.api.post('/api/kb/categories', data);
    return res.data;
  }

  async deleteCategory(id: string): Promise<void> {
    await this.api.delete(`/api/kb/categories/${id}`);
  }

  // Activity Feed API
  async getActivityFeed(params: { limit?: number; offset?: number; type?: string; userId?: string; from?: string; to?: string }): Promise<{ events: import('./types').ActivityEvent[]; total: number }> {
    const res = await this.api.get('/api/activity', { params });
    return res.data;
  }

  async getActivityDetail(id: string): Promise<import('./types').ActivityEvent> {
    const res = await this.api.get(`/api/activity/${id}`);
    return res.data;
  }

  async exportActivity(params: { format?: 'csv' | 'json'; type?: string; userId?: string; from?: string; to?: string }): Promise<Blob> {
    const res = await this.api.get('/api/activity/export', { params, responseType: 'blob' });
    return res.data;
  }

  // Dashboard Builder API
  async listDashboards(): Promise<import('./types').DashboardDefinition[]> {
    const res = await this.api.get('/api/dashboards');
    return res.data;
  }

  async getDashboard(id: string): Promise<import('./types').DashboardDefinition> {
    const res = await this.api.get(`/api/dashboards/${id}`);
    return res.data;
  }

  async createDashboard(data: Partial<import('./types').DashboardDefinition>): Promise<import('./types').DashboardDefinition> {
    const res = await this.api.post('/api/dashboards', data);
    return res.data;
  }

  async updateDashboard(id: string, data: Partial<import('./types').DashboardDefinition>): Promise<import('./types').DashboardDefinition> {
    const res = await this.api.put(`/api/dashboards/${id}`, data);
    return res.data;
  }

  async deleteDashboard(id: string): Promise<void> {
    await this.api.delete(`/api/dashboards/${id}`);
  }

  async getDashboardData(id: string, params?: { period?: string }): Promise<any> {
    const res = await this.api.get(`/api/dashboards/${id}/data`, { params });
    return res.data;
  }

  // AI Config Advisor
  async getConfigAdvice(appId: string): Promise<any> {
    const res = await this.api.get(`/api/config/${appId}/advice`);
    return res.data;
  }

  async applyConfigAdvice(appId: string, suggestionId: string): Promise<any> {
    const res = await this.api.post(`/api/config/${appId}/advice/${suggestionId}/apply`);
    return res.data;
  }

  // Plugin Marketplace
  async listPlugins(appId?: string): Promise<any[]> {
    const params: any = {};
    if (appId) params.appId = appId;
    const res = await this.api.get('/api/plugins', { params });
    return res.data;
  }

  async getPlugin(id: string, appId?: string): Promise<any> {
    const params: any = {};
    if (appId) params.appId = appId;
    const res = await this.api.get(`/api/plugins/${id}`, { params });
    return res.data;
  }

  async installPlugin(id: string, appId: string): Promise<any> {
    const res = await this.api.post(`/api/plugins/${id}/install`, { appId });
    return res.data;
  }

  async uninstallPlugin(id: string, appId: string): Promise<any> {
    const res = await this.api.post(`/api/plugins/${id}/uninstall`, { appId });
    return res.data;
  }

  async publishPlugin(data: any): Promise<any> {
    const res = await this.api.post('/api/plugins', data);
    return res.data;
  }

  // Collaborative Terminal
  async createTerminalSession(appId: string): Promise<any> {
    const res = await this.api.post('/api/terminal/sessions', { appId });
    return res.data;
  }

  async getTerminalSession(sessionId: string): Promise<any> {
    const res = await this.api.get(`/api/terminal/sessions/${sessionId}`);
    return res.data;
  }

  // Change Approval Workflow
  async createChangeRequest(data: any): Promise<any> {
    const res = await this.api.post('/api/change-requests', data);
    return res.data;
  }

  async listChangeRequests(filter?: { status?: string; appId?: string }): Promise<any[]> {
    const params: any = {};
    if (filter?.status) params.status = filter.status;
    if (filter?.appId) params.appId = filter.appId;
    const res = await this.api.get('/api/change-requests', { params });
    return res.data;
  }

  async approveChangeRequest(id: string): Promise<any> {
    const res = await this.api.post(`/api/change-requests/${id}/approve`);
    return res.data;
  }

  async rejectChangeRequest(id: string, reason: string): Promise<any> {
    const res = await this.api.post(`/api/change-requests/${id}/reject`, { reason });
    return res.data;
  }

  // Health check
  async health(): Promise<{ status: string }> {
    const res = await this.api.get('/health');
    return res.data;
  }
}

  // i18n endpoints
  async getTranslations(): Promise<any> {
    const res = await this.api.get('/api/i18n/translations');
    return res.data;
  }

  async submitTranslation(data: { locale: string; key: string; value: string }): Promise<any> {
    const res = await this.api.post('/api/i18n/translations', data);
    return res.data;
  }

  // Theme Studio endpoints
  async listThemes(): Promise<any[]> {
    const res = await this.api.get('/api/themes');
    return res.data;
  }

  async getTheme(id: string): Promise<any> {
    const res = await this.api.get(`/api/themes/${id}`);
    return res.data;
  }

  async saveTheme(data: { name: string; config: any }): Promise<any> {
    const res = await this.api.post('/api/themes', data);
    return res.data;
  }

  async deleteTheme(id: string): Promise<void> {
    await this.api.delete(`/api/themes/${id}`);
  }

  async publishTheme(id: string): Promise<any> {
    const res = await this.api.post(`/api/themes/${id}/publish`);
    return res.data;
  }

  // Bulk Operations endpoints
  async bulkAction(action: string, ids: string[], params: any): Promise<any> {
    const res = await this.api.post('/api/bulk/execute', { action, ids, params });
    return res.data;
  }

  async getBulkActionStatus(batchId: string): Promise<any> {
    const res = await this.api.get(`/api/bulk/${batchId}`);
    return res.data;
  }

  async undoBulkAction(batchId: string): Promise<any> {
    const res = await this.api.post(`/api/bulk/${batchId}/undo`);
    return res.data;
  }
}

export const apiClient = new APIClient();
