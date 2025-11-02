import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Search, FolderKanban, BarChart3, Database, Zap, CheckCircle, TrendingUp, Trash2, Upload, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useState, useCallback, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

interface Project {
  id: string;
  name: string;
  description?: string;
  status?: string;
  datasetName?: string;
  progress?: number;
  keyMetric?: {
    name: string;
    value: string;
  };
  lastUpdated?: string;
}

interface PortfolioStats {
  activeProjects: number;
  datasetsUsed: number;
  modelsTraining: number;
  avgDataQuality: string;
  topModelType: string;
}

export default function Projects() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: () => apiClient.getProjects()
  });

  const { data: stats, isLoading: statsLoading } = useQuery<PortfolioStats>({
    queryKey: ["portfolio-stats"],
    queryFn: () => apiClient.getPortfolioStats() as Promise<PortfolioStats>
  });

  const deleteProjectMutation = useMutation({
    mutationFn: (projectId: string) => apiClient.deleteProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-stats"] });
      toast.success("Project deleted successfully");
    },
    onError: (error) => {
      console.error("Failed to delete project:", error);
      toast.error("Failed to delete project. Please try again.");
    }
  });

  const uploadMutation = useMutation({
    mutationFn: ({ file, projectId }: { file: File; projectId?: string }) => apiClient.uploadDataset(file, projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-datasets"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Dataset uploaded successfully!");
    },
    onError: (error) => {
      console.error("Upload failed:", error);
      toast.error("Failed to upload dataset. Please try again.");
    }
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      uploadMutation.mutate({ file: acceptedFiles[0] });
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

  const filteredProjects = (projects as Project[])?.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleDeleteProject = (projectId: string, projectName: string) => {
    deleteProjectMutation.mutate(projectId);
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Projects Hub</h1>
            <p className="text-muted-foreground">Your command center for all analysis projects.</p>
          </div>
          <Button onClick={() => setCreateModalOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Create New Project
          </Button>
        </div>

        {/* Portfolio Overview */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Portfolio Overview
          </h2>
          {statsLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard
                title="Active Projects"
                value={stats?.activeProjects || 0}
                icon={<FolderKanban className="h-5 w-5 text-primary" />}
              />
              <StatCard
                title="Datasets Used"
                value={stats?.datasetsUsed || 0}
                icon={<Database className="h-5 w-5 text-primary" />}
              />
              <StatCard
                title="Models Training"
                value={stats?.modelsTraining || 0}
                icon={<Zap className="h-5 w-5 text-primary" />}
              />
              <StatCard
                title="Avg. Data Quality"
                value={stats?.avgDataQuality || 'N/A'}
                icon={<CheckCircle className="h-5 w-5 text-primary" />}
              />
              <StatCard
                title="Top Model Type"
                value={stats?.topModelType || 'N/A'}
                icon={<TrendingUp className="h-5 w-5 text-primary" />}
              />
            </div>
          )}
        </Card>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

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

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projectsLoading ? (
            <p>Loading projects...</p>
          ) : filteredProjects.length === 0 ? (
            <Card className="p-12 text-center">
              <FolderKanban className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Projects Yet</h3>
              <p className="text-muted-foreground">Get started by creating your first project.</p>
            </Card>
          ) : (
            filteredProjects.map((project: Project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onDelete={() => handleDeleteProject(project.id, project.name)}
              />
            ))
          )}
        </div>

        <ProjectCreationModal
          isOpen={isCreateModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onProjectCreated={() => {
            queryClient.invalidateQueries({ queryKey: ["projects"] });
            queryClient.invalidateQueries({ queryKey: ["portfolio-stats"] });
          }}
        />
      </div>
    </AppLayout>
  );
}

function StatCard({ title, value, icon }: { title: string; value: number | string; icon: React.ReactNode }) {
  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="p-2 bg-muted rounded-lg">{icon}</div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-lg font-semibold">{value}</p>
        </div>
      </div>
    </Card>
  );
}

function ProjectCard({ project, onDelete }: { project: Project; onDelete: () => void }) {
  const statusStyles = {
    Idle: 'bg-muted text-muted-foreground',
    Training: 'bg-primary text-primary-foreground',
    Completed: 'bg-success text-success-foreground',
    Error: 'bg-destructive text-destructive-foreground',
  } as const;

  const statusStyle = statusStyles[project.status as keyof typeof statusStyles] || statusStyles.Idle;

  return (
    <Card className="p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 h-full flex flex-col group">
      <div className="flex items-start justify-between mb-4">
        <div className="h-12 w-12 rounded-lg bg-gradient-primary flex items-center justify-center">
          <FolderKanban className="h-6 w-6 text-primary-foreground" />
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusStyle}`}>
            {project.status}
          </span>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Project</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to permanently delete "{project.name}"? The project will be removed but datasets, models, and reports will be preserved. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete Project
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Link to={`/app/projects/${project.id}/overview`} className="flex-1">
        <div className="cursor-pointer">
          <h3 className="text-xl font-semibold mb-2">{project.name}</h3>
          <p className="text-sm text-muted-foreground mb-3 flex-grow">{project.description}</p>

          {project.datasetName && (
            <div className="text-xs text-muted-foreground mb-3">
              Dataset: <span className="font-medium">{project.datasetName}</span>
            </div>
          )}

          {project.progress && project.progress > 0 && (
            <div className="mb-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{project.progress}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    project.status === 'Error' ? 'bg-destructive' : 'bg-primary'
                  }`}
                  style={{ width: `${project.progress}%` }} // Dynamic width for progress bar - inline style required
                />
              </div>
            </div>
          )}

          <div className="border-t border-border pt-3 flex justify-between items-end text-xs">
            {project.keyMetric ? (
              <div>
                <span className="text-muted-foreground block">{project.keyMetric.name}:</span>
                <span className="font-semibold text-foreground">{project.keyMetric.value}</span>
              </div>
            ) : (
              <span className="text-muted-foreground">No metrics yet</span>
            )}
            <span className="text-muted-foreground">{project.lastUpdated || 'Never'}</span>
          </div>
        </div>
      </Link>
    </Card>
  );
}

function ProjectCreationModal({
  isOpen,
  onClose,
  onProjectCreated
}: {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await apiClient.createProject(name, description);
      toast.success("Project created successfully!");
      onProjectCreated();
      onClose();
      setName('');
      setDescription('');
    } catch (error) {
      console.error('Failed to create project:', error);
      toast.error("Failed to create project. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-4">Create New Project</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Project Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter project name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description (optional)"
              />
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !name.trim()}>
                {isSubmitting ? 'Creating...' : 'Create Project'}
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}
