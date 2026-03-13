/**
 * Minimal fetch wrapper for the Bus Booking MVP API.
 */
const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:3001';

// PUBLIC_INTERFACE
export async function apiGet(path) {
  /** GET request helper. */
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// PUBLIC_INTERFACE
export async function apiPost(path, body, token) {
  /** POST request helper with optional Bearer token. */
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
