import React, { useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Upload, Play, Download, AlertCircle, CheckCircle, BarChart3, FileText } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { useDropzone } from 'react-dropzone';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

interface Model {
  id: string;
  run_id: string;
  name: string;
  storage_key: string;
  metrics: Record<string, unknown>;
  version: string;
  created_at: string;
}

interface PredictionInterfaceProps {
  projectId: string;
}

interface PredictFileResponse {
  predictions: unknown[];
  summary: Record<string, unknown>;
}

interface BatchPredictResponse {
  task_id: string;
  status: string;
  message: string;
}

interface ExplainResponse {
  explanations: Record<string, unknown>[];
  feature_importance: Record<string, number>;
}

interface BatchStatusResponse {
  status: string;
  progress: number;
  results_key?: string;
}

export default function PredictionInterface({ projectId }: PredictionInterfaceProps) {
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [inputMethod, setInputMethod] = useState<'manual' | 'file'>('manual');
  const [manualData, setManualData] = useState<string>('[{"feature1": 1.0, "feature2": "value"}]');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [predictions, setPredictions] = useState<unknown[] | null>(null);
  const [explanations, setExplanations] = useState<Record<string, unknown>[] | null>(null);
  const [featureImportance, setFeatureImportance] = useState<Record<string, number> | null>(null);
  const [enableExplanations, setEnableExplanations] = useState<boolean>(false);
  const [batchTaskId, setBatchTaskId] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<number>(0);
  const [batchStatus, setBatchStatus] = useState<string>('');
  const queryClient = useQueryClient();

  const { data: models, isLoading: modelsLoading } = useQuery<Model[]>({
    queryKey: ['project-models', projectId],
    queryFn: () => apiClient.getProjectModels(projectId),
    enabled: !!projectId,
  });

  const predictMutation = useMutation({
    mutationFn: async ({ modelId, data }: { modelId: string; data: Array<Record<string, unknown>> }) => {
      return apiClient.predict(modelId, data);
    },
    onSuccess: (data) => {
      setPredictions(data.predictions);
      // Invalidate prediction summary cache to refresh it
      queryClient.invalidateQueries({ queryKey: ['prediction-summary', projectId] });
      toast.success('Predictions generated successfully!');
    },
    onError: (error) => {
      console.error('Prediction failed:', error);
      toast.error('Failed to generate predictions. Please try again.');
    },
  });

  const predictFileMutation = useMutation({
    mutationFn: async ({ modelId, file }: { modelId: string; file: File }) => {
      return apiClient.predictFile(modelId, file);
    },
    onSuccess: (data: PredictFileResponse) => {
      setPredictions(data.predictions);
      // Invalidate prediction summary cache to refresh it
      queryClient.invalidateQueries({ queryKey: ['prediction-summary', projectId] });
      toast.success('File predictions generated successfully!');
    },
    onError: (error) => {
      console.error('File prediction failed:', error);
      toast.error('Failed to generate predictions from file. Please try again.');
    },
  });

  const batchPredictMutation = useMutation({
    mutationFn: async ({ modelId, file }: { modelId: string; file: File }) => {
      return apiClient.predictBatch(modelId, file);
    },
    onSuccess: (data: BatchPredictResponse) => {
      setBatchTaskId(data.task_id);
      setBatchStatus(data.status);
      setBatchProgress(0);
      toast.success(data.message);

      // Start polling for progress
      pollBatchStatus(data.task_id);
    },
    onError: (error) => {
      console.error('Batch prediction failed:', error);
      toast.error('Failed to start batch prediction. Please try again.');
    },
  });

  const explainMutation = useMutation({
    mutationFn: async ({ modelId, data }: { modelId: string; data: Array<Record<string, unknown>> }) => {
      return apiClient.request<ExplainResponse>(`/api/models/${modelId}/explain`, {
        method: 'POST',
        body: JSON.stringify({ data }),
      });
    },
    onSuccess: (data: ExplainResponse) => {
      setExplanations(data.explanations);
      setFeatureImportance(data.feature_importance);
      toast.success('Explanations generated successfully!');
    },
    onError: (error) => {
      console.error('Explanation failed:', error);
      toast.error('Failed to generate explanations. Please try again.');
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setUploadedFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/json': ['.json'],
    },
    multiple: false,
  });

  const pollBatchStatus = async (taskId: string) => {
    const poll = async () => {
      try {
        const response = await apiClient.request<BatchStatusResponse>(`/api/models/${selectedModel}/predict-batch/${taskId}`);
        setBatchStatus(response.status);
        setBatchProgress(response.progress * 100);

        if (response.status === 'COMPLETED') {
          // Load results and invalidate summary cache
          if (response.results_key) {
            queryClient.invalidateQueries({ queryKey: ['prediction-summary', projectId] });
            toast.success('Batch prediction completed!');
          }
        } else if (response.status === 'PENDING' || response.status === 'PROGRESS') {
          setTimeout(poll, 2000); // Poll every 2 seconds
        } else if (response.status === 'FAILURE') {
          toast.error('Batch prediction failed!');
        }
      } catch (error) {
        console.error('Failed to check batch status:', error);
        toast.error('Failed to check batch prediction status.');
      }
    };

    poll();
  };

  const handlePredict = async () => {
    if (!selectedModel) {
      toast.error('Please select a model first.');
      return;
    }

    if (inputMethod === 'manual') {
      try {
        const parsedData = JSON.parse(manualData);
        let data: Array<Record<string, unknown>> = [];
        if (Array.isArray(parsedData)) {
          data = parsedData;
        } else {
          data = [parsedData];
        }

        if (data.length === 0) {
          toast.error('No data provided for prediction.');
          return;
        }

        predictMutation.mutate({ modelId: selectedModel, data });

        // Generate explanations if enabled
        if (enableExplanations) {
          explainMutation.mutate({ modelId: selectedModel, data });
        }
      } catch (error) {
        toast.error('Invalid JSON format. Please check your input data.');
        return;
      }
    } else if (inputMethod === 'file' && uploadedFile) {
      if (uploadedFile.size > 10 * 1024 * 1024) { // 10MB limit for batch
        batchPredictMutation.mutate({ modelId: selectedModel, file: uploadedFile });
      } else {
        predictFileMutation.mutate({ modelId: selectedModel, file: uploadedFile });
      }
    } else {
      toast.error('Please provide input data.');
      return;
    }
  };

  const formatPredictions = (preds: unknown[]) => {
    return preds.map((pred, index) => (
      <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
        <span className="font-medium">Sample {index + 1}:</span>
        <span className="text-sm text-muted-foreground">
          {typeof pred === 'object' ? JSON.stringify(pred) : String(pred)}
        </span>
      </div>
    ));
  };

  return (
    <div className="space-y-6">
      {/* Model Selection */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Select Model</h3>
        {modelsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Loading models...</span>
          </div>
        ) : models && models.length > 0 ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="model-select">Choose a trained model</Label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="Select a model..." />
                </SelectTrigger>
                <SelectContent>
                  {models.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{model.name}</span>
                        <span className="text-xs text-muted-foreground">
                          Created: {new Date(model.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedModel && (
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Model Details</h4>
                {(() => {
                  const model = models.find(m => m.id === selectedModel);
                  return model ? (
                    <div className="text-sm space-y-1">
                      <p><strong>Name:</strong> {model.name}</p>
                      <p><strong>Version:</strong> {model.version}</p>
                      <p><strong>Created:</strong> {new Date(model.created_at).toLocaleString()}</p>
                      {Object.keys(model.metrics).length > 0 && (
                        <div>
                          <strong>Metrics:</strong>
                          <pre className="mt-1 text-xs bg-background p-2 rounded">
                            {JSON.stringify(model.metrics, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ) : null;
                })()}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No trained models available.</p>
            <p className="text-sm">Train models first in the Models tab.</p>
          </div>
        )}
      </Card>

      {/* Input Method Selection */}
      {selectedModel && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Input Data</h3>
          <Tabs value={inputMethod} onValueChange={(value) => setInputMethod(value as 'manual' | 'file')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="manual">Manual Input</TabsTrigger>
              <TabsTrigger value="file">Upload File</TabsTrigger>
            </TabsList>

            <TabsContent value="manual" className="space-y-4 mt-4">
              <div>
                <Label htmlFor="manual-data">Enter prediction data (JSON format)</Label>
                <Textarea
                  id="manual-data"
                  placeholder='Example: [{"feature1": 1.0, "feature2": "value"}, {"feature1": 2.0, "feature2": "value2"}]'
                  value={manualData}
                  onChange={(e) => setManualData(e.target.value)}
                  className="mt-1 min-h-[120px] font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter data as JSON array of objects, where each object represents a sample to predict.
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="explanations"
                  checked={enableExplanations}
                  onCheckedChange={setEnableExplanations}
                />
                <Label htmlFor="explanations">Generate explanations</Label>
              </div>
            </TabsContent>

            <TabsContent value="file" className="space-y-4 mt-4">
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? 'border-primary bg-primary/5'
                    : 'border-muted-foreground/25 hover:border-primary/50'
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                {uploadedFile ? (
                  <div>
                    <CheckCircle className="h-6 w-6 mx-auto mb-2 text-green-500" />
                    <p className="text-lg font-medium">{uploadedFile.name}</p>
                    <p className="text-sm text-muted-foreground">Click to change file</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-lg font-medium mb-2">Drop prediction data file here</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Supports CSV and JSON files
                    </p>
                    <Button variant="outline" size="sm">
                      Browse Files
                    </Button>
                  </div>
                )}
              </div>
              {uploadedFile && uploadedFile.size > 10 * 1024 * 1024 && (
                <div className="text-center text-sm text-muted-foreground">
                  <FileText className="h-4 w-4 inline mr-1" />
                  Large file detected. Batch processing will be used.
                </div>
              )}
            </TabsContent>
          </Tabs>
        </Card>
      )}

      {/* Predict Button */}
      {selectedModel && (
        <div className="flex justify-center">
          <Button
            onClick={handlePredict}
            disabled={predictMutation.isPending || (inputMethod === 'manual' && !manualData.trim()) || (inputMethod === 'file' && !uploadedFile)}
            className="px-8"
          >
            {predictMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Predictions...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Make Predictions
              </>
            )}
          </Button>
        </div>
      )}

      {/* Batch Progress */}
      {batchTaskId && batchStatus !== 'COMPLETED' && batchStatus !== 'FAILURE' && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Batch Prediction Progress</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Status: {batchStatus}</span>
              <span className="text-sm text-muted-foreground">{batchProgress.toFixed(1)}%</span>
            </div>
            <Progress value={batchProgress} className="w-full" />
          </div>
        </Card>
      )}

      {/* Results */}
      {predictions && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Prediction Results</h3>
            <Button variant="outline" size="sm" onClick={() => {
              // Navigate to export tab or show summary cards
              toast.success('Prediction completed! Check the Export tab for detailed summary.');
            }}>
              <Download className="h-4 w-4 mr-2" />
              View Summary
            </Button>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {formatPredictions(predictions)}
          </div>
          <div className="mt-4 text-sm text-muted-foreground">
            Total predictions: {predictions.length}
          </div>
        </Card>
      )}

      {/* Explanations */}
      {explanations && enableExplanations && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              Prediction Explanations
            </h3>
          </div>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {explanations.map((exp, index) => (
              <div key={index} className="border rounded-lg p-4">
                <h4 className="font-medium mb-2">Sample {index + 1}</h4>
                <div className="space-y-2">
                  {Object.entries(exp).map(([feature, contribution]) => (
                    <div key={feature} className="flex justify-between text-sm">
                      <span>{feature}:</span>
                      <Badge variant={Number(contribution) > 0 ? 'default' : 'secondary'}>
                        {Number(contribution).toFixed(4)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Feature Importance */}
      {featureImportance && enableExplanations && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Global Feature Importance</h3>
          <div className="space-y-2">
            {Object.entries(featureImportance)
              .sort(([,a], [,b]) => b - a)
              .slice(0, 10)
              .map(([feature, importance]) => (
                <div key={feature} className="flex items-center justify-between">
                  <span className="text-sm">{feature}</span>
                  <div className="flex items-center space-x-2">
                    <Progress value={importance * 100} className="w-24" />
                    <span className="text-xs text-muted-foreground w-12">
                      {(importance * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </Card>
      )}
    </div>
  );
}
