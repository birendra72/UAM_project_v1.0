import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, BarChart3, TrendingUp, PieChart, Download, Settings } from 'lucide-react';
import { apiClient, API_BASE_URL } from '@/lib/api';
import Plot, { PlotData, Layout } from 'plotly.js';

interface DataVisualizationProps {
  projectId: string;
  datasets: Array<{ id: string; filename: string; columns?: string[] }>;
}

interface EDAResult {
  status: string;
  progress: number;
  current_task: string;
  artifacts: {
    chart_url?: string;
    summary_url?: string;
  };
}

interface SummaryStats {
  shape: [number, number];
  columns: string[];
  dtypes: Record<string, string>;
  missing_values: Record<string, number>;
  describe: Record<string, Record<string, number>>;
}

interface StartEDAResponse {
  run_id: string;
}

interface PreviewData {
  columns: string[];
  first_rows: Record<string, unknown>[];
}

export default function DataVisualization({ projectId, datasets }: DataVisualizationProps) {
  const [selectedDataset, setSelectedDataset] = useState<string>('');
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [chartType, setChartType] = useState<string>('histogram');
  const [edaResult, setEdaResult] = useState<EDAResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [chartData, setChartData] = useState<{ data: PlotData[]; layout: Layout } | null>(null);
  const [summaryData, setSummaryData] = useState<SummaryStats | null>(null);
const [availableColumns, setAvailableColumns] = useState<string[]>([]);
const [previewData, setPreviewData] = useState<PreviewData | null>(null);
const [selectedYColumn, setSelectedYColumn] = useState<string>('');

  const runEDA = async () => {
    if (!selectedDataset) return;

    setIsLoading(true);
    try {
      const response: StartEDAResponse = await apiClient.startEDA(selectedDataset, projectId);
      const runId = response.run_id;

      // Poll for status
      const pollStatus = async () => {
        try {
          const status: EDAResult = await apiClient.getEDAStatus(runId);
          setEdaResult(status);

          if (status.status === 'COMPLETED') {
            // Load artifacts
            if (status.artifacts.chart_url) {
              const chartResponse = await fetch(`${API_BASE_URL}${status.artifacts.chart_url}`);
              const chartJson = await chartResponse.json();
              setChartData(chartJson);
            }
            if (status.artifacts.summary_url) {
              const summaryResponse = await fetch(`${API_BASE_URL}${status.artifacts.summary_url}`);
              const summaryJson = await summaryResponse.json();
              setSummaryData(summaryJson);
              setAvailableColumns(summaryJson.columns || []);
            }
            setIsLoading(false);
          } else if (status.status === 'FAILED') {
            setIsLoading(false);
          } else {
            setTimeout(pollStatus, 2000); // Poll every 2 seconds
          }
        } catch (error) {
          console.error('Error polling EDA status:', error);
          setIsLoading(false);
        }
      };

      pollStatus();
    } catch (error) {
      console.error('Error starting EDA:', error);
      setIsLoading(false);
    }
  };

const generateCustomChart = useCallback(() => {
  if (!summaryData || !selectedColumn || !previewData || previewData.first_rows.length === 0) return;
  const columnData = previewData.first_rows.map(row => row[selectedColumn]).filter(v => v != null);
  if (columnData.length === 0) return;
  let plotData: PlotData[] = [];
  let layout: Partial<Layout> = {};
  if (chartType === 'histogram') {
    plotData = [{
      x: columnData,
      type: 'histogram',
      nbinsx: 30,
      name: selectedColumn
    } as unknown as PlotData];
    layout = {
      title: { text: `Histogram of ${selectedColumn}` },
      xaxis: { title: { text: selectedColumn } },
      yaxis: { title: { text: 'Frequency' } }
    };
  } else if (chartType === 'box') {
    plotData = [{
      y: columnData,
      type: 'box',
      name: selectedColumn
    } as unknown as PlotData];
    layout = {
      title: { text: `Box Plot of ${selectedColumn}` },
      yaxis: { title: { text: selectedColumn } }
    };
  } else if (chartType === 'scatter') {
    if (!selectedYColumn) return;
    const yData = previewData.first_rows.map(row => row[selectedYColumn]).filter(v => v != null);
    if (yData.length !== columnData.length) return;
    plotData = [{
      x: columnData,
      y: yData,
      mode: 'markers',
      type: 'scatter',
      name: `${selectedColumn} vs ${selectedYColumn}`
    } as unknown as PlotData];
    layout = {
      title: { text: `Scatter Plot of ${selectedColumn} vs ${selectedYColumn}` },
      xaxis: { title: { text: selectedColumn } },
      yaxis: { title: { text: selectedYColumn } }
    };
  }
  const chartDiv = document.getElementById('custom-chart');
  if (chartDiv) {
    Plot.newPlot(chartDiv, plotData, layout);
  }
}, [summaryData, selectedColumn, previewData, chartType, selectedYColumn]);
const handleExport = useCallback(() => {
  const chartDiv = document.getElementById('eda-chart');
  if (chartDiv) {
    Plot.toImage(chartDiv, {format: 'png', width: 800, height: 600}).then(url => {
      const link = document.createElement('a');
      link.href = url;
      link.download = 'eda-chart.png';
      link.click();
    }).catch(console.error);
  }
}, []);

useEffect(() => {
  if (chartData) {
    const chartDiv = document.getElementById('eda-chart');
    if (chartDiv) {
      Plot.newPlot(chartDiv, chartData.data, chartData.layout);
    }
  }
}, [chartData]);
useEffect(() => {
  if (selectedDataset) {
    apiClient.getDatasetPreview(selectedDataset).then(setPreviewData).catch(console.error);
  }
}, [selectedDataset]);

useEffect(() => {
  if (selectedColumn && summaryData && previewData?.first_rows.length > 0) {
    generateCustomChart();
  }
}, [selectedColumn, chartType, summaryData, previewData, selectedYColumn, generateCustomChart]);

  const calculateStats = (data: SummaryStats) => {
    const numericColumns = Object.entries(data.dtypes)
      .filter(([_, dtype]) => dtype.includes('int') || dtype.includes('float'))
      .map(([col, _]) => col);

    const stats = {
      totalRows: data.shape[0],
      totalColumns: data.shape[1],
      numericColumns: numericColumns.length,
      categoricalColumns: data.shape[1] - numericColumns.length,
      missingValues: Object.values(data.missing_values).reduce((a, b) => a + b, 0),
      completeness: ((data.shape[0] * data.shape[1] - Object.values(data.missing_values).reduce((a, b) => a + b, 0)) / (data.shape[0] * data.shape[1])) * 100
    };

    return stats;
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Automated Insights</h3>

        <div className="flex gap-4 mb-4">
          <Select value={selectedDataset} onValueChange={setSelectedDataset}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select a dataset" />
            </SelectTrigger>
            <SelectContent>
              {datasets.map(dataset => (
                <SelectItem key={dataset.id} value={dataset.id}>
                  {dataset.filename}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={runEDA} disabled={!selectedDataset || isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Insights...
              </>
            ) : (
              <>
                <BarChart3 className="h-4 w-4 mr-2" />
                Generate Insights
              </>
            )}
          </Button>
        </div>

        {edaResult && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium">Status:</span>
              <span className={`text-sm px-2 py-1 rounded ${
                edaResult.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                edaResult.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {edaResult.status}
              </span>
            </div>
            {edaResult.current_task && (
              <div className="text-sm text-muted-foreground">
                Current task: {edaResult.current_task}
              </div>
            )}
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${edaResult.progress * 100}%` }}
              ></div>
            </div>
          </div>
        )}
      </Card>

      {summaryData && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(() => {
              const stats = calculateStats(summaryData);
              return (
                <>
                  <Card className="p-4">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="text-sm font-medium">Total Rows</p>
                        <p className="text-2xl font-bold">{stats.totalRows.toLocaleString()}</p>
                      </div>
                    </div>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="text-sm font-medium">Columns</p>
                        <p className="text-2xl font-bold">{stats.totalColumns}</p>
                      </div>
                    </div>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-center gap-2">
                      <PieChart className="h-5 w-5 text-purple-600" />
                      <div>
                        <p className="text-sm font-medium">Missing Values</p>
                        <p className="text-2xl font-bold">{stats.missingValues}</p>
                      </div>
                    </div>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-center gap-2">
                      <Settings className="h-5 w-5 text-orange-600" />
                      <div>
                        <p className="text-sm font-medium">Data Completeness</p>
                        <p className="text-2xl font-bold">{stats.completeness.toFixed(1)}%</p>
                      </div>
                    </div>
                  </Card>
                </>
              );
            })()}
          </div>

          <Card className="p-6">
            <h4 className="text-lg font-semibold mb-4">Custom Chart Generator</h4>
            <div className="flex gap-4 mb-4">
              <Select value={selectedColumn} onValueChange={setSelectedColumn}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select a column" />
                </SelectTrigger>
                <SelectContent>
                  {availableColumns.map(column => (
                    <SelectItem key={column} value={column}>
                      {column}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={chartType} onValueChange={setChartType}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Chart type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="histogram">Histogram</SelectItem>
                  <SelectItem value="box">Box Plot</SelectItem>
                  <SelectItem value="scatter">Scatter Plot</SelectItem>
                </SelectContent>
              </Select>
              {chartType === 'scatter' && (
                <Select value={selectedYColumn} onValueChange={setSelectedYColumn}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select Y column" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableColumns.map(column => (
                      <SelectItem key={column} value={column}>
                        {column}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {selectedColumn && (
              <div id="custom-chart" className="w-full h-80 border rounded"></div>
            )}
          </Card>
        </>
      )}

      {chartData && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold">Interactive Chart</h4>
    <Button onClick={handleExport} variant="outline" size="sm">
      <Download className="h-4 w-4 mr-2" />
      Export
    </Button>
          </div>
          <div id="eda-chart" className="w-full h-96"></div>
        </Card>
      )}

      {!selectedDataset && !isLoading && (
        <Card className="p-6">
          <div className="text-center py-12 text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Select a dataset and click "Generate Insights" to explore your data.</p>
          </div>
        </Card>
      )}
    </div>
  );
}
