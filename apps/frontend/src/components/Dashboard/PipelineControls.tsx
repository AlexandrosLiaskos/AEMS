import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { 
  Play, 
  Pause, 
  RefreshCw, 
  Settings,
  Clock,
  CheckCircle,
  XCircle,
  Activity
} from 'lucide-react';

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

interface PipelineOptions {
  batchSize?: number;
  skipSync?: boolean;
  skipClassification?: boolean;
  skipExtraction?: boolean;
  forceReprocess?: boolean;
}

interface PipelineControlsProps {
  status?: PipelineStatus;
  stats?: PipelineStats;
  onRunPipeline: (options: PipelineOptions) => Promise<void>;
  onStopPipeline: () => Promise<void>;
  isLoading: boolean;
}

/**
 * @component PipelineControls
 * @purpose Advanced pipeline control interface
 */
export const PipelineControls: React.FC<PipelineControlsProps> = ({
  status,
  stats,
  onRunPipeline,
  onStopPipeline,
  isLoading
}) => {
  const [options, setOptions] = useState<PipelineOptions>({
    batchSize: 10,
    skipSync: false,
    skipClassification: false,
    skipExtraction: false,
    forceReprocess: false,
  });

  const handleRunPipeline = async () => {
    await onRunPipeline(options);
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Current Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Pipeline Status
          </CardTitle>
          <CardDescription>
            Current pipeline execution status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {status?.isRunning ? (
                <>
                  <div className="animate-pulse">
                    <Badge variant="default" className="bg-green-500">
                      <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                      Running
                    </Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    Run ID: {status.currentRun}
                  </span>
                </>
              ) : (
                <Badge variant="secondary">
                  <Pause className="h-3 w-3 mr-1" />
                  Idle
                </Badge>
              )}
            </div>

            <Button
              variant={status?.isRunning ? "destructive" : "default"}
              onClick={status?.isRunning ? onStopPipeline : handleRunPipeline}
              disabled={isLoading}
            >
              {status?.isRunning ? (
                <>
                  <Pause className="h-4 w-4 mr-2" />
                  Stop Pipeline
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run Pipeline
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Pipeline Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configuration
            </CardTitle>
            <CardDescription>
              Configure pipeline execution options
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="batchSize">Batch Size</Label>
              <Input
                id="batchSize"
                type="number"
                min="1"
                max="100"
                value={options.batchSize}
                onChange={(e) => setOptions(prev => ({
                  ...prev,
                  batchSize: parseInt(e.target.value) || 10
                }))}
                disabled={status?.isRunning}
              />
              <p className="text-xs text-muted-foreground">
                Number of emails to process in each batch
              </p>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="skipSync">Skip Gmail Sync</Label>
                <Switch
                  id="skipSync"
                  checked={options.skipSync}
                  onCheckedChange={(checked) => setOptions(prev => ({
                    ...prev,
                    skipSync: checked
                  }))}
                  disabled={status?.isRunning}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="skipClassification">Skip Classification</Label>
                <Switch
                  id="skipClassification"
                  checked={options.skipClassification}
                  onCheckedChange={(checked) => setOptions(prev => ({
                    ...prev,
                    skipClassification: checked
                  }))}
                  disabled={status?.isRunning}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="skipExtraction">Skip Extraction</Label>
                <Switch
                  id="skipExtraction"
                  checked={options.skipExtraction}
                  onCheckedChange={(checked) => setOptions(prev => ({
                    ...prev,
                    skipExtraction: checked
                  }))}
                  disabled={status?.isRunning}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="forceReprocess">Force Reprocess</Label>
                <Switch
                  id="forceReprocess"
                  checked={options.forceReprocess}
                  onCheckedChange={(checked) => setOptions(prev => ({
                    ...prev,
                    forceReprocess: checked
                  }))}
                  disabled={status?.isRunning}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pipeline Statistics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Statistics
            </CardTitle>
            <CardDescription>
              Pipeline execution history and metrics
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {stats?.successfulRuns || 0}
                </div>
                <p className="text-xs text-muted-foreground">Successful</p>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {stats?.failedRuns || 0}
                </div>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Total Runs</span>
                <span className="text-sm font-medium">{stats?.totalRuns || 0}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm">Avg Duration</span>
                <span className="text-sm font-medium">
                  {formatDuration(stats?.averageDuration || 0)}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm">Last Run</span>
                <span className="text-sm font-medium">
                  {formatDate(stats?.lastRun)}
                </span>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Emails Processed</span>
                <span className="text-sm font-medium">
                  {stats?.emailsProcessed?.toLocaleString() || 0}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm">Classifications</span>
                <span className="text-sm font-medium">
                  {stats?.classificationsCreated?.toLocaleString() || 0}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm">Extractions</span>
                <span className="text-sm font-medium">
                  {stats?.extractionsCreated?.toLocaleString() || 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common pipeline operations with preset configurations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-3">
            <Button
              variant="outline"
              onClick={() => onRunPipeline({ batchSize: 5, skipExtraction: true })}
              disabled={status?.isRunning || isLoading}
              className="justify-start"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Quick Sync
            </Button>
            
            <Button
              variant="outline"
              onClick={() => onRunPipeline({ batchSize: 10 })}
              disabled={status?.isRunning || isLoading}
              className="justify-start"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Full Process
            </Button>
            
            <Button
              variant="outline"
              onClick={() => onRunPipeline({ forceReprocess: true, batchSize: 5 })}
              disabled={status?.isRunning || isLoading}
              className="justify-start"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reprocess
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};