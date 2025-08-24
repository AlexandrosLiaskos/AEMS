import { useState, useCallback } from 'react';
import { setupApi } from '@/services/api/setup-api';

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
 * @hook useSetup
 * @purpose Hook for managing setup wizard state and operations
 */
export const useSetup = () => {
  const [progress, setProgress] = useState<SetupProgress | null>(null);
  const [currentStepData, setCurrentStepData] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * @method loadProgress
   * @purpose Load setup progress from API
   */
  const loadProgress = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const progressData = await setupApi.getProgress();
      setProgress(progressData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load setup progress';
      setError(errorMessage);
      console.error('Failed to load setup progress:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * @method checkSetupStatus
   * @purpose Check if setup is required
   */
  const checkSetupStatus = useCallback(async () => {
    try {
      return await setupApi.getStatus();
    } catch (err) {
      console.error('Failed to check setup status:', err);
      return {
        setupRequired: true,
        isComplete: false,
        currentStep: 0,
        totalSteps: 5,
      };
    }
  }, []);

  /**
   * @method validateStep
   * @purpose Validate step data
   */
  const validateStep = useCallback(async (
    stepId: string,
    data: Record<string, any>
  ): Promise<SetupValidationResult> => {
    try {
      return await setupApi.validateStep(stepId, data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Validation failed';
      return {
        isValid: false,
        errors: { general: errorMessage },
        warnings: {},
      };
    }
  }, []);

  /**
   * @method saveStep
   * @purpose Save step data
   */
  const saveStep = useCallback(async (stepId: string, data: Record<string, any>) => {
    setError(null);

    try {
      await setupApi.saveStep(stepId, data);
      
      // Update current step data
      setCurrentStepData(prev => ({
        ...prev,
        ...data,
      }));

      // Reload progress to get updated state
      await loadProgress();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save step data';
      setError(errorMessage);
      throw err;
    }
  }, [loadProgress]);

  /**
   * @method completeSetup
   * @purpose Complete the setup process
   */
  const completeSetup = useCallback(async (): Promise<SetupCompletionResult> => {
    setError(null);

    try {
      const result = await setupApi.completeSetup();
      
      // Reload progress to reflect completion
      await loadProgress();
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to complete setup';
      setError(errorMessage);
      throw err;
    }
  }, [loadProgress]);

  /**
   * @method getSystemInfo
   * @purpose Get system information
   */
  const getSystemInfo = useCallback(async () => {
    try {
      return await setupApi.getSystemInfo();
    } catch (err) {
      console.error('Failed to get system info:', err);
      return null;
    }
  }, []);

  /**
   * @method resetSetup
   * @purpose Reset setup (development only)
   */
  const resetSetup = useCallback(async () => {
    if (process.env.NODE_ENV !== 'development') {
      throw new Error('Setup reset is only available in development mode');
    }

    setError(null);

    try {
      await setupApi.resetSetup();
      await loadProgress();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reset setup';
      setError(errorMessage);
      throw err;
    }
  }, [loadProgress]);

  return {
    // State
    progress,
    currentStepData,
    isLoading,
    error,

    // Actions
    loadProgress,
    checkSetupStatus,
    validateStep,
    saveStep,
    completeSetup,
    getSystemInfo,
    resetSetup,

    // Computed values
    currentStep: progress?.steps[progress.currentStep] || null,
    isSetupComplete: progress?.isComplete || false,
    canProceed: progress?.canProceed || false,
  };
};