import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BarChart, Brain, TrendingUp, AlertTriangle, Info, Loader2, RefreshCw } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useState } from "react";
import { toast } from "sonner";
import CorrelationHeatmap from "./CorrelationHeatmap";
import DistributionChart from "./DistributionChart";
import OutlierChart from "./OutlierChart";

interface EDAInsight {
  type: string;
  title?: string;
  message: string;
  severity?: string;
}

interface EDAResults {
  run_id: string;
  status: string;
  created_at: string;
  results?: {
    summary: Record<string, unknown>;
    correlations: Record<string, unknown>;
    insights: EDAInsight[];
    distributions: Record<string, unknown>;
    outliers: Record<string, unknown>;
  };
}

interface EDADashboardProps {
  projectId: string;
}

export default function EDADashboard({ projectId }: EDADashboardProps) {
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: edaResults, isLoading: edaLoading, error: edaError } = useQuery<EDAResults>({
    queryKey: ["eda-results", projectId],
    queryFn: () => apiClient.getEDAResults(projectId),
    enabled: !!projectId,
  });

  const generateEDAMutation = useMutation({
    mutationFn: () => apiClient.generateEDA(projectId),
    onSuccess: (data) => {
      toast.success(data.message || "EDA analysis started successfully!");
      queryClient.invalidateQueries({ queryKey: ["eda-results", projectId] });
      setIsGenerating(false);
    },
    onError: (error) => {
      console.error("EDA generation failed:", error);
      toast.error("Failed to generate EDA analysis. Please try again.");
      setIsGenerating(false);
    },
  });

  const handleGenerateEDA = () => {
    setIsGenerating(true);
    generateEDAMutation.mutate();
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'secondary';
      case 'low':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'high':
        return <AlertTriangle className="h-4 w-4" />;
      case 'medium':
        return <Info className="h-4 w-4" />;
      case 'low':
        return <Info className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  if (edaLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mr-4" />
          <div>
            <h3 className="text-lg font-semibold">Loading EDA Results...</h3>
            <p className="text-muted-foreground">Analyzing your data insights</p>
          </div>
        </div>
      </Card>
    );
  }

  if (edaError) {
    return (
      <Card className="p-6">
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Failed to Load EDA Results</h3>
          <p className="text-muted-foreground mb-4">
            There was an error loading the exploratory data analysis results.
          </p>
          <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["eda-results", projectId] })}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  if (!edaResults || !edaResults.results) {
    return (
      <Card className="p-6">
        <div className="text-center py-12">
          <BarChart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No EDA Analysis Yet</h3>
          <p className="text-muted-foreground mb-6">
            Generate automated exploratory data analysis to uncover insights, correlations, and data quality issues.
          </p>
          <Button
            onClick={handleGenerateEDA}
            disabled={isGenerating}
            className="gap-2"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Brain className="h-4 w-4" />
            )}
            {isGenerating ? "Generating Analysis..." : "Generate EDA Analysis"}
          </Button>
        </div>
      </Card>
    );
  }

  const { results } = edaResults;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Exploratory Data Analysis</h2>
          <p className="text-muted-foreground">
            Automated insights and data exploration results
          </p>
        </div>
        <Button
          onClick={handleGenerateEDA}
          disabled={isGenerating}
          variant="outline"
          className="gap-2"
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {isGenerating ? "Regenerating..." : "Regenerate Analysis"}
        </Button>
      </div>

      {/* Insights Cards */}
      {results.insights && results.insights.length > 0 && (
        <div className="grid gap-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Key Insights
          </h3>
          {results.insights.map((insight, index) => (
            <Alert key={index} className="border-l-4 border-l-primary">
              <div className="flex items-start gap-3">
                {getSeverityIcon(insight.type)}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertDescription className="font-medium">
                      {insight.title || insight.type.charAt(0).toUpperCase() + insight.type.slice(1)}
                    </AlertDescription>
                    <Badge variant={getSeverityColor(insight.type) as "destructive" | "secondary" | "outline"} className="text-xs">
                      {insight.type}
                    </Badge>
                  </div>
                  <AlertDescription className="text-sm text-muted-foreground">
                    {insight.message}
                  </AlertDescription>
                </div>
              </div>
            </Alert>
          ))}
        </div>
      )}

      {/* Summary Statistics */}
      {results.summary && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Dataset Summary</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(results.summary).map(([key, value]) => (
              <div key={key} className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-primary mb-1">
                  {typeof value === 'number' ? value.toLocaleString() : String(value)}
                </div>
                <div className="text-sm text-muted-foreground capitalize">
                  {key.replace(/_/g, ' ')}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Correlations */}
      {results.correlations && Object.keys(results.correlations).length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Correlation Analysis</h3>
          <CorrelationHeatmap correlations={results.correlations as { top_correlations: Array<{ col1: string; col2: string; correlation: number }> }} />
        </Card>
      )}

      {/* Distributions */}
      {results.distributions && Object.keys(results.distributions).length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Data Distributions</h3>
          <DistributionChart distributions={results.distributions as Record<string, { mean: number; median: number; std: number; skewness: number; kurtosis: number; outliers_count: number }>} />
        </Card>
      )}

      {/* Outliers */}
      {results.outliers && Object.keys(results.outliers).length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Outlier Analysis</h3>
          <OutlierChart outliers={results.outliers as Record<string, { count: number; lower_bound: number; upper_bound: number; outlier_values: number[]; outlier_indices: number[]; percentage: number }>} />
        </Card>
      )}

      {/* Analysis Metadata */}
      <Card className="p-4 bg-muted/30">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Analysis ID: {edaResults.run_id}</span>
          <span>Generated: {new Date().toLocaleString()}</span>
        </div>
      </Card>
    </div>
  );
}
