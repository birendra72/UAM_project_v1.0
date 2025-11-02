import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FileText, Download } from "lucide-react";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import { useParams } from "react-router-dom";

interface ReportGeneratorProps {
  projectId?: string;
}

export default function ReportGenerator({ projectId }: ReportGeneratorProps) {
  const { projectId: routeProjectId } = useParams();
  const currentProjectId = projectId || routeProjectId;

  const [includeEDA, setIncludeEDA] = useState(true);
  const [includeModels, setIncludeModels] = useState(true);
  const [format, setFormat] = useState("pdf");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<any>(null);

  const handleGenerateReport = async () => {
    if (!currentProjectId) {
      toast.error("Project ID not found");
      return;
    }

    setIsGenerating(true);
    try {
      const response = await apiClient.generateProjectReport(
        currentProjectId,
        includeEDA,
        includeModels,
        format
      );

      setGeneratedReport(response);
      toast.success("Report generated successfully!");
    } catch (error) {
      console.error("Failed to generate report:", error);
      toast.error("Failed to generate report. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadReport = async () => {
    if (!generatedReport) return;

    try {
      const downloadResponse = await apiClient.getReportDownloadUrl(generatedReport.artifact_id);

      // Create download link
      const link = document.createElement('a');
      link.href = `/api/files/${downloadResponse.download_url}`;
      link.download = downloadResponse.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Report download started!");
    } catch (error) {
      console.error("Failed to download report:", error);
      toast.error("Failed to download report. Please try again.");
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-primary" />
          <h3 className="text-lg font-semibold">Generate Project Report</h3>
        </div>

        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="include-eda"
              checked={includeEDA}
              onCheckedChange={setIncludeEDA}
            />
            <label
              htmlFor="include-eda"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Include Exploratory Data Analysis (EDA) results
            </label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="include-models"
              checked={includeModels}
              onCheckedChange={setIncludeModels}
            />
            <label
              htmlFor="include-models"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Include Model Training Results
            </label>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Report Format</label>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF Document</SelectItem>
                <SelectItem value="html">HTML Web Page</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={handleGenerateReport}
            disabled={isGenerating || (!includeEDA && !includeModels)}
            className="flex-1"
          >
            {isGenerating ? (
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

          {generatedReport && (
            <Button
              onClick={handleDownloadReport}
              variant="outline"
              className="flex-1"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Report
            </Button>
          )}
        </div>

        {generatedReport && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-green-800">
              <FileText className="h-5 w-5" />
              <span className="font-medium">Report Generated Successfully!</span>
            </div>
            <p className="text-sm text-green-700 mt-1">
              Format: {generatedReport.format.toUpperCase()} •
              Generated at: {new Date().toLocaleString()}
            </p>
          </div>
        )}

        {(!includeEDA && !includeModels) && (
          <p className="text-sm text-muted-foreground">
            Please select at least one content type to include in the report.
          </p>
        )}
      </div>
    </Card>
  );
}
