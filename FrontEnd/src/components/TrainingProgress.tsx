import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, RefreshCw, Clock } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import useWebSocket from "react-use-websocket";

interface TrainingProgressProps {
  projectId: string;
  onTrainingComplete?: () => void;
}

interface TrainingStatus {
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
}

export default function TrainingProgress({ projectId, onTrainingComplete }: TrainingProgressProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [realTimeStatus, setRealTimeStatus] = useState<TrainingStatus | null>(null);

  // WebSocket for real-time updates
  const { lastMessage } = useWebSocket(`ws://${window.location.hostname}:8000/api/analysis/projects/${projectId}/ml/train-progress`, {
    shouldReconnect: () => true,
    reconnectAttempts: 10,
    reconnectInterval: 3000,
  });

  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      try {
        const data = JSON.parse(lastMessage.data);
        if (data.type === 'progress' || data.type === 'model_progress' || data.type === 'hyperparameter_progress') {
          // Update real-time status with WebSocket data
          setRealTimeStatus(prev => ({
            ...prev,
            status: data.stage === 'completed' ? 'COMPLETED' : 'RUNNING',
            current_task: data.message || prev?.current_task,
            progress: data.progress || prev?.progress || 0,
            run_id: data.run_id || prev?.run_id || '',
            started_at: prev?.started_at || new Date().toISOString(),
            finished_at: data.stage === 'completed' ? new Date().toISOString() : null,
            models_count: data.models_count || prev?.models_count || 0,
            models: data.models || prev?.models || []
          } as TrainingStatus));
        } else if (data.type === 'completed') {
          setRealTimeStatus(prev => ({
            ...prev,
            status: 'COMPLETED',
            progress: 1.0,
            finished_at: new Date().toISOString(),
            models_count: data.results?.models_trained || prev?.models_count || 0,
            models: data.results?.models || prev?.models || []
          } as TrainingStatus));
        } else if (data.type === 'error') {
          setRealTimeStatus(prev => ({
            ...prev,
            status: 'FAILED',
            finished_at: new Date().toISOString()
          } as TrainingStatus));
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    }
  }, [lastMessage]);

  const { data: trainingStatus, isLoading, refetch } = useQuery<TrainingStatus | { status: string; message: string }>({
    queryKey: ["training-status", projectId],
    queryFn: () => apiClient.getTrainingStatus(projectId),
    enabled: !!projectId,
    refetchInterval: (data) => {
      // Stop polling if training is complete or failed
      if (data && typeof data === 'object' && 'status' in data) {
        const status = data.status;
        if (status === 'COMPLETED' || status === 'FAILED' || status === 'NO_RUNS') {
          return false;
        }
      }
      return 5000; // Poll every 5 seconds
    },
  });

  useEffect(() => {
    if (trainingStatus && typeof trainingStatus === 'object' && 'status' in trainingStatus) {
      if (trainingStatus.status === 'COMPLETED' && onTrainingComplete) {
        onTrainingComplete();
      }
    }
  }, [trainingStatus, onTrainingComplete]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'RUNNING':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'COMPLETED':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'FAILED':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'PENDING':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'RUNNING':
        return 'default';
      case 'COMPLETED':
        return 'default';
      case 'FAILED':
        return 'destructive';
      case 'PENDING':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (isLoading && !trainingStatus) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>Loading training status...</span>
        </div>
      </Card>
    );
  }

  if (!trainingStatus || ('status' in trainingStatus && trainingStatus.status === 'NO_RUNS')) {
    return (
      <Card className="p-6">
        <div className="text-center py-8 text-muted-foreground">
          <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No training runs found for this project.</p>
          <p className="text-sm">Start a new AutoML training to see progress here.</p>
        </div>
      </Card>
    );
  }

  if ('message' in trainingStatus) {
    return (
      <Card className="p-6">
        <div className="text-center py-8 text-muted-foreground">
          <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>{trainingStatus.message}</p>
        </div>
      </Card>
    );
  }

  // Use real-time status if available, otherwise fall back to API status
  const displayStatus: TrainingStatus = realTimeStatus || (trainingStatus as TrainingStatus);

  if (!displayStatus) {
    return (
      <Card className="p-6">
        <div className="text-center py-8 text-muted-foreground">
          <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No training data available.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Training Progress</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="space-y-4">
        {/* Status Overview */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon(displayStatus.status)}
            <Badge variant={getStatusBadgeVariant(displayStatus.status)}>
              {displayStatus.status}
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground">
            Run ID: {displayStatus.run_id}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span>{Math.round(displayStatus.progress * 100)}%</span>
          </div>
          <Progress value={displayStatus.progress * 100} className="w-full" />
        </div>

        {/* Current Task */}
        {displayStatus.current_task && (
          <div className="text-sm">
            <span className="font-medium">Current Task:</span> {displayStatus.current_task}
          </div>
        )}

        {/* Timing */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          {displayStatus.started_at && (
            <div>
              <span className="font-medium">Started:</span>{" "}
              {new Date(displayStatus.started_at).toLocaleString()}
            </div>
          )}
          {displayStatus.finished_at && (
            <div>
              <span className="font-medium">Finished:</span>{" "}
              {new Date(displayStatus.finished_at).toLocaleString()}
            </div>
          )}
        </div>

        {/* Models Count */}
        {displayStatus.models_count > 0 && (
          <div className="text-sm">
            <span className="font-medium">Models Trained:</span> {displayStatus.models_count}
          </div>
        )}

        {/* Models List */}
        {displayStatus.models && displayStatus.models.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium">Trained Models</h4>
            <div className="space-y-2">
              {displayStatus.models.map((model) => (
                <Card key={model.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{model.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Created: {new Date(model.created_at).toLocaleString()}
                      </div>
                    </div>
                    <Badge variant="outline">
                      {Object.keys(model.metrics).length} metrics
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
