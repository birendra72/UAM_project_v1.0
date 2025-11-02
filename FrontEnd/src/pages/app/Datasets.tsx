import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Search, Database, Eye, Trash2, CheckCircle, AlertTriangle, XCircle, Sparkles, Zap } from "lucide-react";
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

// File Type Icons Component
const FileTypeIcon = ({ fileName }: { fileName: string }) => {
  const getFileType = (name: string) => {
    if (name.endsWith('.csv')) return 'csv';
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) return 'excel';
    if (name.endsWith('.json')) return 'json';
    if (name.endsWith('.parquet')) return 'parquet';
    return 'default';
  };

  const fileType = getFileType(fileName);

  const icons = {
    csv: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400"><path d="M15 14v-2.5a2.5 2.5 0 0 0-5 0V14"/><path d="M10 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/><path d="M8 14v-2.5a2.5 2.5 0 1 0-5 0V14"/><path d="M3 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/><path d="M14 22v-4.5a2.5 2.5 0 0 0-5 0V22"/><path d="M10 17.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/><path d="M20.5 17.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/><path d="M18 14v-2.5a2.5 2.5 0 0 0-5 0V14"/></svg>,
    excel: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>,
    json: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400"><path d="M10 12.5a2.5 2.5 0 0 1-5 0V10a2.5 2.5 0 0 1 5 0Z"/><path d="M10 20a2.5 2.5 0 0 1-5 0v-2.5a2.5 2.5 0 0 1 5 0Z"/><path d="M20 12.5a2.5 2.5 0 0 1-5 0V10a2.5 2.5 0 0 1 5 0Z"/><path d="M20 20a2.5 2.5 0 0 1-5 0v-2.5a2.5 2.5 0 0 1 5 0Z"/><path d="M10 4V2.5a2.5 2.5 0 0 1 5 0V4"/><path d="M5 4a2.5 2.5 0 0 1 5 0v2.5a2.5 2.5 0 0 1-5 0Z"/></svg>,
    parquet: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-sky-400"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line></svg>,
    default: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
  };
  return icons[fileType] || icons['default'];
};

// Validation Status Badge Component
const ValidationStatusBadge = ({ status }: { status?: string }) => {
  if (!status) return null;

  const statusConfig = {
    good: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50', text: 'Valid' },
    warning: { icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-50', text: 'Issues Found' },
    critical: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50', text: 'Critical Issues' }
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.good;
  const Icon = config.icon;

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
      <Icon className="w-3 h-3" />
      {config.text}
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

  // Modal states
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
      // Auto-analyze types after upload
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

    // Simulate upload progress
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
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Your Datasets</h1>
            <p className="text-muted-foreground mt-1">Manage, upload, and preview your data sources.</p>
          </div>
        </div>

        {/* Upload Area */}
        <div
          {...getRootProps()}
          className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors duration-300 cursor-pointer ${
            isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary'
          }`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center justify-center space-y-4">
            <Upload className="w-16 h-16 text-muted-foreground" />
            <p className="text-muted-foreground">Drag & drop files here or click to browse</p>
            <Button
              type="button"
              className="gap-2"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              <Upload className="h-4 w-4" />
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
            <p className="text-xs text-muted-foreground">Supported formats: CSV, Excel, JSON, Parquet</p>
          </div>
        </div>

        {/* Upload Status & Errors */}
        {isUploading && (
          <Card className="p-4">
            <p className="font-semibold mb-2">
              {uploadStep === 'uploading' && 'Uploading...'}
              {uploadStep === 'analyzing' && 'Analyzing data types...'}
              {uploadStep === 'complete' && 'Upload complete!'}
            </p>
            <div className="w-full bg-muted rounded-full h-2.5">
              <div className="bg-primary h-2.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
            </div>
          </Card>
        )}
        {uploadError && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive p-3 rounded-lg">
            {uploadError}
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search datasets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Datasets Grid */}
        {isLoading ? (
          <div className="text-center p-8">
            <p className="text-muted-foreground">Loading datasets...</p>
          </div>
        ) : filteredDatasets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDatasets.map(dataset => (
              <Card key={dataset.id} className="p-5 border border-border hover:border-primary transition-all duration-300 flex flex-col justify-between space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-4">
                    <FileTypeIcon fileName={dataset.filename} />
                    <div>
                      <h3 className="font-bold text-lg text-foreground truncate" title={dataset.filename}>
                        {dataset.filename}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {dataset.size || 'Unknown size'}
                      </p>
                    </div>
                  </div>
                  <ValidationStatusBadge status={dataset.validation_status} />
                </div>
                <div className="text-sm text-muted-foreground flex items-center justify-between">
                  <span>Rows: <span className="font-semibold text-foreground">{dataset.rows?.toLocaleString() || 'N/A'}</span></span>
                  <span>Cols: <span className="font-semibold text-foreground">{dataset.cols || 'N/A'}</span></span>
                </div>
                {dataset.last_validated && (
                  <div className="text-xs text-muted-foreground">
                    Validated: {new Date(dataset.last_validated).toLocaleDateString()}
                  </div>
                )}
                <div className="flex items-center space-x-2 pt-3 border-t border-border/50">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2"
                    onClick={() => {
                      setSelectedDataset(dataset);
                      setShowPreviewModal(true);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                    Preview
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-destructive hover:text-destructive"
                    onClick={() => {
                      setSelectedDataset(dataset);
                      setShowDeleteModal(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center p-8 bg-muted/50 rounded-xl border border-border">
            <Database className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Datasets Found</h3>
            <p className="text-muted-foreground">Get started by uploading your first dataset using the area above.</p>
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
