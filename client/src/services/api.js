const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.success) {
    const error = new Error(body.error?.message || 'The request could not be completed. Check your connection and try again.');
    error.code = body.error?.code;
    error.status = response.status;
    throw error;
  }
  return body.data;
}

export const api = {
  session: () => request('/session', { method: 'POST' }),
  createCase: (payload) => request('/cases', { method: 'POST', body: JSON.stringify(payload) }),
  status: (id) => request(`/cases/${encodeURIComponent(id)}/status`),
  getCase: (id) => request(`/cases/${encodeURIComponent(id)}`),
  evidence: (id, evidenceId) => request(`/cases/${encodeURIComponent(id)}/evidence/${encodeURIComponent(evidenceId)}`),
  saveProgress: (id, viewedEvidenceIds) => request(`/cases/${encodeURIComponent(id)}/investigation`, { method: 'PATCH', body: JSON.stringify({ viewedEvidenceIds }) }),
  accuse: (id, suspectId, reasoning) => request(`/cases/${encodeURIComponent(id)}/accusation`, { method: 'POST', body: JSON.stringify({ suspectId, reasoning }) }),
  results: (id) => request(`/cases/${encodeURIComponent(id)}/results`),
};
