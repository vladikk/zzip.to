import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LinksPage from './LinksPage';

const mockListLinks = vi.fn();
const mockCreateLink = vi.fn();
const mockDeleteLink = vi.fn();

vi.mock('../lib/api', () => ({
  listLinks: (...args: unknown[]) => mockListLinks(...args),
  createLink: (...args: unknown[]) => mockCreateLink(...args),
  deleteLink: (...args: unknown[]) => mockDeleteLink(...args),
}));

describe('LinksPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state then renders links table', async () => {
    mockListLinks.mockResolvedValue([
      { key: 'gh', value: 'https://github.com' },
      { key: 'aws', value: 'https://console.aws.amazon.com' },
    ]);

    render(<LinksPage />);

    expect(screen.getByText('Loading links...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('gh')).toBeInTheDocument();
    });
    expect(screen.getByText('https://github.com')).toBeInTheDocument();
    expect(screen.getByText('aws')).toBeInTheDocument();
  });

  it('shows empty state when no links', async () => {
    mockListLinks.mockResolvedValue([]);

    render(<LinksPage />);

    await waitFor(() => {
      expect(screen.getByText('No links yet. Add one to get started.')).toBeInTheDocument();
    });
  });

  it('shows error when loading fails', async () => {
    mockListLinks.mockRejectedValue(new Error('Network error'));

    render(<LinksPage />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Network error');
    });
  });

  it('opens add dialog and creates a link', async () => {
    mockListLinks.mockResolvedValue([]);
    mockCreateLink.mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<LinksPage />);

    await waitFor(() => {
      expect(screen.getByText('Add Link')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Add Link' }));

    const dialog = screen.getByRole('dialog', { name: 'Add Link' });
    expect(dialog).toBeInTheDocument();

    await user.type(screen.getByLabelText('Key'), 'test');
    await user.type(screen.getByLabelText('Target URL'), 'https://example.com');

    const submitButton = dialog.querySelector('button[type="submit"]')!;
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockCreateLink).toHaveBeenCalledWith('test', 'https://example.com');
    });
  });

  it('opens delete confirmation and deletes a link', async () => {
    mockListLinks.mockResolvedValue([{ key: 'gh', value: 'https://github.com' }]);
    mockDeleteLink.mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<LinksPage />);

    await waitFor(() => {
      expect(screen.getByText('gh')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    const dialog = screen.getByRole('alertdialog', { name: 'Delete Link' });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent(/gh/);

    const confirmButton = Array.from(dialog.querySelectorAll('button')).find(b => b.textContent === 'Delete')!;
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockDeleteLink).toHaveBeenCalledWith('gh');
    });
  });
});
