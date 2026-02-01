import { useState, type FormEvent } from 'react';
import { z } from 'zod/v4';
import styles from './AddLinkDialog.module.css';

const linkKeySchema = z.string().min(1, 'Key is required').regex(/^[a-zA-Z0-9_-]+$/, 'Key must be alphanumeric with hyphens and underscores only');
const linkValueSchema = z.string().min(1, 'Target URL is required').regex(/^https?:\/\/[a-zA-Z0-9][a-zA-Z0-9.\-]+(:\d+)?(\/.*)?$/, 'Must be a valid HTTP/HTTPS URL');

interface AddLinkDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (key: string, value: string) => Promise<void>;
}

export default function AddLinkDialog({ open, onClose, onSubmit }: AddLinkDialogProps) {
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [errors, setErrors] = useState<{ key?: string; value?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  if (!open) return null;

  function validate(): boolean {
    const newErrors: { key?: string; value?: string } = {};
    const keyResult = linkKeySchema.safeParse(key);
    if (!keyResult.success) {
      newErrors.key = keyResult.error.issues[0].message;
    }

    // Allow URLs ending with /* for wildcard redirects
    const valueToValidate = value.endsWith('/*') ? value.slice(0, -2) : value;
    const valueResult = linkValueSchema.safeParse(valueToValidate);
    if (!valueResult.success) {
      newErrors.value = valueResult.error.issues[0].message;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError('');
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(key, value);
      setKey('');
      setValue('');
      setErrors({});
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create link');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleClose() {
    setKey('');
    setValue('');
    setErrors({});
    setSubmitError('');
    onClose();
  }

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Add Link">
        <h2 className={styles.title}>Add Link</h2>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="link-key" className={styles.label}>Key</label>
            <input
              id="link-key"
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className={styles.input}
              placeholder="my-link"
              disabled={isSubmitting}
            />
            {errors.key && <span className={styles.fieldError}>{errors.key}</span>}
          </div>
          <div className={styles.field}>
            <label htmlFor="link-value" className={styles.label}>Target URL</label>
            <input
              id="link-value"
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className={styles.input}
              placeholder="https://example.com"
              disabled={isSubmitting}
            />
            {errors.value && <span className={styles.fieldError}>{errors.value}</span>}
          </div>
          {submitError && <div className={styles.error} role="alert">{submitError}</div>}
          <div className={styles.actions}>
            <button type="button" onClick={handleClose} className={styles.cancelButton} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className={styles.submitButton} disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add Link'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
