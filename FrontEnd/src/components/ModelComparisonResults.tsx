import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, TrendingUp, BarChart3, Download, Eye } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

interface ModelComparisonResultsProps {
  projectId: string;
}

interface Model {
  id: string;
  run_id: string;
  name: string;
  storage_key: string;
  metrics: Record<string, unknown>;
  version: string;
  created_at: string;
}

export default function ModelComparisonResults({ projectId }: ModelComparisonResultsProps) {
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);

  const { data: models, isLoading } = useQuery<Model[]>({
    queryKey: ["project-models", projectId],
    queryFn: () => apiClient.getProjectModels(projectId),
    enabled: !!projectId,
  });

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          <span className="ml-2">Loading models...</span>
        </div>
      </Card>
    );
  }

  if (!models || models.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center py-8 text-muted-foreground">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No trained models found.</p>
          <p className="text-sm">Complete AutoML training to see model comparisons.</p>
        </div>
      </Card>
    );
  }

  // Sort models by performance (assuming higher scores are better)
  const sortedModels = [...models].sort((a, b) => {
    const aScore = getPrimaryScore(a.metrics);
    const bScore = getPrimaryScore(b.metrics);
    return bScore - aScore;
  });

  const bestModel = sortedModels[0];

  return (
    <div className="space-y-6">
      {/* Best Model Highlight */}
      <Card className="p-6 border-primary/20 bg-primary/5">
        <div className="flex items-center gap-3 mb-4">
          <Trophy className="h-6 w-6 text-yellow-500" />
          <h3 className="text-lg font-semibold">Best Performing Model</h3>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xl font-bold">{bestModel.name}</div>
            <div className="text-sm text-muted-foreground">
              Trained on {new Date(bestModel.created_at).toLocaleDateString()}
            </div>
          </div>
          <Badge variant="default" className="text-lg px-3 py-1">
            {getPrimaryScore(bestModel.metrics).toFixed(4)}
          </Badge>
        </div>
      </Card>

      {/* Model Comparison Table */}
      <Card className="p-6">
        <Tabs defaultValue="table" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="table">Table View</TabsTrigger>
            <TabsTrigger value="details">Model Details</TabsTrigger>
          </TabsList>

          <TabsContent value="table" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Model Comparison</h3>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Accuracy</TableHead>
                  <TableHead>Precision</TableHead>
                  <TableHead>Recall</TableHead>
                  <TableHead>F1-Score</TableHead>
                  <TableHead>CV Mean</TableHead>
                  <TableHead>CV Std</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedModels.map((model, index) => (
                  <TableRow key={model.id} className={index === 0 ? "bg-yellow-50" : ""}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {index === 0 && <Trophy className="h-4 w-4 text-yellow-500" />}
                        {model.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={index === 0 ? "default" : "secondary"}>
                        {getPrimaryScore(model.metrics).toFixed(4)}
                      </Badge>
                    </TableCell>
                    <TableCell>{getMetricValue(model.metrics, 'accuracy')?.toFixed(4) || 'N/A'}</TableCell>
                    <TableCell>{getMetricValue(model.metrics, 'precision')?.toFixed(4) || 'N/A'}</TableCell>
                    <TableCell>{getMetricValue(model.metrics, 'recall')?.toFixed(4) || 'N/A'}</TableCell>
                    <TableCell>{getMetricValue(model.metrics, 'f1_score')?.toFixed(4) || 'N/A'}</TableCell>
                    <TableCell>{getMetricValue(model.metrics, 'cv_mean')?.toFixed(4) || 'N/A'}</TableCell>
                    <TableCell>{getMetricValue(model.metrics, 'cv_std')?.toFixed(4) || 'N/A'}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedModel(model)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="details" className="space-y-4">
            {selectedModel ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{selectedModel.name} Details</h3>
                  <Badge variant="outline">Version {selectedModel.version}</Badge>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(selectedModel.metrics).map(([key, value]) => (
                    <Card key={key} className="p-4">
                      <div className="text-sm font-medium text-muted-foreground capitalize">
                        {key.replace('_', ' ')}
                      </div>
                      <div className="text-lg font-bold">
                        {typeof value === 'number' ? value.toFixed(4) : String(value)}
                      </div>
                    </Card>
                  ))}
                </div>

                <div className="text-sm text-muted-foreground">
                  <div>Run ID: {selectedModel.run_id}</div>
                  <div>Created: {new Date(selectedModel.created_at).toLocaleString()}</div>
                  <div>Storage: {selectedModel.storage_key}</div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a model from the table to view detailed metrics.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}

// Helper functions
function getPrimaryScore(metrics: Record<string, unknown>): number {
  // Try different score keys in order of preference
  const scoreKeys = ['score', 'accuracy', 'r2_score', 'f1_score'];
  for (const key of scoreKeys) {
    const value = metrics[key];
    if (typeof value === 'number') {
      return value;
    }
  }
  return 0;
}

function getMetricValue(metrics: Record<string, unknown>, key: string): number | null {
  const value = metrics[key];
  return typeof value === 'number' ? value : null;
}
