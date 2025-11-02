import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Brain, Target, TrendingUp, BarChart3, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

interface TaskAnalysisProps {
  projectId: string;
}

interface TaskAnalysisResult {
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
    recommended_algorithms?: string[];
  };
  dataset_info: {
    total_rows: number;
    total_columns: number;
    numeric_columns: number;
    categorical_columns: number;
  };
}

export default function TaskAnalysis({ projectId }: TaskAnalysisProps) {
  const [selectedTarget, setSelectedTarget] = useState<string>("auto-detect");

  const { data: taskAnalysis, isLoading, error, refetch } = useQuery<TaskAnalysisResult>({
    queryKey: ["task-analysis", projectId, selectedTarget],
    queryFn: () => apiClient.analyzeTaskType(projectId, selectedTarget === "auto-detect" ? undefined : selectedTarget),
    enabled: !!projectId,
  });

  const analyzeMutation = useMutation({
    mutationFn: (targetColumn?: string) => apiClient.analyzeTaskType(projectId, targetColumn),
    onSuccess: (data) => {
      toast.success("Task analysis completed successfully!");
    },
    onError: (error) => {
      console.error("Task analysis failed:", error);
      toast.error("Failed to analyze task type. Please try again.");
    },
  });

  const handleAnalyze = () => {
    analyzeMutation.mutate(selectedTarget === "auto-detect" ? undefined : selectedTarget);
  };

  const getTaskIcon = (taskType: string) => {
    switch (taskType) {
      case "regression":
        return <TrendingUp className="h-4 w-4" />;
      case "binary_classification":
      case "multiclass_classification":
        return <Target className="h-4 w-4" />;
      case "clustering":
        return <BarChart3 className="h-4 w-4" />;
      default:
        return <Brain className="h-4 w-4" />;
    }
  };

  const getTaskColor = (taskType: string) => {
    switch (taskType) {
      case "regression":
        return "bg-blue-100 text-blue-800";
      case "binary_classification":
      case "multiclass_classification":
        return "bg-green-100 text-green-800";
      case "clustering":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "text-green-600";
    if (confidence >= 0.6) return "text-yellow-600";
    return "text-red-600";
  };

  if (error) {
    return (
      <Card className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Failed to analyze task type. Please ensure you have datasets uploaded to this project.
          </AlertDescription>
        </Alert>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Analysis Controls */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Task Recognition</h3>
            <p className="text-sm text-muted-foreground">
              Automatically detect the ML task type and get recommendations
            </p>
          </div>
          <Brain className="h-8 w-8 text-primary" />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">
              Target Column (Optional)
            </label>
            <Select value={selectedTarget} onValueChange={setSelectedTarget}>
              <SelectTrigger>
                <SelectValue placeholder="Auto-detect target column" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto-detect">Auto-detect</SelectItem>
                {taskAnalysis?.task_analysis.possible_targets
                  ?.filter((target) => target.column && typeof target.column === 'string')
                  ?.map((target) => (
                    <SelectItem key={target.column} value={target.column}>
                      {target.column} ({target.task_type || 'unknown'})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="pt-6">
            <Button
              onClick={handleAnalyze}
              disabled={analyzeMutation.isPending}
              className="gap-2"
            >
              {analyzeMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Brain className="h-4 w-4" />
              )}
              Analyze Task
            </Button>
          </div>
        </div>
      </Card>

      {/* Dataset Info */}
      {taskAnalysis?.dataset_info && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Rows</span>
              <BarChart3 className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-bold">
              {taskAnalysis.dataset_info.total_rows.toLocaleString()}
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Columns</span>
              <BarChart3 className="h-4 w-4 text-accent" />
            </div>
            <div className="text-2xl font-bold">
              {taskAnalysis.dataset_info.total_columns}
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Numeric</span>
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold">
              {taskAnalysis.dataset_info.numeric_columns}
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Categorical</span>
              <Target className="h-4 w-4 text-green-500" />
            </div>
            <div className="text-2xl font-bold">
              {taskAnalysis.dataset_info.categorical_columns}
            </div>
          </Card>
        </div>
      )}

      {/* Task Analysis Results */}
      {taskAnalysis?.task_analysis && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Analysis Results</h3>
            <Badge className={getTaskColor(taskAnalysis.task_analysis.recommended_task)}>
              {getTaskIcon(taskAnalysis.task_analysis.recommended_task)}
              <span className="ml-1 capitalize">
                {taskAnalysis.task_analysis.recommended_task.replace("_", " ")}
              </span>
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Recommended Task */}
            <div>
              <h4 className="font-medium mb-2">Recommended Task</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    {taskAnalysis.task_analysis.recommended_task.replace("_", " ")}
                  </Badge>
                  <span className={`text-sm font-medium ${getConfidenceColor(taskAnalysis.task_analysis.confidence)}`}>
                    {Math.round(taskAnalysis.task_analysis.confidence * 100)}% confidence
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  <strong>Reasoning:</strong>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    {taskAnalysis.task_analysis.reasoning.map((reason, index) => (
                      <li key={index}>{reason}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Task Details */}
            {taskAnalysis.task_analysis.task_details && (
              <div>
                <h4 className="font-medium mb-2">Task Details</h4>
                <div className="space-y-2">
                  {Object.entries(taskAnalysis.task_analysis.task_details).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-sm text-muted-foreground capitalize">
                        {key.replace("_", " ")}:
                      </span>
                      <span className="text-sm font-medium">
                        {Array.isArray(value) ? value.slice(0, 3).join(", ") + (value.length > 3 ? "..." : "") : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Possible Targets */}
          {(() => {
            const validTargets = taskAnalysis.task_analysis.possible_targets?.filter(
              (target) => target.column && typeof target.column === 'string'
            ) || [];
            return validTargets.length > 0 ? (
              <div className="mt-6">
                <h4 className="font-medium mb-3">Possible Target Columns</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {validTargets.map((target) => (
                    <Card key={target.column} className="p-3 border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">{target.column}</span>
                        <Badge variant="outline" className="text-xs capitalize">
                          {(target.task_type || 'unknown').replace("_", " ")}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div>Unique values: {target.unique_values || 0}</div>
                        {target.classes && target.classes.length > 0 && (
                          <div>Classes: {target.classes.slice(0, 3).join(", ")}{target.classes.length > 3 ? "..." : ""}</div>
                        )}
                        {target.correlation_potential && (
                          <div className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            Good for regression
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ) : null;
          })()}

          {/* Recommended Algorithms */}
          {taskAnalysis.task_analysis.recommended_algorithms && taskAnalysis.task_analysis.recommended_algorithms.length > 0 && (
            <div className="mt-6">
              <h4 className="font-medium mb-3">Recommended Algorithms</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {taskAnalysis.task_analysis.recommended_algorithms.map((algorithm) => (
                  <Badge key={algorithm} variant="secondary" className="justify-center py-2">
                    {algorithm}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <Card className="p-6">
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Analyzing your dataset...</p>
          </div>
        </Card>
      )}

      {/* Empty State */}
      {!taskAnalysis && !isLoading && !error && (
        <Card className="p-6">
          <div className="text-center py-12 text-muted-foreground">
            <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Click "Analyze Task" to automatically detect the ML task type for your dataset.</p>
          </div>
        </Card>
      )}
    </div>
  );
}
