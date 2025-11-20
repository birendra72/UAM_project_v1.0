import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BarChart3, TrendingUp, AlertTriangle, CheckCircle, Target, Activity } from 'lucide-react';

interface PredictionSummary {
  total_predictions: number;
  prediction_types: {
    numeric?: {
      min: number;
      max: number;
      mean: number;
      median: number;
      std: number;
      q25: number;
      q75: number;
      unique_values: number;
      range: number;
    };
    categorical?: {
      unique_values: number;
      most_common: string;
      least_common: string;
      distribution: Record<string, number>;
      percentages: Record<string, number>;
      entropy: number;
    };
  };
  statistics: {
    prediction_ranges?: {
      low: string;
      medium: string;
      high: string;
    };
    class_distribution?: {
      majority_class: string;
      majority_percentage: number;
      minority_class: string;
      minority_percentage: number;
    };
    data_quality: {
      has_null_predictions: boolean;
      prediction_variance?: number;
      outlier_count?: number;
    };
  };
  confidence?: {
    mean_confidence: number;
    min_confidence: number;
    max_confidence: number;
    std_confidence: number;
    high_confidence_ratio: number;
    low_confidence_ratio: number;
  };
}

interface PredictionSummaryCardsProps {
  summary: PredictionSummary;
  onExport?: () => void;
}

export default function PredictionSummaryCards({ summary, onExport }: PredictionSummaryCardsProps) {
  const isNumeric = 'numeric' in summary.prediction_types;
  const isCategorical = 'categorical' in summary.prediction_types;

  const formatNumber = (num: number, decimals: number = 2) => {
    return num.toFixed(decimals);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceBadgeVariant = (confidence: number) => {
    if (confidence >= 0.8) return 'default';
    if (confidence >= 0.6) return 'secondary';
    return 'destructive';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Overview Card */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center">
            <Target className="h-5 w-5 mr-2" />
            Overview
          </h3>
          <Badge variant="outline">{summary.total_predictions} predictions</Badge>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Total Samples</span>
            <span className="font-medium">{summary.total_predictions}</span>
          </div>
          {summary.confidence && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Avg Confidence</span>
              <Badge variant={getConfidenceBadgeVariant(summary.confidence.mean_confidence)}>
                {formatNumber(summary.confidence.mean_confidence * 100)}%
              </Badge>
            </div>
          )}
          {summary.statistics.data_quality.has_null_predictions && (
            <div className="flex items-center text-yellow-600">
              <AlertTriangle className="h-4 w-4 mr-1" />
              <span className="text-sm">Contains null predictions</span>
            </div>
          )}
        </div>
      </Card>

      {/* Statistics Card */}
      {isNumeric && summary.prediction_types.numeric && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              Numeric Statistics
            </h3>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Mean</p>
                <p className="font-medium">{formatNumber(summary.prediction_types.numeric.mean)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Median</p>
                <p className="font-medium">{formatNumber(summary.prediction_types.numeric.median)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Std Dev</p>
                <p className="font-medium">{formatNumber(summary.prediction_types.numeric.std)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Range</p>
                <p className="font-medium">{formatNumber(summary.prediction_types.numeric.range)}</p>
              </div>
            </div>
            {summary.statistics.prediction_ranges && (
              <div className="mt-4">
                <p className="text-xs text-muted-foreground mb-2">Prediction Ranges</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>Low:</span>
                    <span className="text-red-600">{summary.statistics.prediction_ranges.low}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>Medium:</span>
                    <span className="text-yellow-600">{summary.statistics.prediction_ranges.medium}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>High:</span>
                    <span className="text-green-600">{summary.statistics.prediction_ranges.high}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Categorical Statistics Card */}
      {isCategorical && summary.prediction_types.categorical && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center">
              <Activity className="h-5 w-5 mr-2" />
              Class Distribution
            </h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Unique Classes</span>
              <Badge variant="outline">{summary.prediction_types.categorical.unique_values}</Badge>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Most Common:</span>
                <Badge variant="default">{summary.prediction_types.categorical.most_common}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span>Least Common:</span>
                <Badge variant="secondary">{summary.prediction_types.categorical.least_common}</Badge>
              </div>
            </div>
            {summary.statistics.class_distribution && (
              <div className="mt-4">
                <p className="text-xs text-muted-foreground mb-2">Distribution Summary</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>Majority Class:</span>
                    <span className="font-medium">{summary.statistics.class_distribution.majority_class}</span>
                  </div>
                  <Progress
                    value={summary.statistics.class_distribution.majority_percentage}
                    className="h-2 mt-1"
                  />
                  <p className="text-xs text-muted-foreground">
                    {formatNumber(summary.statistics.class_distribution.majority_percentage)}% of predictions
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Confidence Analysis Card */}
      {summary.confidence && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center">
              <CheckCircle className="h-5 w-5 mr-2" />
              Confidence Analysis
            </h3>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Mean Confidence</p>
                <p className={`font-medium ${getConfidenceColor(summary.confidence.mean_confidence)}`}>
                  {formatNumber(summary.confidence.mean_confidence * 100)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">High Confidence</p>
                <p className="font-medium text-green-600">
                  {formatNumber(summary.confidence.high_confidence_ratio * 100)}%
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>Confidence Range:</span>
                <span>{formatNumber(summary.confidence.min_confidence * 100)}% - {formatNumber(summary.confidence.max_confidence * 100)}%</span>
              </div>
              <Progress
                value={summary.confidence.mean_confidence * 100}
                className="h-2"
              />
            </div>
            {summary.confidence.low_confidence_ratio > 0.1 && (
              <div className="flex items-center text-yellow-600">
                <AlertTriangle className="h-4 w-4 mr-1" />
                <span className="text-sm">
                  {formatNumber(summary.confidence.low_confidence_ratio * 100)}% low confidence predictions
                </span>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Data Quality Card */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center">
            <TrendingUp className="h-5 w-5 mr-2" />
            Data Quality
          </h3>
        </div>
        <div className="space-y-3">
          {summary.statistics.data_quality.has_null_predictions ? (
            <div className="flex items-center text-red-600">
              <AlertTriangle className="h-4 w-4 mr-2" />
              <span className="text-sm">Null predictions detected</span>
            </div>
          ) : (
            <div className="flex items-center text-green-600">
              <CheckCircle className="h-4 w-4 mr-2" />
              <span className="text-sm">No null predictions</span>
            </div>
          )}

          {summary.statistics.data_quality.prediction_variance !== null && summary.statistics.data_quality.prediction_variance !== undefined && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Variance</span>
              <span className="font-medium">{formatNumber(summary.statistics.data_quality.prediction_variance)}</span>
            </div>
          )}

          {summary.statistics.data_quality.outlier_count !== null && summary.statistics.data_quality.outlier_count !== undefined && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Outliers</span>
              <Badge variant={summary.statistics.data_quality.outlier_count > 0 ? "destructive" : "secondary"}>
                {summary.statistics.data_quality.outlier_count}
              </Badge>
            </div>
          )}

          {isCategorical && summary.prediction_types.categorical && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Entropy</span>
              <span className="font-medium">{formatNumber(summary.prediction_types.categorical.entropy, 3)}</span>
            </div>
          )}
        </div>
      </Card>

      {/* Export Actions Card */}
      {onExport && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Export Options</h3>
          </div>
          <div className="space-y-3">
            <button
              onClick={onExport}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Export Summary Report
            </button>
            <p className="text-xs text-muted-foreground text-center">
              Download detailed prediction analysis
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
