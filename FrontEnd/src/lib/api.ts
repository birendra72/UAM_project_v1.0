export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:8000`;

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
}

export interface AdminUser extends User {
  projects: number;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  status?: string;
  created_at: string;
}

export interface Dataset {
  id: string;
  filename: string;
  rows?: number;
  cols?: number;
  size?: string;
  validation_status?: string;
  last_validated?: string;
  columns_json?: Record<string, string>;
}

export interface Notification {
  id: string;
  message: string;
  read: boolean;
  created_at: string;
}

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    // Conditionally set Content-Type header only if method is not OPTIONS
    const method = options.method ? options.method.toUpperCase() : 'GET';
    const headers = {
      ...(method !== 'OPTIONS' ? { 'Content-Type': 'application/json' } : {}),
      ...this.getAuthHeaders(),
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorMessage = `API Error: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.detail) {
          errorMessage = errorData.detail;
        } else {
          errorMessage += ` - ${JSON.stringify(errorData)}`;
        }
      } catch {
        const errorText = await response.text();
        errorMessage += ` - ${errorText}`;
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  // Auth endpoints
  async login(email: string, password: string) {
    return this.request<{ access_token: string; token_type: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(name: string, email: string, password: string) {
    return this.request<{ access_token: string; token_type: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
  }

  async getCurrentUser(): Promise<User> {
    return this.request<User>('/api/auth/me');
  }

  // Projects endpoints
  async getProjects(): Promise<Project[]> {
    return this.request<Project[]>('/api/projects');
  }

  async createProject(name: string, description: string) {
    return this.request('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    });
  }

  async getProject(projectId: string): Promise<Project> {
    return this.request<Project>(`/api/projects/${projectId}`);
  }

  async getProjectDatasets(projectId: string): Promise<Dataset[]> {
    return this.request<Dataset[]>(`/api/projects/${projectId}/datasets`);
  }

  async deleteProject(projectId: string) {
    const token = localStorage.getItem('access_token');
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

    const response = await fetch(`${this.baseURL}/api/projects/${projectId}`, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      throw new Error(`Delete failed: ${response.status}`);
    }

    // No return for 204 No Content
  }

  // Datasets endpoints
  async getDatasets(projectId?: string): Promise<Dataset[]> {
    const query = projectId ? `?project_id=${projectId}` : '';
    return this.request<Dataset[]>(`/api/datasets${query}`);
  }

  async uploadDataset(file: File, projectId?: string) {
    const formData = new FormData();
    formData.append('file', file);
    if (projectId) {
      formData.append('project_id', projectId);
    }

    const token = localStorage.getItem('access_token');
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

    const response = await fetch(`${this.baseURL}/api/datasets/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }

    return response.json();
  }

  async linkDatasetToProject(datasetId: string, projectId: string) {
    return this.request(`/api/datasets/link/${datasetId}/${projectId}`, {
      method: 'POST',
    });
  }

  async unlinkDatasetFromProject(datasetId: string, projectId: string) {
    const token = localStorage.getItem('access_token');
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

    const response = await fetch(`${this.baseURL}/api/datasets/link/${datasetId}/${projectId}`, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      throw new Error(`Unlink failed: ${response.status}`);
    }

    // No return for 204 No Content
  }

  async getDatasetPreview(datasetId: string) {
    return this.request(`/api/datasets/${datasetId}/preview`);
  }

  async getDatasetSummary(datasetId: string) {
    return this.request(`/api/datasets/${datasetId}/summary`);
  }

  async analyzeDatasetTypes(datasetId: string) {
    return this.request(`/api/datasets/${datasetId}/analyze-types`, {
      method: 'POST',
    });
  }

  async validateDataset(datasetId: string) {
    return this.request(`/api/datasets/${datasetId}/validate`, {
      method: 'POST',
    });
  }

  async autoCleanDataset(datasetId: string, options?: Record<string, unknown>) {
    return this.request(`/api/datasets/${datasetId}/clean`, {
      method: 'POST',
      body: JSON.stringify({ options }),
    });
  }

  async getDatasetVersions(datasetId: string) {
    return this.request(`/api/datasets/${datasetId}/versions`);
  }

  async rollbackDatasetVersion(datasetId: string, versionId: string) {
    return this.request(`/api/datasets/${datasetId}/rollback/${versionId}`, {
      method: 'POST',
    });
  }

  async deleteDataset(datasetId: string) {
    const token = localStorage.getItem('access_token');
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

    const response = await fetch(`${this.baseURL}/api/datasets/${datasetId}`, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      throw new Error(`Delete failed: ${response.status}`);
    }

    // No return for 204 No Content
  }

  // Models endpoints
  async getModels() {
    return this.request('/api/models');
  }

  async trainModel(projectId: string, datasetId: string, options?: Record<string, unknown>) {
    return this.request('/api/models/train', {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId, dataset_id: datasetId, options }),
    });
  }

  // Analysis endpoints
  async startEDA(datasetId: string, projectId: string, options?: Record<string, unknown>): Promise<{ run_id: string }> {
    const query = new URLSearchParams({
      dataset_id: datasetId,
      project_id: projectId,
    });
    if (options) {
      query.append('options', JSON.stringify(options));
    }
    return this.request<{ run_id: string }>(`/api/analysis/eda?${query}`, {
      method: 'POST',
    });
  }

  async getEDAStatus(runId: string): Promise<{
    status: string;
    progress: number;
    current_task: string;
    artifacts: {
      chart_url?: string;
      summary_url?: string;
    };
  }> {
    return this.request<{
      status: string;
      progress: number;
      current_task: string;
      artifacts: {
        chart_url?: string;
        summary_url?: string;
      };
    }>(`/api/analysis/eda/${runId}/status`);
  }

  // Templates endpoints
  async getTemplates() {
    return this.request('/api/templates');
  }

  async applyTemplate(templateId: string, projectId: string) {
    return this.request(`/api/templates/${templateId}/apply`, {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId }),
    });
  }

  // Admin endpoints
  getAdminUsers = async (): Promise<AdminUser[]> => {
    return this.request<AdminUser[]>('/api/admin/users');
  };

  async updateAdminUser(userId: string, data: Partial<User>) {
    return this.request<User>(`/api/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteAdminUser(userId: string) {
    const token = localStorage.getItem('access_token');
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

    const response = await fetch(`${this.baseURL}/api/admin/users/${userId}`, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      throw new Error(`Delete failed: ${response.status}`);
    }

    // No return for 204 No Content
  }

  async getAdminStats() {
    return this.request('/api/admin/stats');
  }

  async getAdminLogs() {
    return this.request('/api/admin/logs');
  }

  async getAdminTemplates() {
    return this.request('/api/admin/templates');
  }

  async getAdminSystemHealth() {
    return this.request('/api/admin/system-health');
  }

  // Notifications endpoints
  async getNotifications(): Promise<Notification[]> {
    return this.request<Notification[]>('/api/notifications');
  }

  async markNotificationAsRead(notificationId: string) {
    return this.request(`/api/notifications/${notificationId}/read`, {
      method: 'POST',
    });
  }

  async getPortfolioStats(): Promise<{
    activeProjects: number;
    datasetsUsed: number;
    modelsTraining: number;
    avgDataQuality: string;
    topModelType: string;
  }> {
    return this.request<{
      activeProjects: number;
      datasetsUsed: number;
      modelsTraining: number;
      avgDataQuality: string;
      topModelType: string;
    }>('/api/projects/overview-stats');
  }

  async getRecentProjects(): Promise<Array<{
    id: string;
    name: string;
    dataset: string;
    status: string;
    updated: string;
  }>> {
    return this.request<Array<{
      id: string;
      name: string;
      dataset: string;
      status: string;
      updated: string;
    }>>('/api/projects/recent-projects');
  }

  // Reports endpoints
  async getProjectReports(projectId: string): Promise<Array<{
    id: string;
    filename: string;
    storage_key: string;
    created_at: string;
    metadata: Record<string, unknown>;
  }>> {
    return this.request<Array<{
      id: string;
      filename: string;
      storage_key: string;
      created_at: string;
      metadata: Record<string, unknown>;
    }>>(`/api/reports/projects/${projectId}/reports`);
  }

  async generateProjectReport(projectId: string, includeEDA: boolean, includeModels: boolean, format: string): Promise<{
    message: string;
    report_key: string;
    format: string;
    artifact_id: string;
  }> {
    return this.request<{
      message: string;
      report_key: string;
      format: string;
      artifact_id: string;
    }>(`/api/reports/projects/${projectId}/generate`, {
      method: 'POST',
      body: JSON.stringify({
        include_eda: includeEDA,
        include_models: includeModels,
        format_type: format
      }),
    });
  }

  async getReportDownloadUrl(artifactId: string): Promise<{
    download_url: string;
    filename: string;
    content_type: string;
  }> {
    return this.request<{
      download_url: string;
      filename: string;
      content_type: string;
    }>(`/api/reports/${artifactId}/download`);
  }

  // EDA endpoints
  async generateEDA(projectId: string): Promise<{ message: string; run_id?: string }> {
    return this.request<{ message: string; run_id?: string }>(`/api/projects/${projectId}/eda/generate`, {
      method: 'POST',
    });
  }

  async getEDAResults(projectId: string): Promise<{
    run_id: string;
    status: string;
    created_at: string;
    results?: {
      summary: Record<string, unknown>;
      correlations: Record<string, unknown>;
      insights: Array<{
        type: string;
        title?: string;
        message: string;
        severity?: string;
      }>;
      distributions: Record<string, unknown>;
      outliers: Record<string, unknown>;
    };
  }> {
    return this.request<{
      run_id: string;
      status: string;
      created_at: string;
      results?: {
        summary: Record<string, unknown>;
        correlations: Record<string, unknown>;
        insights: Array<{
          type: string;
          title?: string;
          message: string;
          severity?: string;
        }>;
        distributions: Record<string, unknown>;
        outliers: Record<string, unknown>;
      };
    }>(`/api/projects/${projectId}/eda/results`);
  }

  // ML endpoints
  async analyzeTaskType(projectId: string, targetColumn?: string): Promise<{
    project_id: string;
    task_analysis: {
      recommended_task: string;
      confidence: number;
      reasoning: string[];
      possible_targets?: Array<{
        column: string;
        task_type: string;
        unique_values: number;
        correlation_potential?: boolean;
        classes?: string[];
      }>;
      task_details?: Record<string, unknown>;
    };
    dataset_info: {
      total_rows: number;
      total_columns: number;
      numeric_columns: number;
      categorical_columns: number;
    };
  }> {
    const query = targetColumn ? `?target_column=${encodeURIComponent(targetColumn)}` : '';
    return this.request<{
      project_id: string;
      task_analysis: {
        recommended_task: string;
        confidence: number;
        reasoning: string[];
        possible_targets?: Array<{
          column: string;
          task_type: string;
          unique_values: number;
          correlation_potential?: boolean;
          classes?: string[];
        }>;
        task_details?: Record<string, unknown>;
      };
      dataset_info: {
        total_rows: number;
        total_columns: number;
        numeric_columns: number;
        categorical_columns: number;
      };
    }>(`/api/analysis/projects/${projectId}/ml/analyze-task${query}`, {
      method: 'POST',
    });
  }

  async trainAutoML(projectId: string, options: {
    task_type: string;
    target_column: string;
    test_size?: number;
    random_state?: number;
  }): Promise<{
    project_id: string;
    run_id: string;
    storage_key: string;
    task_type: string;
    models_trained: number;
    best_model: string;
  }> {
    return this.request<{
      project_id: string;
      run_id: string;
      storage_key: string;
      task_type: string;
      models_trained: number;
      best_model: string;
    }>(`/api/analysis/projects/${projectId}/ml/train-auto`, {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  async getTrainingStatus(projectId: string): Promise<{
    run_id: string;
    status: string;
    current_task: string | null;
    progress: number;
    started_at: string | null;
    finished_at: string | null;
    models_count: number;
    models: Array<{
      id: string;
      name: string;
      metrics: Record<string, unknown>;
      created_at: string;
    }>;
  } | {
    status: string;
    message: string;
  }> {
    return this.request<{
      run_id: string;
      status: string;
      current_task: string | null;
      progress: number;
      started_at: string | null;
      finished_at: string | null;
      models_count: number;
      models: Array<{
        id: string;
        name: string;
        metrics: Record<string, unknown>;
        created_at: string;
      }>;
    } | {
      status: string;
      message: string;
    }>(`/api/analysis/projects/${projectId}/ml/training-status`);
  }

  async getProjectModels(projectId: string): Promise<Array<{
    id: string;
    run_id: string;
    name: string;
    storage_key: string;
    metrics: Record<string, unknown>;
    version: string;
    created_at: string;
  }>> {
    return this.request<Array<{
      id: string;
      run_id: string;
      name: string;
      storage_key: string;
      metrics: Record<string, unknown>;
      version: string;
      created_at: string;
    }>>(`/api/analysis/projects/${projectId}/ml/models`);
  }

  async predict(modelId: string, data: Array<Record<string, unknown>>): Promise<{
    predictions: Array<unknown>;
  }> {
    return this.request<{
      predictions: Array<unknown>;
    }>(`/api/models/${modelId}/predict`, {
      method: 'POST',
      body: JSON.stringify({ data }),
    });
  }

  async predictFile(modelId: string, file: File): Promise<{
    predictions: Array<unknown>;
    summary: Record<string, unknown>;
  }> {
    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('access_token');
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

    const response = await fetch(`${this.baseURL}/api/models/${modelId}/predict-file`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Predict file failed: ${response.status}`);
    }

    return response.json();
  }

  async predictBatch(modelId: string, file: File, batchSize?: number): Promise<{
    task_id: string;
    status: string;
    message: string;
  }> {
    const formData = new FormData();
    formData.append('file', file);
    if (batchSize) {
      formData.append('batch_size', batchSize.toString());
    }

    const token = localStorage.getItem('access_token');
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

    const response = await fetch(`${this.baseURL}/api/models/${modelId}/predict-batch`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Batch predict failed: ${response.status}`);
    }

    return response.json();
  }

  // Hyperparameter tuning endpoints
  async performHyperparameterTuning(projectId: string, options: {
    task_type: string;
    target_column: string;
    algorithm: string;
    search_method?: string;
    max_evals?: number;
    cv_folds?: number;
    test_size?: number;
    random_state?: number;
  }): Promise<{
    run_id: string;
    algorithm: string;
    best_params: Record<string, unknown>;
    best_score: number;
    metrics: Record<string, number>;
    cv_results: {
      mean_test_score: number;
      std_test_score: number;
      n_candidates: number;
    };
  }> {
    return this.request<{
      run_id: string;
      algorithm: string;
      best_params: Record<string, unknown>;
      best_score: number;
      metrics: Record<string, number>;
      cv_results: {
        mean_test_score: number;
        std_test_score: number;
        n_candidates: number;
      };
    }>(`/api/analysis/projects/${projectId}/ml/hyperparameter-tuning`, {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  async getHyperparameterSpaces(taskType: string): Promise<Record<string, Record<string, unknown>>> {
    return this.request<Record<string, Record<string, unknown>>>(`/api/analysis/projects/ml/hyperparameter-spaces/${taskType}`);
  }

  // Advanced metrics endpoints
  async calculateAdvancedMetrics(projectId: string, modelId: string, taskType: string, targetColumn: string): Promise<{
    model_id: string;
    advanced_metrics: {
      confusion_matrix?: number[][];
      roc_curve?: {
        fpr: number[];
        tpr: number[];
        auc: number;
      };
      precision_recall_curve?: {
        precision: number[];
        recall: number[];
      };
      feature_importance?: {
        features: string[];
        importance: number[];
      };
    };
  }> {
    return this.request<{
      model_id: string;
      advanced_metrics: {
        confusion_matrix?: number[][];
        roc_curve?: {
          fpr: number[];
          tpr: number[];
          auc: number;
        };
        precision_recall_curve?: {
          precision: number[];
          recall: number[];
        };
        feature_importance?: {
          features: string[];
          importance: number[];
        };
      };
    }>(`/api/analysis/projects/${projectId}/ml/models/${modelId}/advanced-metrics`, {
      method: 'POST',
      body: JSON.stringify({
        task_type: taskType,
        target_column: targetColumn
      }),
    });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
