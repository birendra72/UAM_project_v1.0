import React, { useEffect, useRef } from 'react';
import Plotly from 'plotly.js';

interface DistributionData {
  [columnName: string]: {
    mean: number;
    median: number;
    std: number;
    skewness: number;
    kurtosis: number;
    outliers_count: number;
  };
}

interface DistributionChartProps {
  distributions: DistributionData;
}

export default function DistributionChart({ distributions }: DistributionChartProps) {
  const plotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!plotRef.current || !distributions || Object.keys(distributions).length === 0) {
      return;
    }

    // Capture the current ref value at the start of the effect
    const currentPlotRef = plotRef.current;

    const columns = Object.keys(distributions);
    const data = columns.map((col, index) => {
      const colData = distributions[col];
      return {
        x: [colData.mean - colData.std, colData.mean, colData.median, colData.mean + colData.std],
        y: [col, col, col, col],
        type: 'scatter' as const,
        mode: 'lines+markers' as const,
        name: col,
        line: { color: `hsl(${index * 360 / columns.length}, 70%, 50%)` },
        marker: { size: 8 },
        showlegend: false,
        hovertemplate: `${col}<br>Mean: %{x:.2f}<extra></extra>`
      };
    });

    // Add box plot data for better visualization
    const boxData = columns.map((col, index) => {
      const colData = distributions[col];
      // Create synthetic box plot data based on available stats
      const q1 = colData.mean - colData.std * 0.675;
      const q3 = colData.mean + colData.std * 0.675;
      const min = colData.mean - colData.std * 2;
      const max = colData.mean + colData.std * 2;

      return {
        type: 'box' as const,
        x: [min, q1, colData.median, q3, max],
        name: col,
        boxpoints: false as const,
        line: { color: `hsl(${index * 360 / columns.length}, 70%, 50%)` },
        fillcolor: `hsla(${index * 360 / columns.length}, 70%, 50%, 0.1)`,
        hovertemplate: `${col}<br>Min: ${min.toFixed(2)}<br>Q1: ${q1.toFixed(2)}<br>Median: ${colData.median.toFixed(2)}<br>Q3: ${q3.toFixed(2)}<br>Max: ${max.toFixed(2)}<extra></extra>`
      };
    });

    const layout = {
      title: {
        text: 'Data Distributions',
        font: { size: 16, color: '#374151' }
      },
      xaxis: {
        title: { text: 'Value' },
        tickfont: { size: 10 }
      },
      yaxis: {
        title: { text: 'Column' },
        tickfont: { size: 10 }
      },
      margin: {
        l: 80,
        r: 80,
        t: 60,
        b: 60
      },
      height: 400,
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      showlegend: false
    };

    const config = {
      displayModeBar: true,
      displaylogo: false,
      responsive: true
    };

    // Create plot
    Plotly.newPlot(currentPlotRef, [...data, ...boxData], layout, config);

    // Cleanup on unmount
    return () => {
      if (currentPlotRef) {
        Plotly.purge(currentPlotRef);
      }
    };
  }, [distributions]);

  if (!distributions || Object.keys(distributions).length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No distribution data available</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div ref={plotRef} className="w-full" />
    </div>
  );
}
