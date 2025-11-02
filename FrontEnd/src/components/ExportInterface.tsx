import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Download, FileText, BarChart3, Loader2, AlertCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

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
    includes_eda: boolean;
    includes_models: boolean;
    generated_at: string;
  };
}

export default function ExportInterface({ projectId }: ExportInterfaceProps) {
  const [includeEDA, setIncludeEDA] = useState(true);
  const [includeModels, setIncludeModels] = useState(true);
  const [format, setFormat] = useState<'pdf' | 'html'>('pdf');
  const queryClient = useQueryClient();

  const { data: reports, isLoading: reportsLoading } = useQuery<Report[]>({
    queryKey: ['project-reports', projectId],
    queryFn: () => apiClient.getProjectReports(projectId),
  });

  const generateReportMutation = useMutation({
    mutationFn: ({ includeEDA, includeModels, format }: {
      includeEDA: boolean;
      includeModels: boolean;
      format: string;
    }) => apiClient.generateProjectReport(projectId, includeEDA, includeModels, format),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['project-reports', projectId] });
      toast.success('Report generated successfully!');
      // Trigger download
      handleDownload(data.report_key, data.format);
    },
    onError: (error) => {
      console.error('Report generation failed:', error);
      toast.error('Failed to generate report. Please try again.');
    },
  });

  const handleGenerateReport = () => {
    generateReportMutation.mutate({
      includeEDA,
      includeModels,
      format,
    });
  };

  const handleDownload = async (reportKey: string, format: string) => {
    try {
      const response = await apiClient.getReportDownloadUrl(reportKey);
      // Create download link
      const link = document.createElement('a');
      link.href = response.download_url;
      link.download = response.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Failed to download report.');
    }
  };

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
            onClick={handleGenerateReport}
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
                <BarChart3 className="h-4 w-4 mr-2" />
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

      {/* Previous Reports */}
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
          <div className="space-y-3">
            {reports.map((report) => (
              <div
                key={report.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <FileText className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-medium">{report.filename}</p>
                    <p className="text-sm text-muted-foreground">
                      Generated {formatDate(report.metadata.generated_at)}
                    </p>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-xs bg-muted px-2 py-1 rounded">
                        {report.metadata.format.toUpperCase()}
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(report.storage_key, report.metadata.format)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No reports generated yet.</p>
            <p className="text-sm">Generate your first report above to get started.</p>
          </div>
        )}
      </Card>

      {/* Export Options */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Additional Export Options</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <Button variant="outline" className="h-20 flex-col">
            <FileText className="h-6 w-6 mb-2" />
            <span className="text-sm">Export Dataset</span>
            <span className="text-xs text-muted-foreground">CSV, JSON formats</span>
          </Button>
          <Button variant="outline" className="h-20 flex-col">
            <BarChart3 className="h-6 w-6 mb-2" />
            <span className="text-sm">Export Visualizations</span>
            <span className="text-xs text-muted-foreground">PNG, SVG formats</span>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-4 text-center">
          Additional export features coming soon...
        </p>
      </Card>
    </div>
  );
}
