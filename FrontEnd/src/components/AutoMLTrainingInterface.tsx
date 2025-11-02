import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Play, Loader2, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

interface AutoMLTrainingInterfaceProps {
  projectId: string;
}

interface TaskAnalysis {
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
}

interface DatasetInfo {
  total_rows: number;
  total_columns: number;
  numeric_columns: number;
  categorical_columns: number;
}

export default function AutoMLTrainingInterface({ projectId }: AutoMLTrainingInterfaceProps) {
  const [selectedTaskType, setSelectedTaskType] = useState<string>("");
  const [selectedTargetColumn, setSelectedTargetColumn] = useState<string>("");
  const [testSize, setTestSize] = useState<number>(0.2);
  const [randomState, setRandomState] = useState<number>(42);
  const [isTraining, setIsTraining] = useState(false);

  const { data: taskAnalysis, isLoading: analysisLoading } = useQuery<{
    project_id: string;
    task_analysis: TaskAnalysis;
    dataset_info: DatasetInfo;
  }>({
    queryKey: ["task-analysis", projectId],
    queryFn: () => apiClient.analyzeTaskType(projectId),
    enabled: !!projectId,
  });

  const handleStartTraining = async () => {
    if (!selectedTaskType || !selectedTargetColumn) {
      toast.error("Please select task type and target column");
      return;
    }

    setIsTraining(true);
    try {
      const result = await apiClient.trainAutoML(projectId, {
        task_type: selectedTaskType,
        target_column: selectedTargetColumn,
        test_size: testSize,
        random_state: randomState,
      });

      toast.success(`Training started! Run ID: ${result.run_id}`);
    } catch (error: unknown) {
      console.error("Training failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to start training";

      // Provide more specific error messages
      if (errorMessage.includes("could not convert string to float")) {
        toast.error("Invalid combination: Regression requires a numeric target column. Please select a numeric column as target or choose classification task type.");
      } else if (errorMessage.includes("task_type") && errorMessage.includes("target_column")) {
        toast.error("Incompatible task type and target column combination. Please check the target column type.");
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsTraining(false);
    }
  };

  useEffect(() => {
    if (taskAnalysis?.task_analysis.recommended_task) {
      setSelectedTaskType(taskAnalysis.task_analysis.recommended_task);
    }
  }, [taskAnalysis]);

  if (analysisLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>Analyzing dataset...</span>
        </div>
      </Card>
    );
  }

  if (!taskAnalysis) {
    return (
      <Card className="p-6">
        <div className="text-center py-8 text-muted-foreground">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Unable to analyze dataset. Please ensure you have datasets uploaded.</p>
        </div>
      </Card>
    );
  }

  const { task_analysis: analysis, dataset_info: info } = taskAnalysis;

  return (
    <div className="space-y-6">
      {/* Dataset Info */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Dataset Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{info.total_rows.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">Total Rows</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{info.total_columns}</div>
            <div className="text-sm text-muted-foreground">Total Columns</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{info.numeric_columns}</div>
            <div className="text-sm text-muted-foreground">Numeric</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{info.categorical_columns}</div>
            <div className="text-sm text-muted-foreground">Categorical</div>
          </div>
        </div>
      </Card>

      {/* Task Analysis */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Task Analysis</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant={analysis.confidence > 0.7 ? "default" : "secondary"}>
              {Math.round(analysis.confidence * 100)}% Confidence
            </Badge>
            <span className="text-sm text-muted-foreground">
              Recommended: {analysis.recommended_task}
            </span>
          </div>

          <div>
            <Label htmlFor="task-type">Task Type</Label>
            <Select value={selectedTaskType} onValueChange={setSelectedTaskType}>
              <SelectTrigger>
                <SelectValue placeholder="Select task type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="regression">Regression</SelectItem>
                <SelectItem value="binary_classification">Binary Classification</SelectItem>
                <SelectItem value="multiclass_classification">Multiclass Classification</SelectItem>
                <SelectItem value="clustering">Clustering</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {analysis.possible_targets && analysis.possible_targets.length > 0 && (
            <div>
              <Label htmlFor="target-column">Target Column</Label>
              <Select
                value={selectedTargetColumn}
                onValueChange={(value) => {
                  setSelectedTargetColumn(value);
                  // Auto-set task type based on selected target column
                  const target = analysis.possible_targets?.find(t => t.column === value);
                  if (target) {
                    if (target.task_type === "regression") {
                      setSelectedTaskType("regression");
                    } else if (target.task_type === "classification") {
                      // Determine if binary or multiclass based on unique values
                      if (target.unique_values === 2) {
                        setSelectedTaskType("binary_classification");
                      } else {
                        setSelectedTaskType("multiclass_classification");
                      }
                    }
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select target column" />
                </SelectTrigger>
                <SelectContent>
                  {analysis.possible_targets.map((target) => (
                    <SelectItem key={target.column} value={target.column}>
                      {target.column} ({target.task_type}, {target.unique_values} values)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="test-size">Test Size</Label>
              <Input
                id="test-size"
                type="number"
                min="0.1"
                max="0.5"
                step="0.1"
                value={testSize}
                onChange={(e) => setTestSize(parseFloat(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="random-state">Random State</Label>
              <Input
                id="random-state"
                type="number"
                value={randomState}
                onChange={(e) => setRandomState(parseInt(e.target.value))}
              />
            </div>
          </div>

          <Button
            onClick={handleStartTraining}
            disabled={isTraining || !selectedTaskType || !selectedTargetColumn}
            className="w-full"
          >
            {isTraining ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Starting Training...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Start AutoML Training
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}
