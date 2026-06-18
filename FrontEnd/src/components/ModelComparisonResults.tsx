import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, TrendingUp, BarChart3, Download, Eye, Award, Cpu } from "lucide-react";
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
      <Card className="p-6 bg-slate-950/40 border border-slate-900">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-violet-500"></div>
          <span className="ml-2 font-body text-slate-300">Loading models...</span>
        </div>
      </Card>
    );
  }

  if (!models || models.length === 0) {
    return (
      <Card className="p-6 bg-slate-950/40 border border-slate-900">
        <div className="text-center py-8 text-muted-foreground">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50 text-slate-600" />
          <p className="font-display font-semibold text-slate-400">No trained models found</p>
          <p className="text-xs text-slate-500 mt-1">Complete AutoML training to see model comparisons.</p>
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
      <Card className="relative overflow-hidden p-6 border border-amber-500/30 bg-gradient-to-br from-amber-950/10 via-slate-950/40 to-slate-950/40 shadow-[0_0_20px_rgba(245,158,11,0.05)]">
        <div className="absolute top-0 right-0 h-48 w-48 bg-radial-gradient from-amber-500/5 to-transparent pointer-events-none rounded-full blur-2xl" />
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-500 animate-pulse" />
            <h3 className="font-display font-bold text-slate-100 text-sm uppercase tracking-wider">Top Performing Model</h3>
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
            Best Pipeline
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-extrabold font-display bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">
              {bestModel.name}
            </div>
            <div className="text-xs text-slate-500 mt-1 font-body">
              Trained on {new Date(bestModel.created_at).toLocaleDateString()} · Version {bestModel.version}
            </div>
          </div>
          <div className="text-3xl font-extrabold font-mono text-amber-400 bg-amber-500/5 border border-amber-500/20 px-4 py-2 rounded-xl">
            {getPrimaryScore(bestModel.metrics).toFixed(4)}
          </div>
        </div>
      </Card>

      {/* Model Comparison Table */}
      <Card className="p-6 bg-slate-950/40 border border-slate-900">
        <Tabs defaultValue="table" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-slate-900 border border-slate-800 p-1 mb-6 rounded-xl">
            <TabsTrigger value="table" className="rounded-lg py-2 text-xs font-semibold data-[state=active]:bg-slate-950">Table View</TabsTrigger>
            <TabsTrigger value="details" className="rounded-lg py-2 text-xs font-semibold data-[state=active]:bg-slate-950">Model Details</TabsTrigger>
          </TabsList>

          <TabsContent value="table" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-slate-200 text-base">Model Comparison Matrix</h3>
              <Button variant="outline" size="sm" className="h-8 text-xs border-slate-800 bg-slate-950 hover:bg-slate-900 text-slate-300 hover:text-slate-100">
                <Download className="h-3.5 w-3.5 mr-2" />
                Export
              </Button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-900">
              <Table>
                <TableHeader className="bg-slate-950/40">
                  <TableRow className="border-b border-slate-900 hover:bg-transparent">
                    <TableHead className="font-display text-slate-400 font-semibold text-xs py-3">Model</TableHead>
                    <TableHead className="font-display text-slate-400 font-semibold text-xs py-3">Score</TableHead>
                    <TableHead className="font-display text-slate-400 font-semibold text-xs py-3">Accuracy</TableHead>
                    <TableHead className="font-display text-slate-400 font-semibold text-xs py-3">Precision</TableHead>
                    <TableHead className="font-display text-slate-400 font-semibold text-xs py-3">Recall</TableHead>
                    <TableHead className="font-display text-slate-400 font-semibold text-xs py-3">F1-Score</TableHead>
                    <TableHead className="font-display text-slate-400 font-semibold text-xs py-3">CV Mean</TableHead>
                    <TableHead className="font-display text-slate-400 font-semibold text-xs py-3">CV Std</TableHead>
                    <TableHead className="font-display text-slate-400 font-semibold text-xs py-3 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedModels.map((model, index) => (
                    <TableRow 
                      key={model.id} 
                      className={`border-b border-slate-900/60 transition-colors ${
                        index === 0 
                          ? "bg-amber-500/5 hover:bg-amber-500/8 border-l-2 border-l-amber-500" 
                          : "hover:bg-slate-900/30"
                      }`}
                    >
                      <TableCell className="py-4 font-semibold text-slate-200">
                        <div className="flex items-center gap-2">
                          {index === 0 && <Trophy className="h-4 w-4 text-amber-500 flex-shrink-0" />}
                          {model.name}
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge 
                          variant="outline"
                          className={index === 0 ? "bg-amber-500/10 text-amber-400 border-amber-500/20 font-mono" : "font-mono text-slate-300 border-slate-800"}
                        >
                          {getPrimaryScore(model.metrics).toFixed(4)}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 font-mono text-slate-400 text-xs">
                        {getMetricValue(model.metrics, 'accuracy')?.toFixed(4) || 'N/A'}
                      </TableCell>
                      <TableCell className="py-4 font-mono text-slate-400 text-xs">
                        {getMetricValue(model.metrics, 'precision')?.toFixed(4) || 'N/A'}
                      </TableCell>
                      <TableCell className="py-4 font-mono text-slate-400 text-xs">
                        {getMetricValue(model.metrics, 'recall')?.toFixed(4) || 'N/A'}
                      </TableCell>
                      <TableCell className="py-4 font-mono text-slate-400 text-xs">
                        {getMetricValue(model.metrics, 'f1_score')?.toFixed(4) || 'N/A'}
                      </TableCell>
                      <TableCell className="py-4 font-mono text-slate-400 text-xs">
                        {getMetricValue(model.metrics, 'cv_mean')?.toFixed(4) || 'N/A'}
                      </TableCell>
                      <TableCell className="py-4 font-mono text-slate-400 text-xs">
                        {getMetricValue(model.metrics, 'cv_std')?.toFixed(4) || 'N/A'}
                      </TableCell>
                      <TableCell className="py-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-slate-400 hover:text-slate-100 hover:bg-slate-900"
                          onClick={() => setSelectedModel(model)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="details" className="space-y-4">
            {selectedModel ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-900 pb-4">
                  <div>
                    <h3 className="font-display font-bold text-lg text-slate-200">{selectedModel.name}</h3>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">Run ID: {selectedModel.run_id}</p>
                  </div>
                  <Badge variant="outline" className="border-slate-800 text-slate-300">
                    Version {selectedModel.version}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(selectedModel.metrics).map(([key, value]) => (
                    <Card key={key} className="p-4 bg-slate-950/20 border border-slate-900 hover:border-slate-800 transition-colors">
                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-display capitalize">
                        {key.replace(/_/g, ' ')}
                      </div>
                      <div className="text-xl font-bold font-mono text-slate-200 mt-2">
                        {typeof value === 'number' ? value.toFixed(4) : String(value)}
                      </div>
                    </Card>
                  ))}
                </div>

                <div className="text-xs text-slate-500 font-mono space-y-1 bg-slate-950/20 border border-slate-900/40 p-4 rounded-xl">
                  <div>• Storage Location: {selectedModel.storage_key}</div>
                  <div>• Created Timestamp: {new Date(selectedModel.created_at).toLocaleString()}</div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 border border-dashed border-slate-900 rounded-xl">
                <Eye className="h-10 w-10 mx-auto mb-2 opacity-40 text-slate-600" />
                <p className="text-sm text-slate-400">Select a model from the table to view detailed metrics</p>
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
