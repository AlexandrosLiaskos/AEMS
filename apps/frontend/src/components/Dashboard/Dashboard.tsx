import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Mail, 
  Brain, 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Play,
  Pause,
  RefreshCw,
  Settings
} from 'lucide-react';

// Hooks
import { useAuth } from '@/hooks/useAuth';
import { usePipeline } from '@/hooks/usePipeline';
import { useEmailStats } from '@/hooks/useEmailStats';

// Components
import { EmailList } from './EmailList';
import { PipelineControls } from './PipelineControls';
import { StatsCards } from './StatsCards';
import { RecentActivity } from './RecentActivity';

/**
 * @component Dashboard
 * @purpose Main dashboard component
 */
export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { 
    pipelineStatus, 
    pipelineStats, 
    runPipeline, 
    stopPipeline,
    isLoading: pipelineLoading 
  } = usePipeline();
  const { emailStats, isLoading: statsLoading } = useEmailStats();

  const [activeTab, setActiveTab] = useState('overview');

  if (!user) {
    return <div>Please log in to access the dashboard.</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {user.name}! Here's your email processing overview.
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Pipeline Status Banner */}
      {pipelineStatus?.isRunning && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="animate-spin">
                  <RefreshCw className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-blue-900">Pipeline Running</p>
                  <p className="text-sm text-blue-700">
                    Processing emails... Run ID: {pipelineStatus.currentRun}
                  </p>
                </div>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={stopPipeline}
                disabled={pipelineLoading}
              >
                <Pause className="h-4 w-4 mr-2" />
                Stop
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <StatsCards 
        emailStats={emailStats} 
        pipelineStats={pipelineStats}
        isLoading={statsLoading || pipelineLoading}
      />

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="emails">Emails</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Play className="h-5 w-5" />
                  Quick Actions
                </CardTitle>
                <CardDescription>
                  Common pipeline operations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => runPipeline({ batchSize: 5, skipExtraction: true })}
                  disabled={pipelineStatus?.isRunning || pipelineLoading}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Quick Sync (5 emails)
                </Button>
                
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => runPipeline({ batchSize: 10 })}
                  disabled={pipelineStatus?.isRunning || pipelineLoading}
                >
                  <Brain className="h-4 w-4 mr-2" />
                  Full Processing (10 emails)
                </Button>
                
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => runPipeline({ forceReprocess: true, batchSize: 5 })}
                  disabled={pipelineStatus?.isRunning || pipelineLoading}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reprocess Recent
                </Button>
              </CardContent>
            </Card>

            {/* Processing Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Processing Status
                </CardTitle>
                <CardDescription>
                  Email workflow states
                </CardDescription>
              </CardHeader>
              <CardContent>
                {emailStats && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Completed</span>
                      <Badge variant="default">
                        {emailStats.byWorkflowState?.COMPLETED || 0}
                      </Badge>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Processing</span>
                      <Badge variant="secondary">
                        {(emailStats.byWorkflowState?.PROCESSING || 0) + 
                         (emailStats.byWorkflowState?.CLASSIFIED || 0) + 
                         (emailStats.byWorkflowState?.EXTRACTED || 0)}
                      </Badge>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Pending</span>
                      <Badge variant="outline">
                        {emailStats.byWorkflowState?.FETCHED || 0}
                      </Badge>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Errors</span>
                      <Badge variant="destructive">
                        {emailStats.byWorkflowState?.ERROR || 0}
                      </Badge>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <RecentActivity />
        </TabsContent>

        <TabsContent value="emails">
          <EmailList />
        </TabsContent>

        <TabsContent value="pipeline">
          <PipelineControls 
            status={pipelineStatus}
            stats={pipelineStats}
            onRunPipeline={runPipeline}
            onStopPipeline={stopPipeline}
            isLoading={pipelineLoading}
          />
        </TabsContent>

        <TabsContent value="activity">
          <RecentActivity detailed />
        </TabsContent>
      </Tabs>
    </div>
  );
};