const API_BASE = process.env.REACT_APP_API_GATEWAY_URL || 'http://localhost:3000';

const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const handleResponse = async (res) => {
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
};

export const authService = {
  login: (username, password) =>
    fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }).then(handleResponse),

  register: (userData) =>
    fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    }).then(handleResponse),
};

export const userService = {
  getAll: () =>
    fetch(`${API_BASE}/users`, { headers: getHeaders() }).then(handleResponse),

  getById: (id) =>
    fetch(`${API_BASE}/users/${id}`, { headers: getHeaders() }).then(handleResponse),

  update: (id, data) =>
    fetch(`${API_BASE}/users/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  delete: (id) =>
    fetch(`${API_BASE}/users/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    }).then(handleResponse),
};

export const dataService = {
  process: (payload) =>
    fetch(`${API_BASE}/data/process`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    }).then(handleResponse),

  getStats: () =>
    fetch(`${API_BASE}/data/stats`, { headers: getHeaders() }).then(handleResponse),
};

export const alertService = {
  getAlerts: () =>
    fetch(`${API_BASE}/data/alerts`, { headers: getHeaders() }).then(handleResponse),

  resolveAlert: (id) =>
    fetch(`${API_BASE}/data/alerts/${id}/resolve`, {
      method: 'POST',
      headers: getHeaders(),
    }).then(handleResponse),
};
