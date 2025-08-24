import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Mail, 
  Brain, 
  FileText, 
  Clock, 
  TrendingUp,
  AlertTriangle
} from 'lucide-react';

interface EmailStats {
  total: number;
  unread: number;
  starred: number;
  todayCount: number;
  thisWeekCount: number;
  thisMonthCount: number;
  byWorkflowState: Record<string, number>;
  byPriority: Record<string, number>;
}

interface PipelineStats {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  averageDuration: number;
  emailsProcessed: number;
  classificationsCreated: number;
  extractionsCreated: number;
}

interface StatsCardsProps {
  emailStats?: EmailStats;
  pipelineStats?: PipelineStats;
  isLoading: boolean;
}

/**
 * @component StatsCards
 * @purpose Display key statistics in card format
 */
export const StatsCards: React.FC<StatsCardsProps> = ({
  emailStats,
  pipelineStats,
  isLoading
}) => {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const totalEmails = emailStats?.total || 0;
  const unreadEmails = emailStats?.unread || 0;
  const todayEmails = emailStats?.todayCount || 0;
  const completedEmails = emailStats?.byWorkflowState?.COMPLETED || 0;
  const errorEmails = emailStats?.byWorkflowState?.ERROR || 0;
  
  const totalRuns = pipelineStats?.totalRuns || 0;
  const successRate = totalRuns > 0 
    ? ((pipelineStats?.successfulRuns || 0) / totalRuns * 100).toFixed(1)
    : '0';

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Emails */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Emails</CardTitle>
          <Mail className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalEmails.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">
            {unreadEmails} unread
          </p>
        </CardContent>
      </Card>

      {/* Today's Emails */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Today</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{todayEmails}</div>
          <p className="text-xs text-muted-foreground">
            New emails today
          </p>
        </CardContent>
      </Card>

      {/* Processed Emails */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Processed</CardTitle>
          <Brain className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{completedEmails}</div>
          <p className="text-xs text-muted-foreground">
            AI processed
          </p>
        </CardContent>
      </Card>

      {/* Success Rate */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
          {errorEmails > 0 ? (
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          ) : (
            <TrendingUp className="h-4 w-4 text-green-500" />
          )}
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{successRate}%</div>
          <p className="text-xs text-muted-foreground">
            {errorEmails} errors
          </p>
        </CardContent>
      </Card>
    </div>
  );
};