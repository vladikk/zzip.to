import styles from './AddLinkDialog.module.css';

interface DeleteConfirmDialogProps {
  open: boolean;
  linkKey: string;
  onClose: () => void;
  onConfirm: () => void;
}

export default function DeleteConfirmDialog({ open, linkKey, onClose, onConfirm }: DeleteConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()} role="alertdialog" aria-label="Delete Link">
        <h2 className={styles.title}>Delete Link</h2>
        <p>Are you sure you want to delete the link <strong>{linkKey}</strong>? This action cannot be undone.</p>
        <div className={styles.actions}>
          <button onClick={onClose} className={styles.cancelButton}>Cancel</button>
          <button onClick={onConfirm} className={styles.submitButton} style={{ backgroundColor: '#d32f2f' }}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
