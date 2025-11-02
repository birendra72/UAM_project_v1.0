import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Database, BarChart, Brain, Download, Play, Loader2, Upload, Eye, Trash2, Plus, Minus } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import DatasetPreviewModal from "@/components/DatasetPreviewModal";
import DataVisualization from "@/components/DataVisualization";
import EDADashboard from "@/components/EDADashboard";
import TaskAnalysis from "@/components/TaskAnalysis";
import AutoMLTrainingInterface from "@/components/AutoMLTrainingInterface";
import TrainingProgress from "@/components/TrainingProgress";
import ModelComparisonResults from "@/components/ModelComparisonResults";
import PredictionInterface from "@/components/PredictionInterface";
import ExportInterface from "@/components/ExportInterface";

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



  if (projectLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (projectError || !project) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-2">Project Not Found</h2>
          <p className="text-muted-foreground mb-4">The project you're looking for doesn't exist or you don't have access to it.</p>
          <Link to="/app/projects">
            <Button>Back to Projects</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <Link to="/app/projects">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">{project.name}</h1>
            <p className="text-muted-foreground">Project #{projectId}</p>
          </div>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>

        <div className="grid md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Datasets</span>
              <Database className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-bold">
              {projectDatasets?.length || 0}
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Total Rows</span>
              <BarChart className="h-4 w-4 text-accent" />
            </div>
            <div className="text-2xl font-bold">
              {projectDatasets?.reduce((sum, ds) => sum + (ds.rows || 0), 0).toLocaleString() || 0}
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Models</span>
              <Brain className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-bold">
              0
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Status</span>
              <Play className="h-4 w-4 text-accent" />
            </div>
            <div className="text-2xl font-bold">
              {projectDatasets && projectDatasets.length > 0 ? "Active" : "Setup"}
            </div>
          </Card>
        </div>

        <Tabs defaultValue="data" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="data">Data</TabsTrigger>
            <TabsTrigger value="explore">Explore</TabsTrigger>
            <TabsTrigger value="analyze">Analyze</TabsTrigger>
            <TabsTrigger value="models">Models</TabsTrigger>
            <TabsTrigger value="predict">Predict</TabsTrigger>
            <TabsTrigger value="export">Export</TabsTrigger>
          </TabsList>

          <TabsContent value="data" className="space-y-4 mt-6">
            {/* Upload Area */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Upload Dataset</h3>
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
                {isDragActive ? (
                  <p className="text-lg font-medium">Drop the dataset file here...</p>
                ) : (
                  <div>
                    <p className="text-lg font-medium mb-2">Drag & drop a dataset file here</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      or click to browse files (CSV, Excel, JSON, Parquet)
                    </p>
                    <Button variant="outline" size="sm">
                      Browse Files
                    </Button>
                  </div>
                )}
              </div>
              {uploadMutation.isPending && (
                <div className="mt-4 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Uploading dataset...</p>
                </div>
              )}
            </Card>

            {/* Datasets List */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Project Datasets</h3>
              {datasetsLoading ? (
                <div className="text-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                  <p className="text-muted-foreground">Loading datasets...</p>
                </div>
              ) : projectDatasets && projectDatasets.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {projectDatasets.map(dataset => (
                    <Card key={dataset.id} className="p-4 border border-border hover:border-primary transition-all duration-300">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <Database className="h-8 w-8 text-primary" />
                          <div>
                            <h4 className="font-semibold text-sm truncate" title={dataset.filename}>
                              {dataset.filename}
                            </h4>
                            <p className="text-xs text-muted-foreground">
                              {dataset.size || 'Unknown size'}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mb-3">
                        <div className="flex justify-between">
                          <span>Rows: <span className="font-medium text-foreground">{dataset.rows?.toLocaleString() || 'N/A'}</span></span>
                          <span>Cols: <span className="font-medium text-foreground">{dataset.cols || 'N/A'}</span></span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={() => handlePreviewClick(dataset)}>
                          <Eye className="h-3 w-3" />
                          Preview
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 text-destructive hover:text-destructive"
                          onClick={() => unlinkMutation.mutate({ datasetId: dataset.id, projectId: projectId! })}
                          disabled={unlinkMutation.isPending}
                        >
                          <Minus className="h-3 w-3" />
                          Unlink
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-muted/50 rounded-xl border border-border">
                  <Database className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h4 className="text-lg font-semibold mb-2">No Datasets Yet</h4>
                  <p className="text-muted-foreground">Upload your first dataset to get started with this project.</p>
                </div>
              )}
            </Card>

            {/* Link Existing Datasets */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Link Existing Datasets</h3>
              {allDatasetsLoading ? (
                <div className="text-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                  <p className="text-muted-foreground">Loading datasets...</p>
                </div>
              ) : allDatasets && allDatasets.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {allDatasets
                    .filter(dataset => !projectDatasets?.some(pd => pd.id === dataset.id))
                    .map(dataset => (
                      <Card key={dataset.id} className="p-4 border border-border hover:border-primary transition-all duration-300">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <Database className="h-8 w-8 text-primary" />
                            <div>
                              <h4 className="font-semibold text-sm truncate" title={dataset.filename}>
                                {dataset.filename}
                              </h4>
                              <p className="text-xs text-muted-foreground">
                                {dataset.size || 'Unknown size'}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground mb-3">
                          <div className="flex justify-between">
                            <span>Rows: <span className="font-medium text-foreground">{dataset.rows?.toLocaleString() || 'N/A'}</span></span>
                            <span>Cols: <span className="font-medium text-foreground">{dataset.cols || 'N/A'}</span></span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={() => handlePreviewClick(dataset)}>
                            <Eye className="h-3 w-3" />
                            Preview
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => linkMutation.mutate({ datasetId: dataset.id, projectId: projectId! })}
                            disabled={linkMutation.isPending}
                          >
                            <Plus className="h-3 w-3" />
                            Link
                          </Button>
                        </div>
                      </Card>
                    ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-muted/50 rounded-xl border border-border">
                  <Database className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h4 className="text-lg font-semibold mb-2">No Datasets Available</h4>
                  <p className="text-muted-foreground">Upload datasets first to link them to this project.</p>
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="analyze" className="space-y-4 mt-6">
            {projectDatasets && projectDatasets.length > 0 ? (
              <TaskAnalysis projectId={projectId!} />
            ) : (
              <Card className="p-6">
                <div className="text-center py-12 text-muted-foreground">
                  <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Upload a dataset first to analyze and determine the ML task type.</p>
                </div>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="explore" className="space-y-4 mt-6">
            {projectDatasets && projectDatasets.length > 0 ? (
              <EDADashboard projectId={projectId!} />
            ) : (
              <Card className="p-6">
                <div className="text-center py-12 text-muted-foreground">
                  <BarChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Upload a dataset first to explore insights and visualizations.</p>
                </div>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="models" className="space-y-4 mt-6">
            {projectDatasets && projectDatasets.length > 0 ? (
              <Tabs defaultValue="train" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="train">Train Models</TabsTrigger>
                  <TabsTrigger value="progress">Training Progress</TabsTrigger>
                  <TabsTrigger value="results">Model Results</TabsTrigger>
                </TabsList>

                <TabsContent value="train" className="space-y-4 mt-6">
                  <AutoMLTrainingInterface projectId={projectId!} />
                </TabsContent>

                <TabsContent value="progress" className="space-y-4 mt-6">
                  <TrainingProgress projectId={projectId!} />
                </TabsContent>

                <TabsContent value="results" className="space-y-4 mt-6">
                  <ModelComparisonResults projectId={projectId!} />
                </TabsContent>
              </Tabs>
            ) : (
              <Card className="p-6">
                <div className="text-center py-12 text-muted-foreground">
                  <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Upload a dataset first to train and manage models.</p>
                </div>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="predict" className="space-y-4 mt-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Make Predictions</h3>
              {projectDatasets && projectDatasets.length > 0 ? (
                <PredictionInterface projectId={projectId!} />
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Play className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Upload a dataset and train models first to make predictions.</p>
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="export" className="space-y-4 mt-6">
            <ExportInterface projectId={projectId!} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
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
