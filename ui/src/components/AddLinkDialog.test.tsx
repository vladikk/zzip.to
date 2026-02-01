import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AddLinkDialog from './AddLinkDialog';

describe('AddLinkDialog', () => {
  const mockOnClose = vi.fn();
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when closed', () => {
    const { container } = render(
      <AddLinkDialog open={false} onClose={mockOnClose} onSubmit={mockOnSubmit} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders form when open', () => {
    render(<AddLinkDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />);

    expect(screen.getByLabelText('Key')).toBeInTheDocument();
    expect(screen.getByLabelText('Target URL')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Link' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('validates key must be alphanumeric with hyphens', async () => {
    const user = userEvent.setup();
    render(<AddLinkDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />);

    await user.type(screen.getByLabelText('Key'), 'bad key!');
    await user.type(screen.getByLabelText('Target URL'), 'https://example.com');
    await user.click(screen.getByRole('button', { name: 'Add Link' }));

    expect(screen.getByText('Key must be alphanumeric with hyphens only')).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('validates target URL must be valid', async () => {
    const user = userEvent.setup();
    render(<AddLinkDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />);

    await user.type(screen.getByLabelText('Key'), 'test');
    await user.type(screen.getByLabelText('Target URL'), 'not-a-url');
    await user.click(screen.getByRole('button', { name: 'Add Link' }));

    expect(screen.getByText('Must be a valid URL')).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('validates key is required', async () => {
    const user = userEvent.setup();
    render(<AddLinkDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />);

    await user.type(screen.getByLabelText('Target URL'), 'https://example.com');
    await user.click(screen.getByRole('button', { name: 'Add Link' }));

    expect(screen.getByText('Key is required')).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('submits valid form and closes', async () => {
    mockOnSubmit.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<AddLinkDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />);

    await user.type(screen.getByLabelText('Key'), 'my-link');
    await user.type(screen.getByLabelText('Target URL'), 'https://example.com');
    await user.click(screen.getByRole('button', { name: 'Add Link' }));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith('my-link', 'https://example.com');
    });
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('shows submit error', async () => {
    mockOnSubmit.mockRejectedValue(new Error('Server error'));
    const user = userEvent.setup();
    render(<AddLinkDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />);

    await user.type(screen.getByLabelText('Key'), 'test');
    await user.type(screen.getByLabelText('Target URL'), 'https://example.com');
    await user.click(screen.getByRole('button', { name: 'Add Link' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Server error');
    });
  });

  it('allows wildcard URLs ending with /*', async () => {
    mockOnSubmit.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<AddLinkDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />);

    await user.type(screen.getByLabelText('Key'), 'gh');
    await user.type(screen.getByLabelText('Target URL'), 'https://github.com/*');
    await user.click(screen.getByRole('button', { name: 'Add Link' }));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith('gh', 'https://github.com/*');
    });
  });

  it('calls onClose when cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<AddLinkDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockOnClose).toHaveBeenCalled();
  });
});
