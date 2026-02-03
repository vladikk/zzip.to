import { fetchAuthSession } from 'aws-amplify/auth';

function getApiEndpoint(): string {
  const endpoint = import.meta.env.VITE_API_ENDPOINT;
  if (!endpoint) {
    throw new Error('VITE_API_ENDPOINT environment variable is not configured. See .env.example for required variables.');
  }
  return endpoint;
}

export interface Link {
  key: string;
  value: string;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  if (!token) {
    throw new Error('Not authenticated');
  }
  return {
    Authorization: token,
    'Content-Type': 'application/json',
  };
}

export async function listLinks(): Promise<Link[]> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${getApiEndpoint()}/links`, { headers });
  if (!response.ok) {
    throw new Error(`Failed to list links: ${response.status}`);
  }
  return response.json();
}

export async function createLink(key: string, value: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${getApiEndpoint()}/links/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ value }),
  });
  if (!response.ok) {
    const body = await response.text();
    let message = `Failed to create link: ${response.status}`;
    try {
      const parsed = JSON.parse(body);
      if (parsed.error) message = parsed.error;
    } catch {
      if (body) message = body;
    }
    throw new Error(message);
  }
}

export async function deleteLink(key: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${getApiEndpoint()}/links/${encodeURIComponent(key)}`, {
    method: 'DELETE',
    headers,
  });
  if (!response.ok) {
    throw new Error(`Failed to delete link: ${response.status}`);
  }
}
