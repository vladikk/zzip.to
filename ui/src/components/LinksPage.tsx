import { useState, useEffect, useCallback } from 'react';
import { listLinks, createLink, deleteLink, type Link } from '../lib/api';
import AddLinkDialog from './AddLinkDialog';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import styles from './LinksPage.module.css';

export default function LinksPage() {
  const [links, setLinks] = useState<Link[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const fetchLinks = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await listLinks();
      setLinks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load links');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  async function handleCreate(key: string, value: string) {
    await createLink(key, value);
    fetchLinks();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteLink(deleteTarget);
      setDeleteTarget(null);
      await fetchLinks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete link');
    }
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <h2 className={styles.heading}>Links</h2>
        <button onClick={() => setShowAddDialog(true)} className={styles.addButton}>
          Add Link
        </button>
      </div>

      {error && <div className={styles.error} role="alert">{error}</div>}

      {isLoading ? (
        <p className={styles.loading}>Loading links...</p>
      ) : links.length === 0 ? (
        <p className={styles.empty}>No links yet. Add one to get started.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Key</th>
              <th className={styles.th}>Target URL</th>
              <th className={styles.thAction}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {links.map((link) => (
              <tr key={link.key} className={styles.row}>
                <td className={styles.td}>{link.key}</td>
                <td className={styles.td}>{link.value}</td>
                <td className={styles.tdAction}>
                  <button
                    onClick={() => setDeleteTarget(link.key)}
                    className={styles.deleteButton}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <AddLinkDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onSubmit={handleCreate}
      />

      <DeleteConfirmDialog
        open={deleteTarget !== null}
        linkKey={deleteTarget ?? ''}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
