import { apiClient } from './client';

// Types
interface PipelineOptions {
  batchSize?: number;
  skipSync?: boolean;
  skipClassification?: boolean;
  skipExtraction?: boolean;
  forceReprocess?: boolean;
  categories?: string[];
}

interface PipelineResult {
  success: boolean;
  totalEmails: number;
  processed: number;
  classified: number;
  extracted: number;
  errors: number;
  duration: number;
  errorDetails: Array<{
    emailId: string;
    stage: string;
    error: string;
  }>;
}

interface PipelineStatus {
  isRunning: boolean;
  currentRun?: string;
}

interface PipelineStats {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  averageDuration: number;
  lastRun?: string;
  emailsProcessed: number;
  classificationsCreated: number;
  extractionsCreated: number;
}

/**
 * @namespace pipelineApi
 * @purpose API functions for pipeline operations
 */
export const pipelineApi = {
  /**
   * Run the email processing pipeline
   */
  async runPipeline(options: PipelineOptions): Promise<PipelineResult> {
    const response = await apiClient.post('/pipeline/run', options);
    return response.data;
  },

  /**
   * Get current pipeline status
   */
  async getStatus(): Promise<PipelineStatus> {
    const response = await apiClient.get('/pipeline/status');
    return response.data;
  },

  /**
   * Stop the current pipeline execution
   */
  async stopPipeline(): Promise<{ success: boolean }> {
    const response = await apiClient.post('/pipeline/stop');
    return response.data;
  },

  /**
   * Get pipeline execution statistics
   */
  async getStats(): Promise<PipelineStats> {
    const response = await apiClient.get('/pipeline/stats');
    return response.data;
  },

  /**
   * Run a quick sync and classification
   */
  async quickSync(): Promise<PipelineResult> {
    const response = await apiClient.post('/pipeline/quick-sync');
    return response.data;
  },

  /**
   * Run full processing including extraction
   */
  async fullProcessing(options: { 
    batchSize?: number; 
    forceReprocess?: boolean 
  } = {}): Promise<PipelineResult> {
    const response = await apiClient.post('/pipeline/full-processing', options);
    return response.data;
  },

  /**
   * GraphQL queries and mutations
   */
  graphql: {
    /**
     * Run pipeline via GraphQL
     */
    async runPipeline(options: PipelineOptions): Promise<PipelineResult> {
      const query = `
        mutation RunPipeline($options: PipelineOptionsDto) {
          runPipeline(options: $options) {
            success
            totalEmails
            processed
            classified
            extracted
            errors
            duration
            errorDetails {
              emailId
              stage
              error
            }
          }
        }
      `;

      const response = await apiClient.post('/graphql', {
        query,
        variables: { options },
      });

      return response.data.data.runPipeline;
    },

    /**
     * Get pipeline status via GraphQL
     */
    async getStatus(): Promise<PipelineStatus> {
      const query = `
        query GetPipelineStatus {
          getPipelineStatus {
            isRunning
            currentRun
          }
        }
      `;

      const response = await apiClient.post('/graphql', { query });
      return response.data.data.getPipelineStatus;
    },

    /**
     * Get pipeline stats via GraphQL
     */
    async getStats(): Promise<PipelineStats> {
      const query = `
        query GetPipelineStats {
          getPipelineStats {
            totalRuns
            successfulRuns
            failedRuns
            averageDuration
            lastRun
            emailsProcessed
            classificationsCreated
            extractionsCreated
          }
        }
      `;

      const response = await apiClient.post('/graphql', { query });
      return response.data.data.getPipelineStats;
    },

    /**
     * Stop pipeline via GraphQL
     */
    async stopPipeline(): Promise<boolean> {
      const query = `
        mutation StopPipeline {
          stopPipeline
        }
      `;

      const response = await apiClient.post('/graphql', { query });
      return response.data.data.stopPipeline;
    },

    /**
     * Quick sync via GraphQL
     */
    async quickSync(): Promise<PipelineResult> {
      const query = `
        mutation RunQuickSync {
          runQuickSync {
            success
            totalEmails
            processed
            classified
            extracted
            errors
            duration
            errorDetails {
              emailId
              stage
              error
            }
          }
        }
      `;

      const response = await apiClient.post('/graphql', { query });
      return response.data.data.runQuickSync;
    },

    /**
     * Full processing via GraphQL
     */
    async fullProcessing(options: { 
      batchSize?: number; 
      forceReprocess?: boolean 
    } = {}): Promise<PipelineResult> {
      const query = `
        mutation RunFullProcessing($batchSize: Int, $forceReprocess: Boolean) {
          runFullProcessing(batchSize: $batchSize, forceReprocess: $forceReprocess) {
            success
            totalEmails
            processed
            classified
            extracted
            errors
            duration
            errorDetails {
              emailId
              stage
              error
            }
          }
        }
      `;

      const response = await apiClient.post('/graphql', {
        query,
        variables: options,
      });

      return response.data.data.runFullProcessing;
    },
  },
};