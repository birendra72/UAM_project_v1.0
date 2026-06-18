import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Database, BarChart, Brain, Download, Play, Loader2, Upload, Eye, Trash2, Plus, Minus, Shield, Sparkles, LayoutGrid, Cpu, LineChart } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import DatasetPreviewModal from "@/components/DatasetPreviewModal";
import TaskAnalysis from "@/components/TaskAnalysis";
import AutoMLTrainingInterface from "@/components/AutoMLTrainingInterface";
import TrainingProgress from "@/components/TrainingProgress";
import ModelComparisonResults from "@/components/ModelComparisonResults";
import PredictionInterface from "@/components/PredictionInterface";
import ExportInterface from "@/components/ExportInterface";
import EDADashboard from "@/components/EDADashboard";

interface Project {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

interface Dataset {
  id: string;
  filename: string;
  rows?: number;
  cols?: number;
  size?: string;
}

export default function ProjectOverview() {
  const { projectId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "data";
  
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const queryClient = useQueryClient();

  const { data: project, isLoading: projectLoading, error: projectError } = useQuery<Project>({
    queryKey: ["project", projectId],
    queryFn: () => apiClient.getProject(projectId!),
    enabled: !!projectId && projectId.trim() !== ""
  });

  const { data: projectDatasets, isLoading: datasetsLoading } = useQuery<Dataset[]>({
    queryKey: ["project-datasets", projectId],
    queryFn: () => apiClient.getProjectDatasets(projectId!),
    enabled: !!projectId
  });

  const { data: allDatasets, isLoading: allDatasetsLoading } = useQuery<Dataset[]>({
    queryKey: ["all-datasets"],
    queryFn: () => apiClient.getDatasets(),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => apiClient.uploadDataset(file, projectId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-datasets", projectId] });
      toast.success("Dataset uploaded successfully!");
    },
    onError: (error) => {
      console.error("Upload failed:", error);
      toast.error("Failed to upload dataset. Please try again.");
    }
  });

  const linkMutation = useMutation({
    mutationFn: ({ datasetId, projectId }: { datasetId: string; projectId: string }) =>
      apiClient.linkDatasetToProject(datasetId, projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-datasets", projectId] });
      queryClient.invalidateQueries({ queryKey: ["all-datasets"] });
      toast.success("Dataset linked to project successfully!");
    },
    onError: (error) => {
      console.error("Link failed:", error);
      toast.error("Failed to link dataset to project. Please try again.");
    }
  });

  const unlinkMutation = useMutation({
    mutationFn: ({ datasetId, projectId }: { datasetId: string; projectId: string }) =>
      apiClient.unlinkDatasetFromProject(datasetId, projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-datasets", projectId] });
      queryClient.invalidateQueries({ queryKey: ["all-datasets"] });
      toast.success("Dataset unlinked from project successfully!");
    },
    onError: (error) => {
      console.error("Unlink failed:", error);
      toast.error("Failed to unlink dataset from project. Please try again.");
    }
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      uploadMutation.mutate(acceptedFiles[0]);
    }
  }, [uploadMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/json': ['.json'],
      'application/x-parquet': ['.parquet']
    },
    multiple: false
  });

  const handlePreviewClick = (dataset: Dataset) => {
    setSelectedDataset(dataset);
    setShowPreviewModal(true);
  };

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  if (projectLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        </div>
      </AppLayout>
    );
  }

  if (projectError || !project) {
    return (
      <AppLayout>
        <div className="text-center py-12 max-w-md mx-auto space-y-4">
          <h2 className="text-2xl font-extrabold font-display text-slate-200">Project Not Found</h2>
          <p className="text-xs text-slate-400 font-body">The project you're looking for doesn't exist or you don't have access credentials.</p>
          <Link to="/app/projects">
            <Button className="bg-violet-600 hover:bg-violet-500">Back to Projects</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const datasetCount = projectDatasets?.length || 0;
  const totalRows = projectDatasets?.reduce((sum, ds) => sum + (ds.rows || 0), 0) || 0;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in text-slate-100 font-body">
        
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-900 pb-5">
          <div className="flex items-center gap-3">
            <Link to="/app/projects">
              <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-slate-900/40 rounded-xl">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight font-display bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">
                {project.name}
              </h1>
              <p className="text-xs text-slate-500 font-mono mt-0.5">ID: {projectId}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-[10.5px] font-bold font-mono bg-violet-500/10 text-violet-400 rounded-full border border-violet-500/20">
              ● Active Workspace
            </span>
          </div>
        </div>

        {/* Workspace Quick KPIs Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Datasets Counter */}
          <Card className="p-4 bg-slate-950/40 border border-slate-900 backdrop-blur-sm relative overflow-hidden group hover:border-violet-500/20 transition-all duration-300">
            <div className="absolute top-0 left-0 w-1 h-full bg-violet-500/50" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Datasets</span>
              <Database className="h-4 w-4 text-violet-400" />
            </div>
            <div className="text-2xl font-extrabold font-display text-slate-200">{datasetCount}</div>
            <div className="text-[10px] text-slate-500 font-mono mt-1">Files cataloged in project</div>
          </Card>

          {/* Rows Counter */}
          <Card className="p-4 bg-slate-950/40 border border-slate-900 backdrop-blur-sm relative overflow-hidden group hover:border-cyan-500/20 transition-all duration-300">
            <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500/50" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Rows</span>
              <BarChart className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-extrabold font-display text-slate-200">{totalRows.toLocaleString()}</div>
            <div className="text-[10px] text-slate-500 font-mono mt-1">Aggregated dataset rows</div>
          </Card>

          {/* Models Counter */}
          <Card className="p-4 bg-slate-950/40 border border-slate-900 backdrop-blur-sm relative overflow-hidden group hover:border-emerald-500/20 transition-all duration-300">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/50" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Models</span>
              <Brain className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-extrabold font-display text-slate-200">Active</div>
            <div className="text-[10px] text-slate-500 font-mono mt-1">AutoML pipelines registered</div>
          </Card>

          {/* Project Status */}
          <Card className="p-4 bg-slate-950/40 border border-slate-900 backdrop-blur-sm relative overflow-hidden group hover:border-amber-500/20 transition-all duration-300">
            <div className="absolute top-0 left-0 w-1 h-full bg-amber-500/50" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Status</span>
              <Play className="h-4 w-4 text-amber-400" />
            </div>
            <div className="text-2xl font-extrabold font-display text-slate-200">
              {datasetCount > 0 ? "Ready" : "Empty"}
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-1">Workspace validation status</div>
          </Card>

        </div>

        {/* Tab Selection */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 bg-slate-900/50 border border-slate-900 p-1 rounded-xl">
            <TabsTrigger value="data" className="text-xs font-semibold data-[state=active]:bg-slate-950 data-[state=active]:text-violet-400 transition-all">Data Registry</TabsTrigger>
            <TabsTrigger value="explore" className="text-xs font-semibold data-[state=active]:bg-slate-950 data-[state=active]:text-violet-400 transition-all">EDA Visuals</TabsTrigger>
            <TabsTrigger value="analyze" className="text-xs font-semibold data-[state=active]:bg-slate-950 data-[state=active]:text-violet-400 transition-all">Task Audit</TabsTrigger>
            <TabsTrigger value="models" className="text-xs font-semibold data-[state=active]:bg-slate-950 data-[state=active]:text-violet-400 transition-all">Model Train</TabsTrigger>
            <TabsTrigger value="predict" className="text-xs font-semibold data-[state=active]:bg-slate-950 data-[state=active]:text-violet-400 transition-all">Predict Tab</TabsTrigger>
            <TabsTrigger value="export" className="text-xs font-semibold data-[state=active]:bg-slate-950 data-[state=active]:text-violet-400 transition-all">Export Tab</TabsTrigger>
          </TabsList>

          {/* Data Registry Tab */}
          <TabsContent value="data" className="space-y-6 mt-6">
            
            <div className="grid lg:grid-cols-3 gap-6">
              
              {/* Left 2 Columns: Datasets lists */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Upload Area */}
                <Card className="p-6 bg-slate-950/40 border border-slate-900 backdrop-blur-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <Upload className="h-5 w-5 text-violet-400" />
                    <h3 className="font-display font-bold text-slate-200 text-sm">Upload New Dataset</h3>
                  </div>

                  <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                      isDragActive
                        ? 'border-violet-500 bg-violet-500/5'
                        : 'border-slate-800 hover:border-violet-500/30 bg-slate-950/20'
                    }`}
                  >
                    <input {...getInputProps()} />
                    <Upload className="h-10 w-10 mx-auto mb-3 text-slate-500" />
                    {isDragActive ? (
                      <p className="text-sm font-semibold text-violet-400">Drop the dataset file here...</p>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-300">Drag & drop dataset file here</p>
                        <p className="text-xs text-slate-500">Supports CSV, Excel, JSON, Parquet</p>
                        <div className="pt-2">
                          <Button variant="outline" size="sm" className="h-8 text-xs border-slate-800 bg-slate-900 text-slate-300 hover:text-slate-100">
                            Browse Files
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  {uploadMutation.isPending && (
                    <div className="mt-4 flex items-center justify-center gap-2 bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                      <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
                      <p className="text-xs text-slate-400 font-mono">Uploading and parsing dataset columns...</p>
                    </div>
                  )}
                </Card>

                {/* Project Datasets */}
                <Card className="p-6 bg-slate-950/40 border border-slate-900 backdrop-blur-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <Database className="h-5 w-5 text-cyan-400" />
                    <h3 className="font-display font-bold text-slate-200 text-sm">Project Active Datasets</h3>
                  </div>

                  {datasetsLoading ? (
                    <div className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-cyan-400" />
                      <p className="text-xs text-slate-500 font-mono mt-2">Loading datasets...</p>
                    </div>
                  ) : projectDatasets && projectDatasets.length > 0 ? (
                    <div className="space-y-3">
                      {projectDatasets.map(dataset => (
                        <div key={dataset.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-slate-900 bg-slate-950/20 hover:border-slate-800 transition-colors rounded-xl gap-3">
                          <div className="flex items-center space-x-3">
                            <div className="h-10 w-10 bg-slate-900 text-violet-400 flex items-center justify-center rounded-lg border border-slate-800">
                              <Database className="h-5 w-5" />
                            </div>
                            <div>
                              <h4 className="font-bold text-sm text-slate-200 truncate max-w-[200px]" title={dataset.filename}>
                                {dataset.filename}
                              </h4>
                              <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                                Size: {dataset.size || 'Unknown'} | Rows: {dataset.rows?.toLocaleString() || 'N/A'} | Cols: {dataset.cols || 'N/A'}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 self-end sm:self-auto">
                            <Button variant="outline" size="sm" className="h-8 text-xs border-slate-800 bg-slate-950 text-slate-300 hover:text-slate-100" onClick={() => handlePreviewClick(dataset)}>
                              <Eye className="h-3.5 w-3.5 mr-1.5" />
                              Preview
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs border-slate-800 bg-slate-950 text-rose-400 hover:text-rose-300 hover:bg-rose-950/20"
                              onClick={() => unlinkMutation.mutate({ datasetId: dataset.id, projectId: projectId! })}
                              disabled={unlinkMutation.isPending}
                            >
                              <Minus className="h-3.5 w-3.5 mr-1.5" />
                              Unlink
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 border border-dashed border-slate-900 rounded-xl">
                      <Database className="w-10 h-10 text-slate-600 mx-auto mb-2 opacity-55" />
                      <p className="text-xs text-slate-400">No active datasets linked yet</p>
                    </div>
                  )}
                </Card>

              </div>

              {/* Right Column: Link existing datasets */}
              <div>
                <Card className="p-6 bg-slate-950/40 border border-slate-900 backdrop-blur-sm h-full">
                  <div className="flex items-center gap-2 mb-4">
                    <Plus className="h-5 w-5 text-amber-400" />
                    <h3 className="font-display font-bold text-slate-200 text-sm">Link Available Files</h3>
                  </div>

                  {allDatasetsLoading ? (
                    <div className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-amber-400" />
                    </div>
                  ) : allDatasets && allDatasets.length > 0 ? (
                    <div className="space-y-3">
                      {allDatasets
                        .filter(dataset => !projectDatasets?.some(pd => pd.id === dataset.id))
                        .map(dataset => (
                          <div key={dataset.id} className="p-3 border border-slate-900 bg-slate-950/10 hover:border-slate-800 rounded-lg space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h5 className="font-bold text-xs text-slate-300 truncate max-w-[150px]" title={dataset.filename}>
                                  {dataset.filename}
                                </h5>
                                <p className="text-[9px] text-slate-500 font-mono mt-0.5">
                                  Rows: {dataset.rows?.toLocaleString() || 'N/A'}
                                </p>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[10px] border-slate-800 bg-slate-950 text-slate-300 hover:text-slate-100"
                                onClick={() => linkMutation.mutate({ datasetId: dataset.id, projectId: projectId! })}
                                disabled={linkMutation.isPending}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Link
                              </Button>
                            </div>
                          </div>
                        ))}
                      
                      {allDatasets.filter(dataset => !projectDatasets?.some(pd => pd.id === dataset.id)).length === 0 && (
                        <p className="text-xs text-slate-500 text-center py-8">All datasets are already linked.</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 text-center py-8">No other datasets found in repository.</p>
                  )}
                </Card>
              </div>

            </div>

          </TabsContent>

          {/* Explore (EDA) Tab */}
          <TabsContent value="explore" className="space-y-6 mt-6">
            {datasetCount > 0 ? (
              <EDADashboard projectId={projectId!} />
            ) : (
              <Card className="p-8 bg-slate-950/40 border border-slate-900 text-center">
                <BarChart className="h-10 w-10 mx-auto text-slate-600 mb-2" />
                <p className="text-sm text-slate-400">Please upload and link a dataset first to generate interactive EDA plots.</p>
              </Card>
            )}
          </TabsContent>

          {/* Analyze Tab */}
          <TabsContent value="analyze" className="space-y-6 mt-6">
            {datasetCount > 0 ? (
              <TaskAnalysis projectId={projectId!} />
            ) : (
              <Card className="p-8 bg-slate-950/40 border border-slate-900 text-center">
                <Brain className="h-10 w-10 mx-auto text-slate-600 mb-2" />
                <p className="text-sm text-slate-400">Please upload and link a dataset first to run task capability checks.</p>
              </Card>
            )}
          </TabsContent>

          {/* Models Tab */}
          <TabsContent value="models" className="space-y-6 mt-6">
            {datasetCount > 0 ? (
              <Tabs defaultValue="train" className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-slate-900/40 border border-slate-900 p-1 rounded-xl max-w-md">
                  <TabsTrigger value="train" className="text-xs font-semibold data-[state=active]:bg-slate-950 data-[state=active]:text-violet-400">Configure</TabsTrigger>
                  <TabsTrigger value="progress" className="text-xs font-semibold data-[state=active]:bg-slate-950 data-[state=active]:text-violet-400">Monitor</TabsTrigger>
                  <TabsTrigger value="results" className="text-xs font-semibold data-[state=active]:bg-slate-950 data-[state=active]:text-violet-400">Comparison</TabsTrigger>
                </TabsList>

                <TabsContent value="train" className="mt-4">
                  <AutoMLTrainingInterface projectId={projectId!} />
                </TabsContent>

                <TabsContent value="progress" className="mt-4">
                  <TrainingProgress projectId={projectId!} />
                </TabsContent>

                <TabsContent value="results" className="mt-4">
                  <ModelComparisonResults projectId={projectId!} />
                </TabsContent>
              </Tabs>
            ) : (
              <Card className="p-8 bg-slate-950/40 border border-slate-900 text-center">
                <Brain className="h-10 w-10 mx-auto text-slate-600 mb-2" />
                <p className="text-sm text-slate-400">Please upload and link a dataset first to configure training parameters.</p>
              </Card>
            )}
          </TabsContent>

          {/* Predict Tab */}
          <TabsContent value="predict" className="space-y-6 mt-6">
            {datasetCount > 0 ? (
              <PredictionInterface projectId={projectId!} />
            ) : (
              <Card className="p-8 bg-slate-950/40 border border-slate-900 text-center">
                <Play className="h-10 w-10 mx-auto text-slate-600 mb-2" />
                <p className="text-sm text-slate-400">Please upload and link a dataset first to run predictions.</p>
              </Card>
            )}
          </TabsContent>

          {/* Export Tab */}
          <TabsContent value="export" className="space-y-6 mt-6">
            <ExportInterface projectId={projectId!} />
          </TabsContent>

        </Tabs>
      </div>

      {/* Dataset Preview Modal */}
      {showPreviewModal && selectedDataset && (
        <DatasetPreviewModal
          isOpen={showPreviewModal}
          dataset={selectedDataset}
          onClose={() => {
            setShowPreviewModal(false);
            setSelectedDataset(null);
          }}
        />
      )}
    </AppLayout>
  );
}
