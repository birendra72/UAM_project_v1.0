import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, CheckCircle, XCircle, Sparkles, Zap, BarChart3, FileText, History } from 'lucide-react';
import { toast } from 'sonner';

interface DatasetPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataset: {
    id: string;
    filename: string;
    validation_status?: string;
    columns_json?: Record<string, string | {
      original_dtype: string;
      inferred_type: string;
      unique_count: number;
      null_count: number;
      null_percentage: number;
    }>;
  } | null;
}

interface PreviewData {
  columns: string[];
  first_rows: Record<string, string | number | boolean | null>[];
}

interface SummaryData {
  total_rows: number;
  total_columns: number;
  column_types: Record<string, string>;
  missing_values: Record<string, number>;
  statistics: Record<string, {
    mean?: number;
    std?: number;
    min?: number;
    max?: number;
    count?: number;
  }>;
}

interface ValidationResult {
  dataset_id: string;
  total_rows: number;
  total_columns: number;
  issues: Array<{
    type: string;
    severity: string;
    message: string;
    details?: Record<string, unknown>;
  }>;
  summary: {
    missing_values: number;
    duplicate_rows: number;
    data_type_issues: number;
    outlier_count: number;
  };
  severity: string;
}

export default function DatasetPreviewModal({ isOpen, onClose, dataset }: DatasetPreviewModalProps) {
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('preview');
  const [isValidating, setIsValidating] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);

  const fetchPreviewData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.getDatasetPreview(dataset!.id);
      setPreviewData(data as PreviewData);
    } catch (err) {
      console.error('Preview fetch failed:', err);
      setError('Failed to load preview data');
    } finally {
      setLoading(false);
    }
  }, [dataset]);

  const fetchSummaryData = useCallback(async () => {
    try {
      const data = await apiClient.getDatasetSummary(dataset!.id);
      setSummaryData(data as SummaryData);
    } catch (err) {
      console.error('Summary fetch failed:', err);
    }
  }, [dataset]);

  useEffect(() => {
    if (isOpen && dataset) {
      fetchPreviewData();
      fetchSummaryData();
    }
  }, [isOpen, dataset, fetchPreviewData, fetchSummaryData]);

  const handleValidate = async () => {
    setIsValidating(true);
    try {
      const result = await apiClient.validateDataset(dataset!.id);
      setValidationResult(result as ValidationResult);
      setActiveTab('validation');
      toast.success('Validation completed!');
    } catch (err) {
      toast.error('Validation failed');
      console.error(err);
    } finally {
      setIsValidating(false);
    }
  };

  const handleAutoClean = async () => {
    setIsCleaning(true);
    try {
      await apiClient.autoCleanDataset(dataset!.id, {
        remove_outliers: true,
        fill_missing: true,
        fill_strategy: 'mean'
      });
      toast.success('Dataset cleaned successfully!');
      // Refresh data
      await fetchPreviewData();
      await fetchSummaryData();
      if (validationResult) {
        await handleValidate();
      }
    } catch (err) {
      toast.error('Cleaning failed');
      console.error(err);
    } finally {
      setIsCleaning(false);
    }
  };

  const getTypeBadgeColor = (type: string) => {
    if (typeof type !== 'string') return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    if (type.includes('int') || type.includes('float')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    if (type.includes('object') || type.includes('string')) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    if (type.includes('bool')) return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'good': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'critical': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <AlertTriangle className="w-4 h-4 text-gray-500" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-background rounded-xl border border-border shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6 border-b border-border">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <h3 className="text-xl font-bold text-foreground">
              Preview: <span className="text-primary">{dataset?.filename}</span>
            </h3>
            {dataset?.validation_status && (
              <Badge variant={dataset.validation_status === 'good' ? 'default' : 'destructive'} className="w-fit">
                {dataset.validation_status === 'good' ? 'Valid' : 'Issues Found'}
              </Badge>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-2 hover:bg-muted rounded-lg"
            title="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 p-6 pt-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleValidate}
            disabled={isValidating}
            className="gap-2"
          >
            <Sparkles className="w-4 h-4" />
            {isValidating ? 'Validating...' : 'Validate Data'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAutoClean}
            disabled={isCleaning}
            className="gap-2"
          >
            <Zap className="w-4 h-4" />
            {isCleaning ? 'Cleaning...' : 'Auto Clean'}
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <div className="px-6 pb-4">
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 h-auto">
              <TabsTrigger value="preview" className="gap-2 py-3">
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">Preview</span>
              </TabsTrigger>
              <TabsTrigger value="summary" className="gap-2 py-3">
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:inline">Summary</span>
              </TabsTrigger>
              <TabsTrigger value="validation" className="gap-2 py-3">
                <CheckCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Validation</span>
              </TabsTrigger>
              <TabsTrigger value="types" className="gap-2 py-3">
                <History className="w-4 h-4" />
                <span className="hidden sm:inline">Types</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-hidden px-6 pb-6">
            <TabsContent value="preview" className="h-full mt-0">
              <div className="h-full overflow-auto bg-muted/20 rounded-lg border">
                {loading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="text-muted-foreground">Loading preview...</div>
                  </div>
                ) : error ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="text-destructive">{error}</div>
                  </div>
                ) : previewData && previewData.columns ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border">
                      <thead className="bg-muted/50 sticky top-0 z-10">
                        <tr>
                          {previewData.columns.map(header => (
                            <th key={header} scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-background divide-y divide-border">
                        {previewData.first_rows.slice(0, 50).map((row, rowIndex) => (
                          <tr key={rowIndex} className="hover:bg-muted/50 transition-colors">
                            {previewData.columns.map((header, colIndex) => (
                              <td key={`${rowIndex}-${colIndex}`} className="px-4 py-3 whitespace-nowrap text-sm text-foreground max-w-xs truncate" title={String(row[header])}>
                                {String(row[header] ?? 'null')}
                              </td>
                            ))}
                          </tr>
                        ))}
                        {previewData.first_rows.length > 50 && (
                          <tr>
                            <td colSpan={previewData.columns.length} className="px-4 py-3 text-center text-muted-foreground text-sm">
                              ... and {previewData.first_rows.length - 50} more rows
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-32">
                    <div className="text-muted-foreground">No preview data available</div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="summary" className="h-full mt-0 overflow-auto">
              {summaryData ? (
                <div className="space-y-6">
                  {/* Stats Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="p-4 text-center">
                      <div className="text-2xl font-bold text-primary">{summaryData.total_rows.toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground">Total Rows</div>
                    </Card>
                    <Card className="p-4 text-center">
                      <div className="text-2xl font-bold text-primary">{summaryData.total_columns}</div>
                      <div className="text-sm text-muted-foreground">Total Columns</div>
                    </Card>
                    <Card className="p-4 text-center">
                      <div className="text-2xl font-bold text-red-500">
                        {Object.values(summaryData.missing_values || {}).reduce((a, b) => a + b, 0)}
                      </div>
                      <div className="text-sm text-muted-foreground">Missing Values</div>
                    </Card>
                    <Card className="p-4 text-center">
                      <div className="text-2xl font-bold text-primary">
                        {Object.keys(summaryData.statistics || {}).length}
                      </div>
                      <div className="text-sm text-muted-foreground">Numeric Columns</div>
                    </Card>
                  </div>

                  {/* Column Statistics */}
                  {summaryData.statistics && Object.keys(summaryData.statistics).length > 0 && (
                    <Card className="p-6">
                      <h4 className="font-semibold mb-4">Column Statistics</h4>
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {Object.entries(summaryData.statistics).map(([col, stats]) => (
                          <div key={col} className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 p-3 bg-muted/50 rounded-lg">
                            <span className="font-medium">{col}</span>
                            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                              <span>Mean: {stats.mean?.toFixed(2) ?? 'N/A'}</span>
                              <span>Std: {stats.std?.toFixed(2) ?? 'N/A'}</span>
                              <span>Min: {stats.min?.toFixed(2) ?? 'N/A'}</span>
                              <span>Max: {stats.max?.toFixed(2) ?? 'N/A'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}

                  {/* Missing Values Breakdown */}
                  {summaryData.missing_values && Object.keys(summaryData.missing_values).length > 0 && (
                    <Card className="p-6">
                      <h4 className="font-semibold mb-4">Missing Values by Column</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {Object.entries(summaryData.missing_values).map(([col, count]) => (
                          <div key={col} className="flex justify-between items-center p-2 bg-muted/50 rounded">
                            <span className="font-medium">{col}</span>
                            <Badge variant="destructive">{count} missing</Badge>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-32">
                  <div className="text-muted-foreground">No summary data available</div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="validation" className="h-full mt-0 overflow-auto">
              {validationResult ? (
                <div className="space-y-6">
                  {/* Overall Status */}
                  <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                    {getSeverityIcon(validationResult.severity)}
                    <div>
                      <span className="font-semibold capitalize text-lg">{validationResult.severity} Data Quality</span>
                      <p className="text-sm text-muted-foreground">Validation completed for {validationResult.total_rows.toLocaleString()} rows</p>
                    </div>
                  </div>

                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="p-4 text-center">
                      <div className="text-2xl font-bold text-red-500">{validationResult.summary.missing_values}</div>
                      <div className="text-sm text-muted-foreground">Missing Values</div>
                    </Card>
                    <Card className="p-4 text-center">
                      <div className="text-2xl font-bold text-orange-500">{validationResult.summary.duplicate_rows}</div>
                      <div className="text-sm text-muted-foreground">Duplicate Rows</div>
                    </Card>
                    <Card className="p-4 text-center">
                      <div className="text-2xl font-bold text-yellow-500">{validationResult.summary.data_type_issues}</div>
                      <div className="text-sm text-muted-foreground">Type Issues</div>
                    </Card>
                    <Card className="p-4 text-center">
                      <div className="text-2xl font-bold text-purple-500">{validationResult.summary.outlier_count}</div>
                      <div className="text-sm text-muted-foreground">Outliers</div>
                    </Card>
                  </div>

                  {/* Issues List */}
                  {validationResult.issues.length > 0 && (
                    <Card className="p-6">
                      <h4 className="font-semibold mb-4">Issues Found ({validationResult.issues.length})</h4>
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {validationResult.issues.map((issue, index) => (
                          <div key={index} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg border-l-4 border-l-red-500">
                            {getSeverityIcon(issue.severity)}
                            <div className="flex-1">
                              <div className="font-medium capitalize">{issue.type.replace(/_/g, ' ')}</div>
                              <div className="text-sm text-muted-foreground mt-1">{issue.message}</div>
                              {issue.details && (
                                <details className="mt-2">
                                  <summary className="text-xs text-muted-foreground cursor-pointer">Show details</summary>
                                  <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">
                                    {JSON.stringify(issue.details, null, 2)}
                                  </pre>
                                </details>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}

                  {validationResult.issues.length === 0 && (
                    <Card className="p-8 text-center">
                      <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                      <h4 className="font-semibold text-green-700 mb-2">No Issues Found</h4>
                      <p className="text-muted-foreground">Your dataset passed all validation checks!</p>
                    </Card>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <CheckCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h4 className="font-semibold mb-2">Ready for Validation</h4>
                  <p className="text-muted-foreground mb-4">Click "Validate Data" to check data quality</p>
                  <Button onClick={handleValidate} disabled={isValidating} className="gap-2">
                    <Sparkles className="w-4 h-4" />
                    {isValidating ? 'Validating...' : 'Start Validation'}
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="types" className="h-full mt-0 overflow-auto">
              {dataset?.columns_json ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">Detected Column Types ({Object.keys(dataset.columns_json).length})</h4>
                    <Badge variant="outline">{Object.keys(dataset.columns_json).length} columns</Badge>
                  </div>
                  <div className="grid gap-3 max-h-96 overflow-y-auto">
                    {Object.entries(dataset.columns_json).map(([col, typeInfo]) => {
                      const type = typeof typeInfo === 'string' ? typeInfo : typeInfo.inferred_type;
                      return (
                        <div key={col} className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 p-4 bg-muted/50 rounded-lg border">
                          <span className="font-medium break-all">{col}</span>
                          <Badge className={getTypeBadgeColor(type)}>{type}</Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-32">
                  <div className="text-muted-foreground">No type information available</div>
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
