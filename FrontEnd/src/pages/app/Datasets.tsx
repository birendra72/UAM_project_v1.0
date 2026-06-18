import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Search, Database, Eye, Trash2, CheckCircle, AlertTriangle, XCircle, Sparkles, Zap, Loader2, FileSpreadsheet, FileJson, FileCode, FileText } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useState, useCallback, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import DatasetPreviewModal from "@/components/DatasetPreviewModal";
import DeleteConfirmationModal from "@/components/DeleteConfirmationModal";

interface Dataset {
  id: string;
  filename: string;
  rows?: number;
  cols?: number;
  size?: string;
  uploaded_at?: string;
  validation_status?: string;
  last_validated?: string;
  columns_json?: Record<string, string>;
}

// Premium File Type Icons Component
const FileTypeIcon = ({ fileName }: { fileName: string }) => {
  const name = fileName.toLowerCase();
  
  if (name.endsWith('.csv')) {
    return (
      <div className="h-10 w-10 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
        <FileSpreadsheet className="h-5 w-5" />
      </div>
    );
  }
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    return (
      <div className="h-10 w-10 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20 flex items-center justify-center">
        <FileSpreadsheet className="h-5 w-5" />
      </div>
    );
  }
  if (name.endsWith('.json')) {
    return (
      <div className="h-10 w-10 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
        <FileJson className="h-5 w-5" />
      </div>
    );
  }
  if (name.endsWith('.parquet')) {
    return (
      <div className="h-10 w-10 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center">
        <FileCode className="h-5 w-5" />
      </div>
    );
  }
  
  return (
    <div className="h-10 w-10 rounded-lg bg-slate-500/10 text-slate-400 border border-slate-500/20 flex items-center justify-center">
      <FileText className="h-5 w-5" />
    </div>
  );
};

// Validation Status Badge Component
const ValidationStatusBadge = ({ status }: { status?: string }) => {
  if (!status) return null;

  const statusConfig = {
    good: { icon: CheckCircle, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', text: 'Valid' },
    warning: { icon: AlertTriangle, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', text: 'Warnings' },
    critical: { icon: XCircle, color: 'text-rose-400 bg-rose-500/10 border-rose-500/20', text: 'Critical' }
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.good;
  const Icon = config.icon;

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono border ${config.color}`}>
      <Icon className="w-3 h-3" />
      {config.text.toUpperCase()}
    </div>
  );
};

export default function Datasets() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStep, setUploadStep] = useState<'uploading' | 'analyzing' | 'complete'>('uploading');

  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: datasets, isLoading } = useQuery<Dataset[]>({
    queryKey: ["datasets"],
    queryFn: () => apiClient.getDatasets() as Promise<Dataset[]>
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      setUploadStep('uploading');
      const result = await apiClient.uploadDataset(file);
      setUploadStep('analyzing');
      try {
        await apiClient.analyzeDatasetTypes(result.dataset_id);
      } catch (error) {
        console.warn('Type analysis failed:', error);
      }
      setUploadStep('complete');
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["datasets"] });
      toast.success("Dataset uploaded and analyzed successfully!");
      setUploadProgress(0);
      setIsUploading(false);
      setUploadError('');
      setUploadStep('uploading');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Upload failed";
      toast.error(message);
      setIsUploading(false);
      setUploadError(message);
      setUploadStep('uploading');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (datasetId: string) => apiClient.deleteDataset(datasetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["datasets"] });
      toast.success("Dataset deleted successfully!");
      setShowDeleteModal(false);
      setSelectedDataset(null);
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Delete failed";
      toast.error(message);
      setShowDeleteModal(false);
      setSelectedDataset(null);
    }
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/json'
    ];

    if (!allowedTypes.includes(file.type) && !file.name.endsWith('.parquet')) {
      setUploadError(`Invalid file type. Please upload CSV, Excel, JSON, or Parquet files.`);
      return;
    }

    setIsUploading(true);
    setUploadError('');
    setUploadProgress(0);

    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval);
          return prev;
        }
        return prev + Math.random() * 20;
      });
    }, 200);

    uploadMutation.mutate(file);
  }, [uploadMutation]);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/json': ['.json'],
      'application/octet-stream': ['.parquet']
    },
    multiple: false,
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false)
  });

  const filteredDatasets = (datasets as Dataset[])?.filter(dataset =>
    dataset.filename.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in text-slate-100 font-body">
        
        {/* Header */}
        <div className="border-b border-slate-900 pb-5">
          <h1 className="text-2xl font-extrabold tracking-tight font-display bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">
            Data Registry
          </h1>
          <p className="text-xs text-slate-400 font-body mt-0.5">Manage, upload, and validate your AutoML project files</p>
        </div>

        {/* Upload Area */}
        <Card className="p-6 bg-slate-950/40 border border-slate-900 backdrop-blur-sm">
          <div
            {...getRootProps()}
            className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors duration-300 cursor-pointer ${
              isDragging ? 'border-violet-500 bg-violet-500/5' : 'border-slate-800 hover:border-violet-500/30 bg-slate-950/20'
            }`}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center justify-center space-y-4">
              <Upload className="w-10 h-10 text-slate-500" />
              <div>
                <p className="text-sm font-semibold text-slate-300">Drag & drop files here or click to browse</p>
                <p className="text-xs text-slate-500 mt-1">Supported formats: CSV, Excel, JSON, Parquet</p>
              </div>
              <Button
                type="button"
                className="h-8 text-xs bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-slate-100"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
              >
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                Browse Files
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".csv,.xlsx,.xls,.json,.parquet"
                aria-label="Upload dataset file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    onDrop([file]);
                  }
                }}
              />
            </div>
          </div>
        </Card>

        {/* Upload Status & Errors */}
        {isUploading && (
          <Card className="p-4 bg-slate-950/40 border border-slate-900 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-mono text-slate-400">
                {uploadStep === 'uploading' && '📦 Uploading file contents...'}
                {uploadStep === 'analyzing' && '⚡ Pre-calculating column features...'}
                {uploadStep === 'complete' && '✓ Completed!'}
              </p>
              <span className="text-xs font-bold font-mono text-violet-400">{Math.round(uploadProgress)}%</span>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-1.5 border border-slate-950">
              <div className="bg-violet-600 h-1.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
            </div>
          </Card>
        )}
        {uploadError && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-lg text-xs font-mono">
            ⚠ {uploadError}
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Search dataset repository..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-slate-950/40 border-slate-900 text-slate-300 placeholder:text-slate-600 text-xs h-9 focus:border-violet-500/50"
          />
        </div>

        {/* Datasets Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-violet-400" />
            <p className="text-xs text-slate-500 font-mono mt-2">Loading catalog...</p>
          </div>
        ) : filteredDatasets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDatasets.map(dataset => (
              <Card key={dataset.id} className="p-5 bg-slate-950/40 border border-slate-900 backdrop-blur-sm hover:border-slate-800 transition-all duration-300 flex flex-col justify-between space-y-4 rounded-xl">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <FileTypeIcon fileName={dataset.filename} />
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm text-slate-200 truncate max-w-[150px]" title={dataset.filename}>
                        {dataset.filename}
                      </h3>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {dataset.size || 'Unknown size'}
                      </p>
                    </div>
                  </div>
                  <ValidationStatusBadge status={dataset.validation_status} />
                </div>
                
                <div className="text-xs text-slate-400 flex items-center justify-between font-mono">
                  <span>Rows: <span className="font-bold text-slate-200 font-body">{dataset.rows?.toLocaleString() || 'N/A'}</span></span>
                  <span>Cols: <span className="font-bold text-slate-200 font-body">{dataset.cols || 'N/A'}</span></span>
                </div>
                
                {dataset.last_validated && (
                  <div className="text-[10px] text-slate-600 font-mono">
                    Validated: {new Date(dataset.last_validated).toLocaleDateString()}
                  </div>
                )}
                
                <div className="flex items-center space-x-2 pt-3 border-t border-slate-900/60">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 text-xs border-slate-800 bg-slate-950 text-slate-300 hover:text-slate-100 hover:bg-slate-900"
                    onClick={() => {
                      setSelectedDataset(dataset);
                      setShowPreviewModal(true);
                    }}
                  >
                    <Eye className="h-3.5 w-3.5 mr-1.5" />
                    Preview
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs border-slate-800 bg-slate-950 text-rose-400 hover:text-rose-300 hover:bg-rose-950/20"
                    onClick={() => {
                      setSelectedDataset(dataset);
                      setShowDeleteModal(true);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 border border-dashed border-slate-900 rounded-xl bg-slate-950/10">
            <Database className="w-10 h-10 text-slate-700 mx-auto mb-2 opacity-50" />
            <h3 className="text-sm font-semibold text-slate-400">No Datasets Found</h3>
            <p className="text-xs text-slate-500">Registry is empty. Drop files to upload.</p>
          </div>
        )}

        {/* Modals */}
        <DatasetPreviewModal
          isOpen={showPreviewModal}
          onClose={() => setShowPreviewModal(false)}
          dataset={selectedDataset}
        />
        <DeleteConfirmationModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={() => deleteMutation.mutate(selectedDataset!.id)}
          datasetName={selectedDataset?.filename || ''}
        />
      </div>
    </AppLayout>
  );
}
