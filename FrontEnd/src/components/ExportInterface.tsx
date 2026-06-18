import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Download, FileText, BarChart3, Loader2, AlertCircle, Sparkles, FileDown, CheckCircle2 } from 'lucide-react';
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
      <Card className="p-6 bg-slate-950/40 border border-slate-900 backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-5 w-5 text-violet-400" />
          <h3 className="font-display font-bold text-slate-200 text-base">Generate Project Summary Report</h3>
        </div>

        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Report Sections</Label>
              <div className="space-y-3 bg-slate-900/40 border border-slate-900 p-4 rounded-xl">
                <div className="flex items-center space-x-2.5">
                  <Checkbox
                    id="include-eda"
                    checked={includeEDA}
                    onCheckedChange={(checked) => setIncludeEDA(checked as boolean)}
                    className="border-slate-700 data-[state=checked]:bg-violet-600"
                  />
                  <Label htmlFor="include-eda" className="text-xs text-slate-300 font-semibold cursor-pointer">
                    Exploratory Data Analysis (EDA) Insight Cards
                  </Label>
                </div>
                <div className="flex items-center space-x-2.5">
                  <Checkbox
                    id="include-models"
                    checked={includeModels}
                    onCheckedChange={(checked) => setIncludeModels(checked as boolean)}
                    className="border-slate-700 data-[state=checked]:bg-violet-600"
                  />
                  <Label htmlFor="include-models" className="text-xs text-slate-300 font-semibold cursor-pointer">
                    AutoML Models Comparison & Benchmarks
                  </Label>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Document Format</Label>
              <div className="space-y-2">
                <Select value={format} onValueChange={(value: 'pdf' | 'html') => setFormat(value)}>
                  <SelectTrigger className="w-full bg-slate-900 border-slate-800 text-slate-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-300">
                    <SelectItem value="pdf" className="hover:bg-slate-800">Portable Document Format (PDF)</SelectItem>
                    <SelectItem value="html" className="hover:bg-slate-800">Branded Webpage Report (HTML)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-slate-500 font-body">PDF format includes formatted static chart prints.</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              onClick={handleGenerateReport}
              disabled={generateReportMutation.isPending || (!includeEDA && !includeModels)}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold shadow-glow border border-violet-500/30"
            >
              {generateReportMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Compiling Report...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Report
                </>
              )}
            </Button>
          </div>

          {(!includeEDA && !includeModels) && (
            <p className="text-xs text-rose-400 text-center font-mono mt-2 bg-rose-500/5 p-2 rounded-lg border border-rose-500/10">
              ⚠ Select at least one section checkbox to compile a report
            </p>
          )}
        </div>
      </Card>

      {/* Previous Reports */}
      <Card className="p-6 bg-slate-950/40 border border-slate-900 backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-4">
          <FileDown className="h-5 w-5 text-cyan-400" />
          <h3 className="font-display font-bold text-slate-200 text-base">Completed Exports History</h3>
        </div>

        {reportsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2 text-cyan-400" />
            <span className="font-body text-slate-300 text-xs">Loading reports history...</span>
          </div>
        ) : reports && reports.length > 0 ? (
          <div className="space-y-3">
            {reports.map((report) => (
              <div
                key={report.id}
                className="flex items-center justify-between p-4 border border-slate-900 bg-slate-950/20 hover:border-slate-800 transition-colors rounded-xl"
              >
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 bg-slate-900 text-violet-400 flex items-center justify-center rounded-lg border border-slate-800">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-200">{report.filename}</p>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      Compiled: {formatDate(report.metadata.generated_at)}
                    </p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-slate-900 text-slate-400 border border-slate-800">
                        {report.metadata.format.toUpperCase()}
                      </span>
                      {report.metadata.includes_eda && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          EDA
                        </span>
                      )}
                      {report.metadata.includes_models && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          MODELS
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs border-slate-800 bg-slate-950 text-slate-300 hover:text-slate-100 hover:bg-slate-900"
                  onClick={() => handleDownload(report.storage_key, report.metadata.format)}
                >
                  <Download className="h-3.5 w-3.5 mr-2" />
                  Download
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 border border-dashed border-slate-900 rounded-xl">
            <AlertCircle className="h-10 w-10 mx-auto mb-2 opacity-40 text-slate-600" />
            <p className="text-sm text-slate-400">No reports compiled yet</p>
          </div>
        )}
      </Card>

      {/* Export Options */}
      <Card className="p-6 bg-slate-950/40 border border-slate-900 backdrop-blur-sm">
        <h3 className="font-display font-bold text-slate-200 text-base mb-4">Additional Core Exports</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <Button variant="outline" className="h-20 flex-col border-slate-900 bg-slate-950/20 text-slate-300 hover:bg-slate-900 hover:border-slate-800 rounded-xl">
            <FileText className="h-5 w-5 mb-2 text-amber-400" />
            <span className="text-xs font-bold">Export Cleaned Dataset</span>
            <span className="text-[10px] text-slate-500 font-mono mt-0.5">CSV / JSON formats</span>
          </Button>
          <Button variant="outline" className="h-20 flex-col border-slate-900 bg-slate-950/20 text-slate-300 hover:bg-slate-900 hover:border-slate-800 rounded-xl">
            <BarChart3 className="h-5 w-5 mb-2 text-cyan-400" />
            <span className="text-xs font-bold">Export Canvas Images</span>
            <span className="text-[10px] text-slate-500 font-mono mt-0.5">High-res PNG / SVG plots</span>
          </Button>
        </div>
      </Card>
    </div>
  );
}
