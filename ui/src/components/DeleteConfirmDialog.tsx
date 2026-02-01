import { useState } from 'react';
import styles from './AddLinkDialog.module.css';

interface DeleteConfirmDialogProps {
  open: boolean;
  linkKey: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export default function DeleteConfirmDialog({ open, linkKey, onClose, onConfirm }: DeleteConfirmDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!open) return null;

  async function handleConfirm() {
    setIsDeleting(true);
    try {
      await onConfirm();
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={isDeleting ? undefined : onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()} role="alertdialog" aria-label="Delete Link">
        <h2 className={styles.title}>Delete Link</h2>
        <p>Are you sure you want to delete the link <strong>{linkKey}</strong>? This action cannot be undone.</p>
        <div className={styles.actions}>
          <button onClick={onClose} className={styles.cancelButton} disabled={isDeleting}>Cancel</button>
          <button onClick={handleConfirm} className={styles.submitButton} style={{ backgroundColor: '#d32f2f' }} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
