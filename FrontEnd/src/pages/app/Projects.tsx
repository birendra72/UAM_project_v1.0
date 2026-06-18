import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Search, FolderKanban, BarChart3, Database, Zap, CheckCircle, TrendingUp, Trash2, Upload, Loader2, ArrowRight } from "lucide-react";
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
  const [isCreateModalOpen, setCreateModalOpen] = useState(() => {
    return new URLSearchParams(window.location.search).get("create") === "true";
  });
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
      <div className="space-y-6 animate-fade-in text-slate-100 font-body">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-900 pb-5">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight font-display bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">
              Projects Hub
            </h1>
            <p className="text-xs text-slate-400 font-body mt-0.5">Create, configure, and monitor automated analysis pipelines</p>
          </div>
          <Button 
            onClick={() => setCreateModalOpen(true)} 
            className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-xs h-9 shadow-glow border border-violet-500/30"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Create Project
          </Button>
        </div>

        {/* Portfolio Stats Row */}
        <Card className="p-6 bg-slate-950/40 border border-slate-900 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-violet-400" />
            <h3 className="font-display font-bold text-slate-300 text-xs uppercase tracking-wider">Portfolio Overview</h3>
          </div>
          
          {statsLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 bg-slate-900/40 border border-slate-900 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard
                title="Active Projects"
                value={stats?.activeProjects || 0}
                icon={<FolderKanban className="h-4 w-4" />}
                barColor="bg-violet-500/50"
              />
              <StatCard
                title="Datasets Used"
                value={stats?.datasetsUsed || 0}
                icon={<Database className="h-4 w-4" />}
                barColor="bg-cyan-500/50"
              />
              <StatCard
                title="Models Training"
                value={stats?.modelsTraining || 0}
                icon={<Zap className="h-4 w-4" />}
                barColor="bg-amber-500/50"
              />
              <StatCard
                title="Avg. Data Quality"
                value={stats?.avgDataQuality || 'N/A'}
                icon={<CheckCircle className="h-4 w-4" />}
                barColor="bg-emerald-500/50"
              />
              <StatCard
                title="Top Model Type"
                value={stats?.topModelType || 'N/A'}
                icon={<TrendingUp className="h-4 w-4" />}
                barColor="bg-pink-500/50"
              />
            </div>
          )}
        </Card>

        {/* Filter / Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Search projects by name..."
            className="pl-9 bg-slate-950/40 border-slate-900 text-slate-300 placeholder:text-slate-600 text-xs h-9 focus:border-violet-500/50"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* File Dropzone Uploader */}
        <Card className="p-6 bg-slate-950/40 border border-slate-900 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-4">
            <Upload className="h-4 w-4 text-violet-400" />
            <h3 className="font-display font-bold text-slate-200 text-xs">Direct Dataset Upload</h3>
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
            <Upload className="h-8 w-8 mx-auto mb-3 text-slate-500" />
            {isDragActive ? (
              <p className="text-xs font-semibold text-violet-400">Drop the dataset file here...</p>
            ) : (
              <div>
                <p className="text-xs font-semibold text-slate-300">Drag & drop dataset file here</p>
                <p className="text-[10px] text-slate-500 mt-1">
                  Supports CSV, Excel, JSON, Parquet (Will create a project draft automatically)
                </p>
              </div>
            )}
          </div>
          {uploadMutation.isPending && (
            <div className="mt-4 flex items-center justify-center gap-2 bg-slate-900/50 p-2 rounded-lg border border-slate-800">
              <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
              <p className="text-xs text-slate-400 font-mono">Uploading catalog...</p>
            </div>
          )}
        </Card>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projectsLoading ? (
            <div className="col-span-full py-12 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-violet-400" />
              <p className="text-xs text-slate-500 font-mono mt-2">Loading active projects...</p>
            </div>
          ) : filteredProjects.length === 0 ? (
            <Card className="col-span-full p-12 text-center border border-dashed border-slate-900 bg-slate-950/10">
              <FolderKanban className="h-10 w-10 text-slate-700 mx-auto mb-2 opacity-50" />
              <h3 className="text-sm font-semibold text-slate-400">No Projects Found</h3>
              <p className="text-xs text-slate-500">Configure your first AutoML run to catalog.</p>
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

        {/* Create Project Modal */}
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

function StatCard({ title, value, icon, barColor }: { title: string; value: number | string; icon: React.ReactNode; barColor: string }) {
  return (
    <Card className="p-4 bg-slate-950/40 border border-slate-900 hover:border-slate-800 transition-all duration-300 relative overflow-hidden group">
      <div className={`absolute top-0 left-0 w-1 h-full ${barColor}`} />
      <div className="flex items-center justify-between">
        <div className="text-left min-w-0">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider truncate">{title}</p>
          <p className="text-lg font-bold font-display text-slate-200 mt-1 truncate">{value}</p>
        </div>
        <div className="h-8 w-8 rounded-lg bg-slate-900 text-violet-400 flex items-center justify-center border border-slate-800 shrink-0">
          {icon}
        </div>
      </div>
    </Card>
  );
}

function ProjectCard({ project, onDelete }: { project: Project; onDelete: () => void }) {
  const statusStyles = {
    Idle: 'bg-slate-900 text-slate-400 border-slate-800',
    Training: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    Completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    Error: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  } as const;

  const statusStyle = statusStyles[project.status as keyof typeof statusStyles] || statusStyles.Idle;

  return (
    <Card className="p-5 bg-slate-950/40 border border-slate-900 hover:border-slate-800 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 h-full flex flex-col group rounded-xl">
      <div className="flex items-start justify-between mb-4">
        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-violet-600/20 to-indigo-600/20 text-violet-400 border border-violet-500/20 flex items-center justify-center">
          <FolderKanban className="h-5 w-5" />
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded border ${statusStyle}`}>
            {(project.status || 'IDLE').toUpperCase()}
          </span>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-slate-950 border border-slate-900 text-slate-200">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-display font-bold">Delete Project Draft?</AlertDialogTitle>
                <AlertDialogDescription className="text-xs text-slate-400 leading-relaxed font-body">
                  This action will delete "{project.name}". The related dataset, models, and export indexes will remain preserved in raw database files, but the project folder will be unmapped.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete} className="bg-rose-600 hover:bg-rose-500 text-white font-semibold">
                  Delete Project
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Link to={`/app/projects/${project.id}/overview`} className="flex-1 flex flex-col justify-between">
        <div>
          <h3 className="font-bold text-sm text-slate-200 group-hover:text-violet-400 transition-colors flex items-center gap-1.5">
            {project.name}
            <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-violet-400" />
          </h3>
          <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">{project.description || 'No description provided.'}</p>

          {project.datasetName && (
            <div className="text-[10px] text-slate-400 font-mono mt-3 flex items-center gap-1.5">
              <span className="text-slate-600 uppercase">Dataset:</span>
              <span className="truncate max-w-[150px]">{project.datasetName}</span>
            </div>
          )}

          {project.progress && project.progress > 0 && (
            <div className="mt-3">
              <div className="flex justify-between text-[10px] mb-1 font-mono">
                <span className="text-slate-500">RUNNING TASK</span>
                <span className="font-bold text-violet-400">{project.progress}%</span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-1 border border-slate-950">
                <div
                  className={`h-1 rounded-full transition-all duration-300 ${
                    project.status === 'Error' ? 'bg-rose-500' : 'bg-violet-600'
                  }`}
                  style={{ width: `${project.progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-slate-900/80 pt-3 mt-4 flex justify-between items-center text-[10px] font-mono text-slate-500">
          {project.keyMetric ? (
            <div>
              <span className="text-slate-600 block uppercase tracking-wider">{project.keyMetric.name}:</span>
              <span className="font-bold text-slate-300">{project.keyMetric.value}</span>
            </div>
          ) : (
            <span className="text-slate-600 uppercase">No active run metrics</span>
          )}
          <span>{project.lastUpdated || 'Never'}</span>
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <Card className="w-full max-w-md bg-slate-950 border border-slate-900 p-6 rounded-xl shadow-2xl">
        <h2 className="text-lg font-bold font-display text-slate-200 mb-4">Create AutoML Project</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Project Title</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. churn-predictor-v1"
              className="bg-slate-900 border-slate-800 text-slate-300 text-xs h-9 focus:border-violet-500/50"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Description</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Target metrics and models context details"
              className="bg-slate-900 border-slate-800 text-slate-300 text-xs h-9 focus:border-violet-500/50"
            />
          </div>
          <div className="flex justify-end space-x-2 pt-4 border-t border-slate-900/60">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              className="h-8 text-xs border-slate-800 bg-slate-950 text-slate-300 hover:text-slate-100 hover:bg-slate-900"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || !name.trim()}
              className="h-8 text-xs bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold shadow-glow border border-violet-500/30"
            >
              {isSubmitting ? 'Initializing...' : 'Create Project'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
