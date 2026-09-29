import type { ReviewResult } from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export async function reviewContracts(oldDoc: unknown, newDoc: unknown): Promise<ReviewResult> {
  const response = await fetch(`${API_BASE_URL}/api/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ old: oldDoc, new: newDoc }),
  });
  const payload = await response.json();
  if (!response.ok) {
    const detail = payload?.detail;
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail ?? payload, null, 2));
  }
  return payload as ReviewResult;
}
