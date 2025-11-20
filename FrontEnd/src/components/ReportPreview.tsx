import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X, Eye, AlertCircle, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

interface ReportPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  artifactId: string;
  filename: string;
  format: string;
  onDownload?: () => void;
}

export default function ReportPreview({
  isOpen,
  onClose,
  artifactId,
  filename,
  format,
  onDownload
}: ReportPreviewProps) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:8000`;
      const token = localStorage.getItem('access_token');

      const response = await fetch(`${baseUrl}/api/reports/${artifactId}/preview`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (format === 'html') {
        const htmlContent = await response.text();
        setContent(htmlContent);
      } else if (format === 'pdf') {
        // For PDF, we'll show a placeholder since inline PDF preview is complex
        setContent(`<div style="text-align: center; padding: 50px; color:black;">
          <h3>PDF Report Preview</h3>
          <p>PDF reports cannot be previewed inline. Click download to view the report.</p>
          <p><strong>File:</strong> ${filename}</p>
        </div>`);
      } else {
        const textContent = await response.text();
        setContent(`<pre>${textContent}</pre>`);
      }
    } catch (err) {
      console.error('Preview failed:', err);
      setError('Failed to load report preview');
      toast.error('Failed to load report preview');
    } finally {
      setLoading(false);
    }
  }, [artifactId, format, filename]);

  useEffect(() => {
    if (isOpen && artifactId) {
      loadPreview();
    }
  }, [isOpen, artifactId, loadPreview]);

  const handleDownload = async () => {
    try {
      const response = await apiClient.getReportDownloadUrl(artifactId);
      // Create download link
      const link = document.createElement('a');
      link.href = response.download_url;
      link.download = response.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Report downloaded successfully!');
      onDownload?.();
    } catch (err) {
      console.error('Download failed:', err);
      toast.error('Failed to download report');
    }
  };

  return (
    <Dialog open={isOpen}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <Eye className="h-5 w-5 mr-2" />
              Report Preview: {filename}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                disabled={loading}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mr-2" />
              <span>Loading preview...</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12 text-destructive">
              <AlertCircle className="h-8 w-8 mr-2" />
              <span>{error}</span>
            </div>
          ) : (
            <div
              className="w-full h-full min-h-[400px] border rounded-lg bg-white"
              dangerouslySetInnerHTML={{ __html: content }}
              style={{
                maxHeight: '60vh',
                overflow: 'auto'
              }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
