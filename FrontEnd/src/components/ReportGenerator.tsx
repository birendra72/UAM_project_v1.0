import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, FileText, Download, Palette } from "lucide-react";
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
  const [companyName, setCompanyName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#1e3a8a");
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
        format,
        companyName || undefined,
        primaryColor
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
    <Card className="p-6 bg-slate-950/40 border border-slate-900 backdrop-blur-sm">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-violet-400" />
          <h3 className="text-lg font-semibold text-slate-200 font-display">Generate Project Report</h3>
        </div>

        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="include-eda"
              checked={includeEDA}
              onCheckedChange={(checked) => setIncludeEDA(!!checked)}
              className="border-slate-700 data-[state=checked]:bg-violet-500 data-[state=checked]:text-white"
            />
            <label
              htmlFor="include-eda"
              className="text-sm font-medium text-slate-300 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Include Exploratory Data Analysis (EDA) results
            </label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="include-models"
              checked={includeModels}
              onCheckedChange={(checked) => setIncludeModels(!!checked)}
              className="border-slate-700 data-[state=checked]:bg-violet-500 data-[state=checked]:text-white"
            />
            <label
              htmlFor="include-models"
              className="text-sm font-medium text-slate-300 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Include Model Training Results
            </label>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-400">Report Format</label>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger className="w-full bg-slate-950 border-slate-900 text-slate-300">
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent className="bg-slate-950 border-slate-900 text-slate-300">
                <SelectItem value="pdf" className="focus:bg-slate-900 focus:text-slate-200">PDF Document</SelectItem>
                <SelectItem value="html" className="focus:bg-slate-900 focus:text-slate-200">HTML Web Page</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Branding Customization Section */}
          <div className="space-y-4 pt-4 border-t border-slate-900">
            <div className="flex items-center gap-2 text-slate-300 font-semibold text-sm">
              <Palette className="h-4 w-4 text-violet-400" />
              <span>Branding Customization</span>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-400">Company / Organization Name (Optional)</label>
              <Input
                placeholder="e.g. Acme Corp"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="bg-slate-950 border-slate-900 text-slate-200 placeholder-slate-700 rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-400">Report Theme Color</label>
              <div className="flex items-center gap-3">
                <div className="flex gap-2">
                  {[
                    { name: 'Navy', hex: '#1e3a8a' },
                    { name: 'Violet', hex: '#7c3aed' },
                    { name: 'Emerald', hex: '#10b981' },
                    { name: 'Ocean', hex: '#0284c7' },
                    { name: 'Amber', hex: '#f59e0b' }
                  ].map((color) => (
                    <button
                      key={color.hex}
                      type="button"
                      onClick={() => setPrimaryColor(color.hex)}
                      className={`h-6 w-6 rounded-full border transition-all duration-200 ${
                        primaryColor === color.hex
                          ? 'border-white scale-110 ring-2 ring-violet-500/50'
                          : 'border-slate-800 hover:scale-105'
                      }`}
                      style={{ backgroundColor: color.hex }}
                      title={color.name}
                    />
                  ))}
                </div>
                <Input
                  type="text"
                  placeholder="#Hex Code"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-24 h-8 bg-slate-950 border-slate-900 text-slate-200 text-xs font-mono rounded-lg"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={handleGenerateReport}
            disabled={isGenerating || (!includeEDA && !includeModels)}
            className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-xl"
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
              className="flex-1 border-slate-800 bg-slate-950 hover:bg-slate-900 text-slate-300 rounded-xl"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Report
            </Button>
          )}
        </div>

        {generatedReport && (
          <div className="p-4 bg-violet-950/10 border border-violet-900/30 rounded-xl">
            <div className="flex items-center gap-2 text-violet-400">
              <FileText className="h-5 w-5" />
              <span className="font-semibold text-sm">Report Generated Successfully!</span>
            </div>
            <p className="text-xs text-slate-400 mt-1 font-body">
              Format: {generatedReport.format.toUpperCase()} •
              Generated at: {new Date().toLocaleString()}
            </p>
          </div>
        )}

        {(!includeEDA && !includeModels) && (
          <p className="text-xs text-slate-500 font-body">
            Please select at least one content type to include in the report.
          </p>
        )}
      </div>
    </Card>
  );
}
