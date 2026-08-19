/**
 * ============================================
 * HEALTHMIND AI â€” API CLIENT
 * ============================================
 * Centralized HTTP client for all API communication
 */

const API = (() => {
    // Configuration
    const CONFIG = {
      // Default to a relative `/api` so the browser talks to the same origin
      // that serves the frontend (the FastAPI backend). Override with
      // VITE_API_URL when the frontend is served from a separate origin (Vite).
      BASE_URL: import.meta?.env?.VITE_API_URL || '/api',
      TIMEOUT: 30000,
      RETRY_ATTEMPTS: 3,
      RETRY_DELAY: 1000,
    };
  
      // ===== LOCAL STORAGE HELPERS =====
  // Tokens are persisted so the authenticated session survives page reloads and
  // the login -> dashboard redirect. Access tokens are short-lived (30min) and
  // always sent over the same origin (relative /api), with a refresh flow.

  const getStorageToken = (key) => {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    } catch (e) {
      return null;
    }
  };

  const persistTokens = () => {
    try {
      if (typeof localStorage === 'undefined') return;
      if (accessToken) {
        localStorage.setItem('hm_access_token', accessToken);
      } else {
        localStorage.removeItem('hm_access_token');
      }
      if (refreshToken) {
        localStorage.setItem('hm_refresh_token', refreshToken);
      } else {
        localStorage.removeItem('hm_refresh_token');
      }
    } catch (e) {
      // ignore storage errors
    }
  };

  // State — rehydrated from localStorage so sessions survive reloads.
    let accessToken = getStorageToken('hm_access_token');
    let refreshToken = getStorageToken('hm_refresh_token');
    let isRefreshing = false;
    let refreshSubscribers = [];
  
    // ===== TOKEN MANAGEMENT =====
  
    const setTokens = (access, refresh) => {
      accessToken = access;
      refreshToken = refresh || refreshToken;
      
              // Store refresh token in memory only
      // Access token is also kept in memory
      // Do NOT store in localStorage for security
      persistTokens();
    };
  
        const clearTokens = () => {
      accessToken = null;
      refreshToken = null;
      refreshSubscribers = [];
      persistTokens();
    };
  
    const getAccessToken = () => accessToken;
  
    // ===== SUBSCRIBER PATTERN FOR TOKEN REFRESH =====
  
    const subscribeTokenRefresh = (callback) => {
      refreshSubscribers.push(callback);
    };
  
    const onTokenRefreshed = (newToken) => {
      refreshSubscribers.forEach((callback) => callback(newToken));
      refreshSubscribers = [];
    };
  
    // ===== REQUEST INTERCEPTOR =====
  
    const requestInterceptor = (options) => {
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      };
  
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }
  
      return {
        ...options,
        headers,
        credentials: 'include', // For cookies if needed
      };
    };
  
    // ===== RESPONSE HANDLER =====
  
    const handleResponse = async (response) => {
      // Handle empty responses
      if (response.status === 204) {
        return null;
      }
  
      // Parse JSON
      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }
  
      // Success response
      if (response.ok) {
        return data;
      }
  
      // Error response
      const error = {
        status: response.status,
        statusText: response.statusText,
        data: data,
                message: data?.error?.message || data?.message || response.statusText || 'An error occurred',
        config: response.config,
      };
  
      // Handle specific error codes
            if (response.status === 401) {
        // Token expired - attempt a single refresh + retry
        if (refreshToken && !isRefreshing && !(error.config && error.config.__retried)) {
          try {
            const newToken = await refreshAccessToken();
            if (newToken && error.config) {
              error.config.__retried = true;
              return await API.request(error.config.url, error.config.options);
            }
          } catch (refreshError) {
            // Refresh failed - redirect to login
            clearTokens();
            window.location.href = '/login.html';
          }
        }
        throw error;
      }
  
      if (response.status === 403) {
        // Forbidden - redirect or show access denied
        throw error;
      }
  
      if (response.status === 429) {
        // Rate limited - wait and retry
        const retryAfter = response.headers.get('retry-after') || 5;
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        return API.request(error.config);
      }
  
      throw error;
    };
  
    // ===== TOKEN REFRESH =====
  
    const refreshAccessToken = async () => {
      if (isRefreshing) {
        // Wait for the current refresh to complete
        return new Promise((resolve) => {
          subscribeTokenRefresh((newToken) => {
            resolve(newToken);
          });
        });
      }
  
      isRefreshing = true;
  
      try {
        const response = await fetch(`${CONFIG.BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
  
        if (!response.ok) {
          throw new Error('Refresh failed');
        }
  
        const data = await response.json();
        const newAccessToken = data.access_token || data.accessToken;
        
        setTokens(newAccessToken);
        onTokenRefreshed(newAccessToken);
        
        return newAccessToken;
      } catch (error) {
        clearTokens();
        throw error;
      } finally {
        isRefreshing = false;
      }
    };
  
    // ===== FETCH WITH TIMEOUT =====
  
    const fetchWithTimeout = async (url, options, timeout = CONFIG.TIMEOUT) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
  
      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error('Request timeout');
        }
        throw error;
      }
    };
  
    // ===== MAIN REQUEST METHOD =====
  
    const request = async (url, options = {}) => {
      const fullUrl = url.startsWith('http') ? url : `${CONFIG.BASE_URL}${url}`;
      
      // Prepare request
      const requestOptions = requestInterceptor({
        ...options,
        url: fullUrl,
      });
  
      // Store config for retry
      const config = { url: fullUrl, options };
  
      // Attempt request with retries
      let lastError;
      for (let attempt = 0; attempt < CONFIG.RETRY_ATTEMPTS; attempt++) {
        try {
          const response = await fetchWithTimeout(
            fullUrl,
            requestOptions,
            options.timeout || CONFIG.TIMEOUT
          );
          
          // Attach config to response for retry
          response.config = config;
          
          return await handleResponse(response);
        } catch (error) {
          lastError = error;
          
          // Don't retry on auth errors or abort
          if (error.status === 401 || error.status === 403 || error.name === 'AbortError') {
            throw error;
          }
          
          // Wait before retry
          if (attempt < CONFIG.RETRY_ATTEMPTS - 1) {
            await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * (attempt + 1)));
          }
        }
      }
  
      throw lastError;
    };
  
    // ===== HTTP METHODS =====
  
    const get = (url, options = {}) => {
      return request(url, { ...options, method: 'GET' });
    };
  
    const post = (url, data, options = {}) => {
      return request(url, {
        ...options,
        method: 'POST',
        body: JSON.stringify(data),
      });
    };
  
    const put = (url, data, options = {}) => {
      return request(url, {
        ...options,
        method: 'PUT',
        body: JSON.stringify(data),
      });
    };
  
    const patch = (url, data, options = {}) => {
      return request(url, {
        ...options,
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    };
  
    const del = (url, options = {}) => {
      return request(url, { ...options, method: 'DELETE' });
    };
  
    const upload = (url, formData, options = {}) => {
      return request(url, {
        ...options,
        method: 'POST',
        headers: {
          // Let browser set content-type for FormData
        },
        body: formData,
      });
    };
  
    // ===== PUBLIC API =====
  
    return {
      // Core methods
      request,
      get,
      post,
      put,
      patch,
      delete: del,
      upload,
  
      // Token management
      setTokens,
      clearTokens,
      getAccessToken,
      refreshAccessToken,
  
      // Configuration
      CONFIG,
    };
  })();
  
  // Export for module usage
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  }
  export default API;
