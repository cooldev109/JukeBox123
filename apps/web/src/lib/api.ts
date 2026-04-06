import axios from 'axios';

const API_BASE = '/api/v1';

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('jb_access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem('jb_refresh_token');
      // Only attempt refresh if user was logged in (has tokens)
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken });

          const { accessToken, refreshToken: newRefresh } = data.data.tokens;
          localStorage.setItem('jb_access_token', accessToken);
          localStorage.setItem('jb_refresh_token', newRefresh);

          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        } catch {
          // Refresh failed — clear tokens and redirect
          localStorage.removeItem('jb_access_token');
          localStorage.removeItem('jb_refresh_token');
          window.location.href = '/';
        }
      }
      // No tokens = not logged in — don't redirect, just reject
    }

    return Promise.reject(error);
  },
);
