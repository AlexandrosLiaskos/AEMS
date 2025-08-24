import { useQuery } from '@tanstack/react-query';

// API
import { emailApi } from '@/lib/api/email';

// Types
interface EmailStats {
  total: number;
  unread: number;
  starred: number;
  withAttachments: number;
  byWorkflowState: Record<string, number>;
  byPriority: Record<string, number>;
  todayCount: number;
  thisWeekCount: number;
  thisMonthCount: number;
}

/**
 * @hook useEmailStats
 * @purpose Hook for fetching email statistics
 */
export const useEmailStats = () => {
  const { 
    data: emailStats, 
    isLoading, 
    error,
    refetch 
  } = useQuery<EmailStats>({
    queryKey: ['emails', 'stats'],
    queryFn: emailApi.getStats,
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
  });

  return {
    emailStats,
    isLoading,
    error,
    refetch,
  };
};