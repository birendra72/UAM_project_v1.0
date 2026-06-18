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

    const currentPlotRef = plotRef.current;

    // Extract unique column names
    const columns = Array.from(new Set(
      correlations.top_correlations.flatMap(corr => [corr.col1, corr.col2])
    ));

    // Create correlation matrix
    const matrix: number[][] = [];
    for (let i = 0; i < columns.length; i++) {
      matrix[i] = new Array(columns.length).fill(0);
      matrix[i][i] = 1.0; // Self-correlation is always 1.0
    }

    // Fill matrix with correlation values
    correlations.top_correlations.forEach(corr => {
      const i = columns.indexOf(corr.col1);
      const j = columns.indexOf(corr.col2);
      if (i !== -1 && j !== -1) {
        matrix[i][j] = corr.correlation;
        matrix[j][i] = corr.correlation;
      }
    });

    // Custom dark-mode cohesive colorscale
    // From Cyan (-1.0) -> Slate (0.0) -> Violet (1.0)
    const customColorscale: Array<[number, string]> = [
      [0.0, '#06b6d4'],  // Cyan
      [0.5, '#0f172a'],  // Slate Background
      [1.0, '#7c3aed']   // Violet
    ];

    // Create heatmap data
    const data = [{
      z: matrix,
      x: columns,
      y: columns,
      type: 'heatmap' as const,
      colorscale: customColorscale,
      showscale: true,
      hoverongaps: false,
      hovertemplate: '%{x} vs %{y}<br>Correlation: %{z:.3f}<extra></extra>',
      colorbar: {
        tickfont: { size: 10, color: '#94a3b8', family: 'JetBrains Mono, monospace' },
        thickness: 16,
        len: 0.95
      }
    }];

    // Layout configuration
    const layout = {
      xaxis: {
        tickangle: -45,
        tickfont: { size: 10, color: '#94a3b8', family: 'Inter, sans-serif' },
        side: 'bottom' as const,
        gridcolor: 'rgba(255,255,255,0.03)',
        zeroline: false
      },
      yaxis: {
        tickfont: { size: 10, color: '#94a3b8', family: 'Inter, sans-serif' },
        gridcolor: 'rgba(255,255,255,0.03)',
        zeroline: false
      },
      margin: {
        l: 90,
        r: 30,
        t: 20,
        b: 90
      },
      height: 420,
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)'
    };

    // Plot configuration
    const config = {
      displayModeBar: false,
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
        <p className="font-body text-xs">No significant correlations found to display</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden rounded-xl border border-slate-900 bg-slate-950/20 p-4">
      <div ref={plotRef} className="w-full" />
    </div>
  );
}
