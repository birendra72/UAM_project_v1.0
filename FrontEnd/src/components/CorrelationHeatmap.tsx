import React, { useEffect, useRef } from 'react';
import Plotly from 'plotly.js';

interface CorrelationData {
  top_correlations: Array<{
    col1: string;
    col2: string;
    correlation: number;
  }>;
}

interface CorrelationHeatmapProps {
  correlations: CorrelationData;
}

export default function CorrelationHeatmap({ correlations }: CorrelationHeatmapProps) {
  const plotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!plotRef.current || !correlations.top_correlations || correlations.top_correlations.length === 0) {
      return;
    }

    // Capture the current ref value at the start of the effect
    const currentPlotRef = plotRef.current;

    // Extract unique column names
    const columns = Array.from(new Set(
      correlations.top_correlations.flatMap(corr => [corr.col1, corr.col2])
    ));

    // Create correlation matrix
    const matrix: number[][] = [];
    for (let i = 0; i < columns.length; i++) {
      matrix[i] = new Array(columns.length).fill(0);
    }

    // Fill matrix with correlation values
    correlations.top_correlations.forEach(corr => {
      const i = columns.indexOf(corr.col1);
      const j = columns.indexOf(corr.col2);
      if (i !== -1 && j !== -1) {
        matrix[i][j] = corr.correlation;
        matrix[j][i] = corr.correlation; // Symmetric matrix
      }
    });

    // Create heatmap data
    const data = [{
      z: matrix,
      x: columns,
      y: columns,
      type: 'heatmap' as const,
      colorscale: 'RdBu' as const,
      showscale: true,
      hoverongaps: false,
      hovertemplate: '%{x} vs %{y}<br>Correlation: %{z:.3f}<extra></extra>'
    }];

    // Layout configuration
    const layout = {
      title: {
        text: 'Correlation Heatmap',
        font: { size: 16, color: '#374151' }
      },
      xaxis: {
        tickangle: -45,
        tickfont: { size: 10 },
        side: 'bottom' as const
      },
      yaxis: {
        tickfont: { size: 10 }
      },
      margin: {
        l: 80,
        r: 80,
        t: 60,
        b: 80
      },
      height: 500,
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)'
    };

    // Plot configuration
    const config = {
      displayModeBar: true,
      displaylogo: false,
      responsive: true
    };

    // Create plot
    Plotly.newPlot(currentPlotRef, data, layout, config);

    // Cleanup on unmount
    return () => {
      if (currentPlotRef) {
        Plotly.purge(currentPlotRef);
      }
    };
  }, [correlations]);

  if (!correlations.top_correlations || correlations.top_correlations.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No significant correlations found to display</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div ref={plotRef} className="w-full" />
    </div>
  );
}
