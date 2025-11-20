import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Download, FileText, Loader2, AlertCircle, Database, TrendingUp, Eye } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import ReportPreview from './ReportPreview';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import PredictionSummaryCards from './PredictionSummaryCards';
interface ExportInterfaceProps {
  projectId: string;
}

interface Report {
  id: string;
  filename: string;
  storage_key: string;
  created_at: string;
  metadata: {
    format: string;
    includes_eda?: boolean;
    includes_models?: boolean;
    generated_at: string;
    type: string;
  };
}

export default function ExportInterface({ projectId }: ExportInterfaceProps) {
  const [includeEDA, setIncludeEDA] = useState(true);
  const [includeModels, setIncludeModels] = useState(true);
  const [format, setFormat] = useState<'pdf' | 'html'>('pdf');
  const [selectedDataset, setSelectedDataset] = useState<string>('');
  const [datasetFormat, setDatasetFormat] = useState<'csv' | 'json'>('csv');
  const [projectFormat, setProjectFormat] = useState<'json' | 'zip'>('json');
  const [summaryFormat, setSummaryFormat] = useState<'pdf' | 'html'>('pdf');
  const [previewReport, setPreviewReport] = useState<Report | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<Report | null>(null);
  const queryClient = useQueryClient();

  const { data: reports, isLoading: reportsLoading } = useQuery({
    queryKey: ['project-reports', projectId],
    queryFn: () => apiClient.getProjectReports(projectId),
  });

  const { data: datasets } = useQuery({
    queryKey: ['project-datasets', projectId],
    queryFn: () => apiClient.getProjectDatasets(projectId),
  });

  const { data: predictionSummary } = useQuery({
    queryKey: ['prediction-summary', projectId],
    queryFn: () => apiClient.getPredictionSummary(projectId),
  });

  const generateReportMutation = useMutation({
    mutationFn: async () => {
      const result = await apiClient.generateProjectReport(projectId, includeEDA, includeModels, format);
      return result;
    },
    onSuccess: (result) => {
      toast.success('Report generated successfully!');
      queryClient.invalidateQueries({ queryKey: ['project-reports', projectId] });
      // Auto-preview the newly generated report
      if (result.artifact_id) {
        const newReport: Report = {
          id: result.artifact_id,
          filename: `report_${result.artifact_id}.${result.format}`,
          storage_key: result.report_key,
          created_at: new Date().toISOString(),
          metadata: {
            format: result.format,
            includes_eda: includeEDA,
            includes_models: includeModels,
            generated_at: new Date().toISOString(),
            type: "main"
          }
        };
        setPreviewReport(newReport);
      }
    },
    onError: (error) => {
      console.error('Report generation failed:', error);
      toast.error('Failed to generate report');
    },
  });

  const exportDatasetMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDataset) {
        throw new Error('Please select a dataset');
      }
      await apiClient.exportDataset(selectedDataset, datasetFormat);
    },
    onSuccess: () => {
      toast.success('Dataset exported successfully!');
    },
    onError: (error) => {
      console.error('Dataset export failed:', error);
      toast.error('Failed to export dataset');
    },
  });

  const exportProjectMutation = useMutation({
    mutationFn: async () => {
      const result = await apiClient.getProjectExportUrl(projectId, projectFormat);
      // Create download link
      const link = document.createElement('a');
      link.href = result.download_url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    onSuccess: () => {
      toast.success('Project exported successfully!');
    },
    onError: (error) => {
      console.error('Project export failed:', error);
      toast.error('Failed to export project');
    },
  });

  const deleteReportMutation = useMutation({
    mutationFn: async (reportId: string) => {
      await apiClient.deleteReport(reportId);
    },
    onSuccess: () => {
      toast.success('Report deleted successfully!');
      queryClient.invalidateQueries({ queryKey: ['project-reports', projectId] });
      setDeleteModalOpen(false);
      setReportToDelete(null);
    },
    onError: (error) => {
      console.error('Delete failed:', error);
      toast.error('Failed to delete report');
    },
  });

  const generatePredictionSummaryMutation = useMutation({
    mutationFn: async () => {
      const result = await apiClient.exportPredictionSummary(projectId, summaryFormat);
      return result;
    },
    onSuccess: (result) => {
      toast.success('Prediction Summary Report generated successfully!');
      queryClient.invalidateQueries({ queryKey: ['project-reports', projectId] });
      // Auto-preview the newly generated report
      if (result.artifact_id) {
        const newReport: Report = {
          id: result.artifact_id,
          filename: `prediction_summary_${result.artifact_id}.${result.format}`,
          storage_key: result.report_key,
          created_at: new Date().toISOString(),
          metadata: {
            format: result.format,
            generated_at: new Date().toISOString(),
            type: "summary"
          }
        };
        setPreviewReport(newReport);
      }
    },
    onError: (error) => {
      console.error('Prediction Summary generation failed:', error);
      toast.error('Failed to generate Prediction Summary Report');
    },
  });

  // ... (Inside ExportInterface component)
// REMOVE the entire old handleDownload function and replace it with this:

const handleDownload = async (reportId: string, format: string) => {
    try {
        // Use the new, safer API client method
        const { blob, filename } = await apiClient.downloadReportFile(reportId);

        // Standard browser download logic
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        toast.success('Report downloaded successfully!');
    } catch (error) {
        // Error handling now catches the detailed message thrown by apiClient.downloadReportFile
        console.error('Download failed:', error);
        toast.error(`Failed to download report. Check console for details.`);
    }
};

// ... (Also fix the ReportPreview Modal to use the new method)

// Check the ReportPreview component file and ensure its internal logic 
// uses the new apiClient.getReportPreviewContent(artifactId) method.
// It should handle both PDF (Blob) and HTML (string) responses.

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Generate New Report */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <FileText className="h-5 w-5 mr-2" />
          Generate New Report
        </h3>

        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Report Content</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-eda"
                    checked={includeEDA}
                    onCheckedChange={(checked) => setIncludeEDA(checked as boolean)}
                  />
                  <Label htmlFor="include-eda" className="text-sm">
                    Include Exploratory Data Analysis
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-models"
                    checked={includeModels}
                    onCheckedChange={(checked) => setIncludeModels(checked as boolean)}
                  />
                  <Label htmlFor="include-models" className="text-sm">
                    Include Model Results
                  </Label>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">Export Format</Label>
              <Select value={format} onValueChange={(value: 'pdf' | 'html') => setFormat(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF Document</SelectItem>
                  <SelectItem value="html">HTML Webpage</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={() => generateReportMutation.mutate()}
            disabled={generateReportMutation.isPending || (!includeEDA && !includeModels)}
            className="w-full"
          >
            {generateReportMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Report...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Generate Report
              </>
            )}
          </Button>

          {(!includeEDA && !includeModels) && (
            <p className="text-sm text-muted-foreground text-center">
              Please select at least one content type to include in the report.
            </p>
          )}
        </div>
      </Card>
      {/* Generate Prediction Summary Report */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <TrendingUp className="h-5 w-5 mr-2" />
          Generate Prediction Summary Report
        </h3>

        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Report Format</Label>
              <Select value={summaryFormat} onValueChange={(value: 'pdf' | 'html') => setSummaryFormat(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF Document</SelectItem>
                  <SelectItem value="html">HTML Webpage</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={() => generatePredictionSummaryMutation.mutate()}
            disabled={generatePredictionSummaryMutation.isPending}
            className="w-full"
          >
            {generatePredictionSummaryMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Prediction Summary Report...
              </>
            ) : (
              <>
                <TrendingUp className="h-4 w-4 mr-2" />
                Generate Prediction Summary Report
              </>
            )}
          </Button>
        </div>

        {/* Prediction Summary Cards */}
        {predictionSummary && predictionSummary.total_predictions > 0 && (
          <div className="mt-6">
            <PredictionSummaryCards summary={predictionSummary} />
          </div>
        )}
      </Card>

      {/* Dataset Export */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Database className="h-5 w-5 mr-2" />
          Export Dataset
        </h3>

        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Select Dataset</Label>
              <Select value={selectedDataset} onValueChange={setSelectedDataset}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a dataset..." />
                </SelectTrigger>
                <SelectContent>
                  {datasets?.map((dataset) => (
                    <SelectItem key={dataset.id} value={dataset.id}>
                      {dataset.filename}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">Export Format</Label>
              <Select value={datasetFormat} onValueChange={(value: 'csv' | 'json') => setDatasetFormat(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV Format</SelectItem>
                  <SelectItem value="json">JSON Format</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={() => exportDatasetMutation.mutate()}
            disabled={exportDatasetMutation.isPending || !selectedDataset}
            className="w-full"
            variant="outline"
          >
            {exportDatasetMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting Dataset...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export Dataset
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Project Export */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Download className="h-5 w-5 mr-2" />
          Export Project
        </h3>

        <div className="space-y-4">
          <div className="space-y-3">
            <Label className="text-sm font-medium">Export Format</Label>
            <Select value={projectFormat} onValueChange={(value: 'json' | 'zip') => setProjectFormat(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="json">JSON Format</SelectItem>
                <SelectItem value="zip">ZIP Archive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={() => exportProjectMutation.mutate()}
            disabled={exportProjectMutation.isPending}
            className="w-full"
            variant="outline"
          >
            {exportProjectMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting Project...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export Project
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Previous Reports*/}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Download className="h-5 w-5 mr-2" />
          Previous Reports
        </h3>

        {reportsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Loading reports...</span>
          </div>
        ) : reports && reports.length > 0 ? (
          <div className="space-y-6">
            {/* Main Reports Section */}
            {reports.filter(report => report.metadata.type === 'main').length > 0 && (
              <div>
                <h4 className="text-md font-medium mb-3 flex items-center">
                  <FileText className="h-4 w-4 mr-2" />
                  Main Reports
                </h4>
                <div className="space-y-3">
                  {reports.filter(report => report.metadata.type === 'main').map((report) => (
                    <div
                      key={report.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <FileText className="h-8 w-8 text-primary" />
                        <div>
                          <p className="font-medium">{report.filename}</p>
                          <p className="text-sm text-muted-foreground">
                            Generated {formatDate(report.metadata.generated_at as string)}
                          </p>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className="text-xs bg-muted px-2 py-1 rounded">
                              {(report.metadata.format as string).toUpperCase()}
                            </span>
                            {report.metadata.includes_eda && (
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                EDA
                              </span>
                            )}
                            {report.metadata.includes_models && (
                              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                Models
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPreviewReport(report)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Preview
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(report.id, report.metadata.format as string)}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setReportToDelete(report);
                            setDeleteModalOpen(true);
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Prediction Summary Reports Section */}
            <div>
              <h4 className="text-md font-medium mb-3 flex items-center">
                <TrendingUp className="h-4 w-4 mr-2" />
                Prediction Summary Reports
              </h4>
              {reports.filter(report => report.metadata.type === 'summary').length > 0 ? (
                <div className="space-y-3">
                  {reports.filter(report => report.metadata.type === 'summary').map((report) => (
                    <div
                      key={report.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <TrendingUp className="h-8 w-8 text-green-600" />
                        <div>
                          <p className="font-medium">{report.filename}</p>
                          <p className="text-sm text-muted-foreground">
                            Generated {formatDate(report.metadata.generated_at as string)}
                          </p>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className="text-xs bg-muted px-2 py-1 rounded">
                              {(report.metadata.format as string).toUpperCase()}
                            </span>
                            <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                              Summary
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPreviewReport(report)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Preview
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(report.id, report.metadata.format as string)}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setReportToDelete(report);
                            setDeleteModalOpen(true);
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No prediction summary reports generated yet.</p>
                  <p className="text-sm">Generate your first prediction summary report above.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No reports generated yet.</p>
            <p className="text-sm">Generate your first report above to get started.</p>
          </div>
        )}
      </Card>

      {/* Report Preview Modal */}
      {previewReport && (
        <ReportPreview
          isOpen={!!previewReport}
          onClose={() => setPreviewReport(null)}
          artifactId={previewReport.id}
          filename={previewReport.filename}
          format={previewReport.metadata.format}
          onDownload={() => {
            handleDownload(previewReport.id, previewReport.metadata.format);
            setPreviewReport(null);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && reportToDelete && (
        <DeleteConfirmationModal
          isOpen={deleteModalOpen}
          onClose={() => {
            setDeleteModalOpen(false);
            setReportToDelete(null);
          }}
          onConfirm={() => deleteReportMutation.mutate(reportToDelete.id)}
          itemName={reportToDelete.filename}
          itemType="report"
        />
      )}
    </div>
  );
}
