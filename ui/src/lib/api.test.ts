import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listLinks, createLink, deleteLink } from './api';

const mockFetchAuthSession = vi.fn();
vi.mock('aws-amplify/auth', () => ({
  fetchAuthSession: (...args: unknown[]) => mockFetchAuthSession(...args),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    import.meta.env.VITE_API_ENDPOINT = 'https://api.example.com';
    mockFetchAuthSession.mockResolvedValue({
      tokens: { idToken: { toString: () => 'test-token-123' } },
    });
  });

  describe('listLinks', () => {
    it('fetches links with auth header', async () => {
      const links = [{ key: 'gh', value: 'https://github.com' }];
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(links),
      });

      const result = await listLinks();

      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/links', {
        headers: { Authorization: 'test-token-123', 'Content-Type': 'application/json' },
      });
      expect(result).toEqual(links);
    });

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 });

      await expect(listLinks()).rejects.toThrow('Failed to list links: 500');
    });

    it('throws when not authenticated', async () => {
      mockFetchAuthSession.mockResolvedValue({ tokens: undefined });

      await expect(listLinks()).rejects.toThrow('Not authenticated');
    });
  });

  describe('createLink', () => {
    it('sends PUT with key and value', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      await createLink('gh', 'https://github.com');

      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/links/gh', {
        method: 'PUT',
        headers: { Authorization: 'test-token-123', 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: 'https://github.com' }),
      });
    });

    it('encodes special characters in key', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      await createLink('my link', 'https://example.com');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/links/my%20link',
        expect.any(Object),
      );
    });

    it('throws with response body on failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Key already exists'),
      });

      await expect(createLink('gh', 'https://github.com')).rejects.toThrow('Key already exists');
    });
  });

  describe('deleteLink', () => {
    it('sends DELETE request', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      await deleteLink('gh');

      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/links/gh', {
        method: 'DELETE',
        headers: { Authorization: 'test-token-123', 'Content-Type': 'application/json' },
      });
    });

    it('throws on failure', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 404 });

      await expect(deleteLink('gh')).rejects.toThrow('Failed to delete link: 404');
    });
  });
});
