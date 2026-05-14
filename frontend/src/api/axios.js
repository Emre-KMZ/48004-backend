import axios from 'axios';

const api = axios.create({
  // Default backend URL standard for Django, adjust if necessary
  baseURL: 'http://localhost:8000', 
});

// Request Interceptor: Attach token if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle global errors like 401 and 403
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const status = error.response.status;

      if (status === 401) {
        // Session invalid or expired: clear state and redirect to login
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        
        // Prevent infinite redirect loops if already on login
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      } else if (status === 403) {
        // Forbidden: prevent access to unauthorized route
        if (window.location.pathname !== '/unauthorized') {
          window.location.href = '/unauthorized';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
