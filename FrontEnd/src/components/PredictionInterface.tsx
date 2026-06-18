import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Upload, Play, Download, AlertCircle, CheckCircle, BarChart3, FileText, Sparkles, Cpu, ChevronRight, TrendingUp, HelpCircle } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient, Dataset } from '@/lib/api';
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
  metrics: Record<string, any>;
  version: string;
  created_at: string;
}

interface PredictionInterfaceProps {
  projectId: string;
}

interface PredictFileResponse {
  predictions: any[];
  summary: Record<string, any>;
}

interface BatchPredictResponse {
  task_id: string;
  status: string;
  message: string;
}

interface ExplainResponse {
  explanations: Array<{
    sample_index: number;
    feature_contributions: Record<string, number>;
  }>;
  feature_importance: Record<string, number>;
}

interface BatchStatusResponse {
  status: string;
  progress: number;
  results_key?: string;
}

export default function PredictionInterface({ projectId }: PredictionInterfaceProps) {
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [inputMethod, setInputMethod] = useState<'form' | 'manual' | 'file'>('form');
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [manualData, setManualData] = useState<string>('[\n  {\n    "feature1": 1.0,\n    "feature2": "value"\n  }\n]');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  
  const [predictions, setPredictions] = useState<any[] | null>(null);
  const [predictionSummary, setPredictionSummary] = useState<Record<string, any> | null>(null);
  const [validationError, setValidationError] = useState<{ message: string; missing: string[]; extra: string[] } | null>(null);
  const [explanations, setExplanations] = useState<ExplainResponse['explanations'] | null>(null);
  const [featureImportance, setFeatureImportance] = useState<Record<string, number> | null>(null);
  const [enableExplanations, setEnableExplanations] = useState<boolean>(true);
  
  const [batchTaskId, setBatchTaskId] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<number>(0);
  const [batchStatus, setBatchStatus] = useState<string>('');

  // Fetch models
  const { data: models, isLoading: modelsLoading } = useQuery<Model[]>({
    queryKey: ['project-models', projectId],
    queryFn: () => apiClient.getProjectModels(projectId),
    enabled: !!projectId,
  });

  // Fetch datasets to extract schemas
  const { data: datasets } = useQuery<Dataset[]>({
    queryKey: ['project-datasets', projectId],
    queryFn: () => apiClient.getProjectDatasets(projectId),
    enabled: !!projectId,
  });

  const activeDataset = datasets?.[0];
  const activeModel = useMemo(() => models?.find(m => m.id === selectedModel), [models, selectedModel]);

  // Derive dynamic inputs
  const features = useMemo(() => {
    if (!activeModel) return [];
    
    const modelFeatures = (activeModel.metrics as any)?.feature_names as string[] | undefined;
    const targetCol = (activeModel.metrics as any)?.target_column as string | undefined;
    const datasetColumns = activeDataset?.columns_json || {};

    if (modelFeatures && modelFeatures.length > 0) {
      return modelFeatures.map(name => ({
        name,
        type: datasetColumns[name] || 'float64'
      }));
    }

    // Fallback: use dataset columns except the last or target column
    const keys = Object.keys(datasetColumns);
    if (keys.length === 0) return [];
    
    const exclude = targetCol || keys[keys.length - 1];
    return keys
      .filter(k => k !== exclude)
      .map(name => ({
        name,
        type: datasetColumns[name] || 'float64'
      }));
  }, [activeModel, activeDataset]);

  // Pre-fill default form values when features change
  useEffect(() => {
    if (features.length > 0) {
      const initialForm: Record<string, string> = {};
      const templateObj: Record<string, any> = {};
      
      features.forEach(f => {
        const isNum = f.type.includes('int') || f.type.includes('float') || f.type.includes('double') || f.type.includes('num');
        const defaultVal = isNum ? '0' : '';
        initialForm[f.name] = defaultVal;
        templateObj[f.name] = isNum ? 0.0 : 'value';
      });
      
      setFormData(initialForm);
      setManualData(JSON.stringify([templateObj], null, 2));
    }
  }, [features]);

  // Mutation: Predict
  const predictMutation = useMutation({
    mutationFn: async ({ modelId, data }: { modelId: string; data: Array<Record<string, any>> }) => {
      return apiClient.predict(modelId, data);
    },
    onSuccess: (data: any) => {
      setPredictions(data.predictions);
      setPredictionSummary(data.summary);
      toast.success('Inference completed successfully!');
    },
    onError: (error: any) => {
      console.error('Prediction failed:', error);
      if (error?.status === 422 && error?.info) {
        setValidationError(error.info);
        toast.error(error.info.message || 'Input validation failed.');
      } else {
        toast.error('Prediction failed. Please verify input schema.');
      }
    },
  });

  // Mutation: Predict File
  const predictFileMutation = useMutation({
    mutationFn: async ({ modelId, file }: { modelId: string; file: File }) => {
      return apiClient.predictFile(modelId, file);
    },
    onSuccess: (data: PredictFileResponse) => {
      setPredictions(data.predictions);
      setPredictionSummary(data.summary);
      toast.success('Batch predictions generated!');
    },
    onError: (error: any) => {
      console.error('File prediction failed:', error);
      if (error?.status === 422 && error?.info) {
        setValidationError(error.info);
        toast.error(error.info.message || 'File schema validation failed.');
      } else {
        toast.error('Failed to run predictions on this file.');
      }
    },
  });

  // Mutation: Batch Predict Async
  const batchPredictMutation = useMutation({
    mutationFn: async ({ modelId, file }: { modelId: string; file: File }) => {
      return apiClient.predictBatch(modelId, file);
    },
    onSuccess: (data: BatchPredictResponse) => {
      setBatchTaskId(data.task_id);
      setBatchStatus(data.status);
      setBatchProgress(0);
      toast.success(data.message);
      pollBatchStatus(data.task_id);
    },
    onError: (error: any) => {
      console.error('Batch prediction failed:', error);
      if (error?.status === 422 && error?.info) {
        setValidationError(error.info);
        toast.error(error.info.message || 'Batch schema validation failed.');
      } else {
        toast.error('Failed to start batch pipeline.');
      }
    },
  });

  // Mutation: Explain
  const explainMutation = useMutation({
    mutationFn: async ({ modelId, data }: { modelId: string; data: Array<Record<string, any>> }) => {
      return apiClient.request<ExplainResponse>(`/api/models/${modelId}/explain`, {
        method: 'POST',
        body: JSON.stringify({ data }),
      });
    },
    onSuccess: (data: ExplainResponse) => {
      setExplanations(data.explanations);
      setFeatureImportance(data.feature_importance);
    },
    onError: (error) => {
      console.error('Explanation request failed:', error);
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
          toast.success('Batch execution finished!');
        } else if (response.status === 'PENDING' || response.status === 'PROGRESS') {
          setTimeout(poll, 2000);
        } else if (response.status === 'FAILURE') {
          toast.error('Batch pipeline failed.');
        }
      } catch (error) {
        console.error('Failed to check batch status:', error);
      }
    };
    poll();
  };

  const handlePredict = async () => {
    if (!selectedModel) {
      toast.error('Please select a pipeline first.');
      return;
    }

    setPredictions(null);
    setPredictionSummary(null);
    setValidationError(null);
    setExplanations(null);

    if (inputMethod === 'form') {
      const payload: Record<string, any> = {};
      features.forEach(f => {
        const val = formData[f.name];
        const isNum = f.type.includes('int') || f.type.includes('float') || f.type.includes('double') || f.type.includes('num');
        if (isNum) {
          payload[f.name] = parseFloat(val) || 0;
        } else {
          payload[f.name] = val;
        }
      });

      predictMutation.mutate({ modelId: selectedModel, data: [payload] });
      if (enableExplanations) {
        explainMutation.mutate({ modelId: selectedModel, data: [payload] });
      }
    } else if (inputMethod === 'manual') {
      try {
        const parsed = JSON.parse(manualData);
        const data = Array.isArray(parsed) ? parsed : [parsed];
        
        if (data.length === 0) {
          toast.error('JSON array is empty.');
          return;
        }

        predictMutation.mutate({ modelId: selectedModel, data });
        if (enableExplanations) {
          explainMutation.mutate({ modelId: selectedModel, data });
        }
      } catch (error) {
        toast.error('Invalid JSON structure. Please check bracket closures.');
      }
    } else if (inputMethod === 'file' && uploadedFile) {
      if (uploadedFile.size > 10 * 1024 * 1024) {
        batchPredictMutation.mutate({ modelId: selectedModel, file: uploadedFile });
      } else {
        predictFileMutation.mutate({ modelId: selectedModel, file: uploadedFile });
      }
    }
  };

  // Business implication explainer helper
  const businessExplanation = useMemo(() => {
    if (!explanations || explanations.length === 0) return null;
    const firstExp = explanations[0].feature_contributions || {};
    
    // Sort features by absolute contribution
    const sorted = Object.entries(firstExp)
      .map(([feature, val]) => ({ feature, val: Number(val) }))
      .sort((a, b) => Math.abs(b.val) - Math.abs(a.val));
      
    if (sorted.length === 0) return null;
    
    const topFeature = sorted[0];
    const isPositive = topFeature.val > 0;
    
    return {
      topFeature: topFeature.feature,
      direction: isPositive ? 'positive' : 'negative',
      impact: Math.abs(topFeature.val).toFixed(3),
      summary: `The primary driver for this prediction is "${topFeature.feature}", which shows a strong ${
        isPositive ? 'positive alignment' : 'negative drag'
      } of ${Math.abs(topFeature.val).toFixed(2)} units. We recommend monitoring deviations in this parameter to optimize system outcomes.`
    };
  }, [explanations]);

  return (
    <div className="space-y-6">
      
      {/* Active Pipeline Selector */}
      <Card className="p-6 bg-slate-950/40 border border-slate-900 backdrop-blur-md ease-base hover:border-slate-800">
        <div className="flex items-center gap-2 mb-4">
          <Cpu className="h-5 w-5 text-violet-400 animate-pulse" />
          <h3 className="font-display font-bold text-slate-200 text-base">Prediction Workspace</h3>
        </div>

        {modelsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2 text-violet-500" />
            <span className="font-body text-slate-400 text-xs">Accessing ML model registry...</span>
          </div>
        ) : models && models.length > 0 ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="model-select" className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Target Predictor Pipeline</Label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="w-full mt-1.5 bg-slate-900 border-slate-800 text-slate-300 rounded-xl focus:ring-violet-500/50">
                  <SelectValue placeholder="Select a trained pipeline model..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-300 rounded-xl">
                  {models.map((model) => (
                    <SelectItem key={model.id} value={model.id} className="hover:bg-slate-800 cursor-pointer focus:bg-slate-800">
                      <span className="font-semibold text-slate-200">{model.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono ml-2">v{model.version}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedModel && activeModel && (
              <div className="p-4 border border-slate-900 bg-slate-950/40 rounded-xl space-y-2 text-xs animate-slide-up-spring">
                <div className="grid sm:grid-cols-3 gap-3 text-slate-400 font-body">
                  <div>
                    <span className="block text-[9px] uppercase font-bold text-slate-600">Framework</span>
                    <strong className="text-slate-300">{activeModel.name}</strong>
                  </div>
                  <div>
                    <span className="block text-[9px] uppercase font-bold text-slate-600">Model Version</span>
                    <strong className="text-slate-300">v{activeModel.version}</strong>
                  </div>
                  <div>
                    <span className="block text-[9px] uppercase font-bold text-slate-600">Deployment Date</span>
                    <strong className="text-slate-300">{new Date(activeModel.created_at).toLocaleDateString()}</strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 border-2 border-dashed border-slate-900 rounded-2xl">
            <AlertCircle className="h-10 w-10 mx-auto mb-2 opacity-50 text-slate-600" />
            <p className="text-slate-400 font-display font-medium text-sm">No trained models in registry</p>
            <p className="text-xs text-slate-500 mt-1">Navigate to the AutoML tab to launch model training runs.</p>
          </div>
        )}
      </Card>

      {/* Input Methods */}
      {selectedModel && (
        <Card className="p-6 bg-slate-950/40 border border-slate-900 backdrop-blur-md ease-base hover:border-slate-800">
          <h3 className="font-display font-bold text-slate-200 text-base mb-4">Input Parameters</h3>
          
          <Tabs value={inputMethod} onValueChange={(value) => setInputMethod(value as any)}>
            <TabsList className="grid w-full grid-cols-3 bg-slate-900 border border-slate-800/80 p-1 mb-6 rounded-xl">
              <TabsTrigger value="form" className="rounded-lg py-2 text-xs font-semibold data-[state=active]:bg-slate-950 ease-spring">Interactive Form</TabsTrigger>
              <TabsTrigger value="manual" className="rounded-lg py-2 text-xs font-semibold data-[state=active]:bg-slate-950 ease-spring">Raw JSON</TabsTrigger>
              <TabsTrigger value="file" className="rounded-lg py-2 text-xs font-semibold data-[state=active]:bg-slate-950 ease-spring">Upload File</TabsTrigger>
            </TabsList>

            {/* Interactive Form Tab */}
            <TabsContent value="form" className="space-y-4 animate-slide-up-spring focus-visible:outline-none">
              {features.length > 0 ? (
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 max-h-[350px] overflow-y-auto pr-1">
                  {features.map((f) => {
                    const isNum = f.type.includes('int') || f.type.includes('float') || f.type.includes('double') || f.type.includes('num');
                    return (
                      <div key={f.name} className="space-y-1.5 group">
                        <Label htmlFor={`form-field-${f.name}`} className="text-xs font-semibold text-slate-400 flex items-center justify-between group-hover:text-slate-300 transition-colors">
                          <span className="truncate pr-1">{f.name}</span>
                          <Badge variant="outline" className="text-[9px] py-0 px-1 border-slate-800 text-slate-500 font-mono">{f.type}</Badge>
                        </Label>
                        <Input
                          id={`form-field-${f.name}`}
                          type={isNum ? 'number' : 'text'}
                          step="any"
                          value={formData[f.name] || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, [f.name]: e.target.value }))}
                          className="bg-slate-900 border-slate-800 text-slate-200 text-xs rounded-xl focus:border-violet-500/50"
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-4 text-slate-500 text-xs font-mono">
                  Deducing model schema...
                </div>
              )}
              
              <div className="flex items-center space-x-2 pt-4 border-t border-slate-900">
                <Switch
                  id="explanations"
                  checked={enableExplanations}
                  onCheckedChange={setEnableExplanations}
                />
                <Label htmlFor="explanations" className="text-xs font-semibold text-slate-400 cursor-pointer hover:text-slate-300">Compute SHAP Feature Contributions</Label>
              </div>
            </TabsContent>

            {/* Manual JSON Tab */}
            <TabsContent value="manual" className="space-y-4 animate-slide-up-spring focus-visible:outline-none">
              <div>
                <Label htmlFor="manual-data" className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Predict JSON Array</Label>
                <Textarea
                  id="manual-data"
                  placeholder='[{"Age": 32, "Sex": "male"}]'
                  value={manualData}
                  onChange={(e) => setManualData(e.target.value)}
                  className="mt-1.5 min-h-[160px] bg-slate-900 border-slate-800 font-mono text-xs text-slate-300 rounded-xl focus:border-violet-500/50"
                />
              </div>
              <div className="flex items-center space-x-2 pt-2">
                <Switch
                  id="explanations-manual"
                  checked={enableExplanations}
                  onCheckedChange={setEnableExplanations}
                />
                <Label htmlFor="explanations-manual" className="text-xs font-semibold text-slate-400 cursor-pointer hover:text-slate-300">Compute SHAP Feature Contributions</Label>
              </div>
            </TabsContent>

            {/* File Upload Tab */}
            <TabsContent value="file" className="space-y-4 animate-slide-up-spring focus-visible:outline-none">
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 ${
                  isDragActive
                    ? 'border-violet-500 bg-violet-500/5'
                    : 'border-slate-800 hover:border-violet-500/40 bg-slate-950/20'
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="h-10 w-10 mx-auto mb-3 text-slate-600" />
                {uploadedFile ? (
                  <div className="animate-badge-pop">
                    <CheckCircle className="h-5 w-5 mx-auto mb-2 text-emerald-500" />
                    <p className="text-sm font-semibold text-slate-300">{uploadedFile.name}</p>
                    <p className="text-[10px] text-slate-500 mt-1">Staged for ingestion. Click here to swap.</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-semibold text-slate-300 mb-1">Drag and drop file here</p>
                    <p className="text-xs text-slate-500 mb-4">Supports CSV and raw JSON schemas</p>
                    <Button variant="outline" size="sm" className="h-8 text-xs border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800">
                      Browse Local Drive
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {validationError && (
            <div className="mt-4 p-4 border border-rose-900 bg-rose-950/20 rounded-xl space-y-2 text-xs animate-slide-up-spring">
              <div className="flex items-start gap-2.5 text-rose-400">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-bold text-rose-300 block">Input Validation Failed</span>
                  <p className="mt-0.5 text-slate-400 font-body leading-relaxed">{validationError.message}</p>
                </div>
              </div>
              {validationError.missing && validationError.missing.length > 0 && (
                <div className="mt-2 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Missing Features Required by Model:</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {validationError.missing.map((feat) => (
                      <Badge key={feat} variant="outline" className="border-rose-900/60 bg-rose-950/20 text-rose-400 font-mono text-[9px]">
                        {feat}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {validationError.extra && validationError.extra.length > 0 && (
                <div className="mt-2 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Extra Ignored Features:</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {validationError.extra.map((feat) => (
                      <Badge key={feat} variant="outline" className="border-slate-800 bg-slate-900 text-slate-450 font-mono text-[9px]">
                        {feat}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end mt-6 pt-4 border-t border-slate-900">
            <Button
              onClick={handlePredict}
              disabled={predictMutation.isPending || (inputMethod === 'manual' && !manualData.trim()) || (inputMethod === 'file' && !uploadedFile)}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold shadow-glow border border-violet-500/30 rounded-xl"
            >
              {predictMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Running Inference...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Evaluate Inputs
                </>
              )}
            </Button>
          </div>
        </Card>
      )}

      {/* Predictions & Impact Dials */}
      {predictions && (
        <div className="grid md:grid-cols-3 gap-6 animate-slide-up-spring">
          
          {/* Main Prediction Score Dial */}
          <Card className="p-6 bg-slate-950/40 border border-slate-900 backdrop-blur-sm md:col-span-1 flex flex-col items-center justify-center text-center">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-4">Prediction Output</h4>
            
            {(() => {
              const firstPred = predictions[0];
              const isProbVal = typeof firstPred === 'number' && firstPred >= 0 && firstPred <= 1;
              
              if (isProbVal) {
                const percent = Math.round(firstPred * 100);
                const strokeDash = Math.round(283 - (283 * percent) / 100);
                return (
                  <div className="relative flex items-center justify-center h-36 w-36">
                    <svg className="absolute h-full w-full transform -rotate-90">
                      <circle cx="72" cy="72" r="45" className="stroke-slate-900" strokeWidth="8" fill="transparent" />
                      <circle
                        cx="72"
                        cy="72"
                        r="45"
                        className="stroke-violet-500 ring-arc"
                        strokeWidth="8"
                        fill="transparent"
                        strokeDasharray="283"
                        strokeDashoffset={strokeDash}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="text-center z-10">
                      <span className="counter-val font-display font-extrabold text-3xl text-slate-100">{percent}%</span>
                      <span className="block text-[9px] font-semibold text-slate-500 uppercase tracking-widest mt-0.5">Confidence</span>
                    </div>
                  </div>
                );
              }
              
              return (
                <div className="py-6 flex flex-col items-center">
                  <div className="h-20 w-20 rounded-full bg-violet-600/10 border border-violet-500/20 flex items-center justify-center mb-3">
                    <Sparkles className="h-8 w-8 text-violet-400" />
                  </div>
                  <div className="text-3xl font-extrabold font-display text-slate-200 tracking-tight">
                    {typeof firstPred === 'object' ? JSON.stringify(firstPred) : String(firstPred)}
                  </div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-2">Inferred Target Class</span>
                </div>
              );
            })()}
          </Card>

          {/* Raw Prediction Payload List */}
          <Card className="p-6 bg-slate-950/40 border border-slate-900 backdrop-blur-sm md:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-slate-200 text-sm">Target Value Records</h3>
              <Button variant="outline" size="sm" className="h-7 text-[10px] border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200 rounded-lg">
                <Download className="h-3 w-3 mr-1.5" />
                Export CSV
              </Button>
            </div>
            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
              {predictions.map((pred, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border border-slate-900 bg-slate-950/30 rounded-xl ease-base hover:border-slate-800">
                  <span className="font-semibold text-[10px] text-slate-500 font-display">Row Item #{idx + 1}</span>
                  <span className="text-xs font-mono text-cyan-400 font-bold">
                    {typeof pred === 'object' ? JSON.stringify(pred) : String(pred)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Prediction Summary Insights Card */}
      {predictions && predictionSummary && (
        <Card className="p-6 bg-slate-950/40 border border-slate-900 backdrop-blur-sm animate-slide-up-spring">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-violet-400" />
            <h3 className="font-display font-bold text-slate-200 text-sm">Prediction Aggregates & Insights</h3>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="p-3 bg-slate-900/40 border border-slate-900 rounded-xl">
              <span className="block text-[10px] uppercase font-bold text-slate-500">Total Evaluations</span>
              <strong className="text-slate-200 text-lg font-mono">{predictionSummary.total_predictions}</strong>
            </div>
            {predictionSummary.prediction_types?.numeric && (
              <>
                <div className="p-3 bg-slate-900/40 border border-slate-900 rounded-xl">
                  <span className="block text-[10px] uppercase font-bold text-slate-500">Average Output</span>
                  <strong className="text-slate-200 text-lg font-mono">
                    {predictionSummary.prediction_types.numeric.mean.toFixed(4)}
                  </strong>
                </div>
                <div className="p-3 bg-slate-900/40 border border-slate-900 rounded-xl">
                  <span className="block text-[10px] uppercase font-bold text-slate-500">Output Range</span>
                  <strong className="text-slate-200 text-xs font-mono truncate block mt-1">
                    [{predictionSummary.prediction_types.numeric.min.toFixed(2)}, {predictionSummary.prediction_types.numeric.max.toFixed(2)}]
                  </strong>
                </div>
                <div className="p-3 bg-slate-900/40 border border-slate-900 rounded-xl">
                  <span className="block text-[10px] uppercase font-bold text-slate-500">Std Deviation</span>
                  <strong className="text-slate-200 text-lg font-mono">
                    {predictionSummary.prediction_types.numeric.std.toFixed(4)}
                  </strong>
                </div>
              </>
            )}
            {predictionSummary.prediction_types?.categorical && (
              <>
                <div className="p-3 bg-slate-900/40 border border-slate-900 rounded-xl">
                  <span className="block text-[10px] uppercase font-bold text-slate-500">Dominant Category</span>
                  <strong className="text-violet-400 text-lg truncate block">
                    {predictionSummary.prediction_types.categorical.most_common}
                  </strong>
                </div>
                <div className="p-3 bg-slate-900/40 border border-slate-900 rounded-xl">
                  <span className="block text-[10px] uppercase font-bold text-slate-500">Unique Categories</span>
                  <strong className="text-slate-200 text-lg font-mono">
                    {predictionSummary.prediction_types.categorical.unique_values}
                  </strong>
                </div>
              </>
            )}
          </div>
          {predictionSummary.insights && predictionSummary.insights.length > 0 && (
            <div className="mt-4 p-4 bg-violet-950/10 border border-violet-900/30 rounded-xl space-y-2">
              <span className="text-[10px] uppercase font-bold text-violet-400 block tracking-wider">Automated Diagnostics</span>
              <ul className="space-y-1.5">
                {predictionSummary.insights.map((insight: string, idx: number) => (
                  <li key={idx} className="text-xs text-slate-400 font-body flex items-start gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-violet-400 mt-0.5 flex-shrink-0" />
                    <span>{insight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {/* SHAP Explanations */}
      {explanations && enableExplanations && (
        <div className="grid md:grid-cols-3 gap-6 animate-slide-up-spring">
          
          {/* Explanation bar details */}
          <Card className="p-6 bg-slate-950/40 border border-slate-900 backdrop-blur-sm md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-4 w-4 text-cyan-400 animate-pulse" />
              <h3 className="font-display font-bold text-slate-200 text-sm">SHAP Waterfall Analysis</h3>
            </div>
            <div className="space-y-6 max-h-[300px] overflow-y-auto pr-2">
              {explanations.map((exp, index) => (
                <div key={index} className="space-y-3">
                  {Object.entries(exp.feature_contributions || {}).map(([feature, contribution]) => {
                    const value = Number(contribution);
                    const absValue = Math.min(Math.abs(value) * 100, 100);
                    const isPositive = value > 0;
                    return (
                      <div key={feature} className="space-y-1 group">
                        <div className="flex justify-between text-[11px] font-body text-slate-400 group-hover:text-slate-300 transition-colors">
                          <span>{feature}</span>
                          <span className={isPositive ? "text-cyan-400 font-mono font-bold" : "text-amber-500 font-mono font-bold"}>
                            {value > 0 ? "+" : ""}{value.toFixed(4)}
                          </span>
                        </div>
                        <div className="relative h-2 w-full bg-slate-900/60 rounded-full overflow-hidden flex border border-slate-950">
                          <div className="w-1/2 flex justify-end">
                            {!isPositive && (
                              <div className="bg-gradient-to-l from-amber-500 to-rose-500 h-full rounded-l-full ease-draw" style={{ width: `${absValue}%` }} />
                            )}
                          </div>
                          <div className="w-1/2 flex justify-start">
                            {isPositive && (
                              <div className="bg-gradient-to-r from-cyan-500 to-teal-500 h-full rounded-r-full ease-draw" style={{ width: `${absValue}%` }} />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </Card>

          {/* Business Insights Explainer */}
          <Card className="p-6 bg-slate-950/40 border border-slate-900 backdrop-blur-sm md:col-span-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-violet-400" />
                <h4 className="font-display font-bold text-slate-200 text-xs uppercase tracking-wider">Predictor Insights</h4>
              </div>
              {businessExplanation ? (
                <div className="space-y-3 text-xs font-body text-slate-400">
                  <p className="leading-relaxed">{businessExplanation.summary}</p>
                  <div className="p-3 border border-slate-900 bg-slate-950/40 rounded-xl flex items-center justify-between">
                    <span className="font-bold text-slate-500">Total Attribution Impact</span>
                    <span className="font-bold text-slate-300 font-mono">{businessExplanation.impact}</span>
                  </div>
                </div>
              ) : (
                <p className="text-slate-500 text-xs font-body">No attribution signals found in explanations.</p>
              )}
            </div>
            <div className="pt-4 border-t border-slate-900 mt-4 text-[10px] text-slate-600 flex items-center gap-1 font-body">
              <HelpCircle className="h-3.5 w-3.5" />
              <span>Attribution derived via LIME/Perturbation explainer.</span>
            </div>
          </Card>
        </div>
      )}

      {/* Global Feature Importance */}
      {featureImportance && enableExplanations && (
        <Card className="p-6 bg-slate-950/40 border border-slate-900 backdrop-blur-sm ease-base hover:border-slate-800">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-indigo-400" />
            <h3 className="font-display font-bold text-slate-200 text-sm">Global Feature Importance (Top 10)</h3>
          </div>
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
            {Object.entries(featureImportance)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 10)
              .map(([feature, importance]) => (
                <div key={feature} className="flex items-center justify-between p-2 border border-slate-900 bg-slate-950/20 rounded-xl">
                  <span className="text-xs text-slate-400 font-body truncate max-w-[150px]">{feature}</span>
                  <div className="flex items-center space-x-2">
                    <Progress value={importance * 100} className="w-20 bg-slate-900 h-1.5" />
                    <span className="text-xs font-mono text-slate-500 w-10 text-right">
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
