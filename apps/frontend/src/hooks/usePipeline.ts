import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// API
import { pipelineApi } from '@/lib/api/pipeline';

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
 * @hook usePipeline
 * @purpose Hook for managing pipeline operations
 */
export const usePipeline = () => {
  const queryClient = useQueryClient();
  const [isPolling, setIsPolling] = useState(false);

  // Get pipeline status
  const { 
    data: pipelineStatus, 
    isLoading: statusLoading,
    refetch: refetchStatus 
  } = useQuery<PipelineStatus>({
    queryKey: ['pipeline', 'status'],
    queryFn: pipelineApi.getStatus,
    refetchInterval: isPolling ? 2000 : false, // Poll every 2 seconds when running
  });

  // Get pipeline statistics
  const { 
    data: pipelineStats, 
    isLoading: statsLoading 
  } = useQuery<PipelineStats>({
    queryKey: ['pipeline', 'stats'],
    queryFn: pipelineApi.getStats,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Run pipeline mutation
  const runPipelineMutation = useMutation({
    mutationFn: (options: PipelineOptions) => pipelineApi.runPipeline(options),
    onSuccess: (result: PipelineResult) => {
      if (result.success) {
        toast.success(`Pipeline completed successfully! Processed ${result.processed} emails.`);
      } else {
        toast.error(`Pipeline completed with ${result.errors} errors.`);
      }
      
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['emails'] });
    },
    onError: (error: any) => {
      toast.error(`Pipeline failed: ${error.message}`);
    },
  });

  // Stop pipeline mutation
  const stopPipelineMutation = useMutation({
    mutationFn: pipelineApi.stopPipeline,
    onSuccess: () => {
      toast.success('Pipeline stopped successfully');
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
    },
    onError: (error: any) => {
      toast.error(`Failed to stop pipeline: ${error.message}`);
    },
  });

  // Quick sync mutation
  const quickSyncMutation = useMutation({
    mutationFn: () => pipelineApi.quickSync(),
    onSuccess: (result: PipelineResult) => {
      toast.success(`Quick sync completed! Processed ${result.processed} emails.`);
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['emails'] });
    },
    onError: (error: any) => {
      toast.error(`Quick sync failed: ${error.message}`);
    },
  });

  // Full processing mutation
  const fullProcessingMutation = useMutation({
    mutationFn: (options: { batchSize?: number; forceReprocess?: boolean }) => 
      pipelineApi.fullProcessing(options),
    onSuccess: (result: PipelineResult) => {
      toast.success(`Full processing completed! Processed ${result.processed} emails.`);
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['emails'] });
    },
    onError: (error: any) => {
      toast.error(`Full processing failed: ${error.message}`);
    },
  });

  // Start/stop polling based on pipeline status
  useEffect(() => {
    if (pipelineStatus?.isRunning && !isPolling) {
      setIsPolling(true);
    } else if (!pipelineStatus?.isRunning && isPolling) {
      setIsPolling(false);
    }
  }, [pipelineStatus?.isRunning, isPolling]);

  // Callback functions
  const runPipeline = useCallback(async (options: PipelineOptions = {}) => {
    await runPipelineMutation.mutateAsync(options);
  }, [runPipelineMutation]);

  const stopPipeline = useCallback(async () => {
    await stopPipelineMutation.mutateAsync();
  }, [stopPipelineMutation]);

  const quickSync = useCallback(async () => {
    await quickSyncMutation.mutateAsync();
  }, [quickSyncMutation]);

  const fullProcessing = useCallback(async (options: { batchSize?: number; forceReprocess?: boolean } = {}) => {
    await fullProcessingMutation.mutateAsync(options);
  }, [fullProcessingMutation]);

  const refreshStatus = useCallback(() => {
    refetchStatus();
  }, [refetchStatus]);

  return {
    // Data
    pipelineStatus,
    pipelineStats,
    
    // Loading states
    isLoading: statusLoading || statsLoading,
    isRunning: runPipelineMutation.isPending || 
               stopPipelineMutation.isPending || 
               quickSyncMutation.isPending || 
               fullProcessingMutation.isPending,
    
    // Actions
    runPipeline,
    stopPipeline,
    quickSync,
    fullProcessing,
    refreshStatus,
    
    // Mutation states
    runPipelineState: {
      isLoading: runPipelineMutation.isPending,
      error: runPipelineMutation.error,
      data: runPipelineMutation.data,
    },
    
    stopPipelineState: {
      isLoading: stopPipelineMutation.isPending,
      error: stopPipelineMutation.error,
    },
    
    quickSyncState: {
      isLoading: quickSyncMutation.isPending,
      error: quickSyncMutation.error,
      data: quickSyncMutation.data,
    },
    
    fullProcessingState: {
      isLoading: fullProcessingMutation.isPending,
      error: fullProcessingMutation.error,
      data: fullProcessingMutation.data,
    },
  };
};