// Import axios library
import axios from 'axios';

// Create a configured axios instance
const api = axios.create({
  // Base URL for the ChatSphere backend
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
});

// Add a request interceptor to automatically attach the JWT token
api.interceptors.request.use(
  (config) => {
    // Retrieve the token from localStorage
    const token = localStorage.getItem('token');
    
    // If a token exists, add it to the Authorization header
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    // Handle request errors
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle expired or invalid JWT tokens
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If backend returns 401 or 403, the session is invalid/expired
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      localStorage.clear();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Export the configured instance as the default export
export default api;
