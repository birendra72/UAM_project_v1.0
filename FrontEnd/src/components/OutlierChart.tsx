import React, { useEffect, useRef } from 'react';
import Plotly from 'plotly.js';

interface OutlierData {
  [columnName: string]: {
    count: number;
    lower_bound: number;
    upper_bound: number;
    outlier_values: number[];
    outlier_indices: number[];
    percentage: number;
  };
}

interface OutlierChartProps {
  outliers: OutlierData;
}

export default function OutlierChart({ outliers }: OutlierChartProps) {
  const plotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!plotRef.current || !outliers || Object.keys(outliers).length === 0) {
      return;
    }

    // Capture the current ref value at the start of the effect
    const currentPlotRef = plotRef.current;

    const columns = Object.keys(outliers);
    const data = [];

    // Create box plots for each column showing outliers
    columns.forEach((col, index) => {
      const colData = outliers[col];

      // Create synthetic box plot data based on bounds
      const q1 = colData.lower_bound;
      const q3 = colData.upper_bound;
      const median = (q1 + q3) / 2; // Approximate median

      // Add box plot
      data.push({
        type: 'box' as const,
        name: col,
        x: [q1, q1, median, q3, q3],
        boxpoints: 'outliers' as const,
        jitter: 0.3,
        pointpos: 0,
        marker: {
          color: `hsl(${index * 360 / columns.length}, 70%, 50%)`,
          size: 6
        },
        line: { color: `hsl(${index * 360 / columns.length}, 70%, 50%)` },
        fillcolor: `hsla(${index * 360 / columns.length}, 70%, 50%, 0.1)`,
        hovertemplate: `${col}<br>Q1: ${q1.toFixed(2)}<br>Median: ${median.toFixed(2)}<br>Q3: ${q3.toFixed(2)}<extra></extra>`
      });

      // Add outlier points if available
      if (colData.outlier_values && colData.outlier_values.length > 0) {
        data.push({
          type: 'scatter' as const,
          mode: 'markers' as const,
          name: `${col} Outliers`,
          x: colData.outlier_values,
          y: Array(colData.outlier_values.length).fill(col),
          marker: {
            color: `hsl(${index * 360 / columns.length}, 70%, 50%)`,
            size: 8,
            symbol: 'diamond'
          },
          showlegend: false,
          hovertemplate: `${col}<br>Outlier: %{x:.2f}<br>Index: %{customdata}<extra></extra>`,
          customdata: colData.outlier_indices
        });
      }
    });

    const layout = {
      title: {
        text: 'Outlier Analysis by Column',
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
      showlegend: true,
      legend: {
        x: 1,
        y: 1,
        bgcolor: 'rgba(255,255,255,0.8)',
        bordercolor: '#e5e7eb',
        borderwidth: 1
      }
    };

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
  }, [outliers]);

  if (!outliers || Object.keys(outliers).length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No outlier data available</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div ref={plotRef} className="w-full" />
    </div>
  );
}
