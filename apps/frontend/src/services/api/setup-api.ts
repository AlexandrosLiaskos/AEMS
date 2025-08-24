import { apiClient } from './client';

/**
 * @interface SetupProgress
 * @purpose Setup progress information
 */
interface SetupProgress {
  currentStep: number;
  totalSteps: number;
  completedSteps: number;
  isComplete: boolean;
  canProceed: boolean;
  steps: SetupWizardStep[];
}

/**
 * @interface SetupWizardStep
 * @purpose Setup wizard step definition
 */
interface SetupWizardStep {
  id: string;
  title: string;
  description: string;
  fields: SetupField[];
  isComplete: boolean;
  isRequired: boolean;
}

/**
 * @interface SetupField
 * @purpose Setup field definition
 */
interface SetupField {
  name: string;
  label: string;
  type: 'text' | 'password' | 'email' | 'url' | 'number' | 'boolean' | 'select';
  required: boolean;
  placeholder?: string;
  description?: string;
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
  };
  options?: Array<{ value: string; label: string }>;
  value?: any;
}

/**
 * @interface SetupStatus
 * @purpose Setup status information
 */
interface SetupStatus {
  setupRequired: boolean;
  isComplete: boolean;
  currentStep: number;
  totalSteps: number;
}

/**
 * @interface SetupValidationResult
 * @purpose Setup validation result
 */
interface SetupValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
}

/**
 * @interface SetupCompletionResult
 * @purpose Setup completion result
 */
interface SetupCompletionResult {
  success: boolean;
  message: string;
  configPath: string;
}

/**
 * @interface SystemInfo
 * @purpose System information
 */
interface SystemInfo {
  platform: string;
  nodeVersion: string;
  appVersion: string;
  dataPath: string;
  configPath: string;
}

/**
 * @class SetupApi
 * @purpose API client for setup operations
 */
class SetupApi {
  private readonly baseUrl = '/api/setup';

  /**
   * @method getProgress
   * @purpose Get setup progress and wizard steps
   */
  async getProgress(): Promise<SetupProgress> {
    const response = await apiClient.get(`${this.baseUrl}/progress`);
    return response.data;
  }

  /**
   * @method getStatus
   * @purpose Check if setup is required
   */
  async getStatus(): Promise<SetupStatus> {
    const response = await apiClient.get(`${this.baseUrl}/status`);
    return response.data;
  }

  /**
   * @method getStep
   * @purpose Get specific setup step details
   */
  async getStep(stepId: string): Promise<SetupWizardStep> {
    const response = await apiClient.get(`${this.baseUrl}/steps/${stepId}`);
    return response.data;
  }

  /**
   * @method validateStep
   * @purpose Validate setup step data without saving
   */
  async validateStep(stepId: string, data: Record<string, any>): Promise<SetupValidationResult> {
    const response = await apiClient.post(`${this.baseUrl}/steps/${stepId}/validate`, data);
    return response.data;
  }

  /**
   * @method saveStep
   * @purpose Save setup step data
   */
  async saveStep(stepId: string, data: Record<string, any>): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post(`${this.baseUrl}/steps/${stepId}`, data);
    return response.data;
  }

  /**
   * @method completeSetup
   * @purpose Complete the setup process
   */
  async completeSetup(): Promise<SetupCompletionResult> {
    const response = await apiClient.post(`${this.baseUrl}/complete`);
    return response.data;
  }

  /**
   * @method getSystemInfo
   * @purpose Get system information for setup
   */
  async getSystemInfo(): Promise<SystemInfo> {
    const response = await apiClient.get(`${this.baseUrl}/system-info`);
    return response.data;
  }

  /**
   * @method resetSetup
   * @purpose Reset setup process (development only)
   */
  async resetSetup(): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post(`${this.baseUrl}/reset`);
    return response.data;
  }
}

/**
 * @constant setupApi
 * @purpose Singleton instance of SetupApi
 */
export const setupApi = new SetupApi();