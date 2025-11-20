import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  // datasetName: string;
  itemName:   string;
  itemType: string;
}

export default function DeleteConfirmationModal({ isOpen, onClose, onConfirm, itemName, itemType = "dataset" }: DeleteConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-background rounded-xl border border-border p-8 max-w-md w-full m-4">
        <div className="flex items-start">
          <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-destructive/10 sm:mx-0 sm:h-10 sm:w-10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <div className="ml-4 text-left">
            <h3 className="text-xl font-bold text-foreground" id="modal-title">
              Delete {itemType === 'report' ? 'Report' : 'Dataset'}
            </h3>
            <div className="mt-2">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete <strong className="text-foreground">{itemName}</strong>? This action cannot be undone.
                {itemType === 'report' ? ' The report file will be permanently removed.' : ' All associated projects and models will also be affected.'}
              </p>
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end space-x-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
