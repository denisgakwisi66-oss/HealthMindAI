/**
 * ============================================
 * HEALTHMIND AI — API CLIENT
 * ============================================
 * Centralized HTTP client for our own backend (FastAPI). Authentication
 * itself lives with Supabase (see supabase-client.js / auth.js) — this
 * module only attaches whatever access token that session currently holds.
 */

import { getSupabase } from './supabase-client.js';

const API = (() => {
  const CONFIG = {
    BASE_URL: import.meta?.env?.VITE_API_URL || '/api',
    TIMEOUT: 30000,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000,
  };

  const getAccessToken = async () => {
    try {
      const supabase = await getSupabase();
      const { data } = await supabase.auth.getSession();
      return data?.session?.access_token || null;
    } catch (e) {
      return null;
    }
  };

  const requestInterceptor = async (options) => {
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const headers = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      'Accept': 'application/json',
      ...options.headers,
    };

    const token = await getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return {
      ...options,
      headers,
    };
  };

  const handleResponse = async (response) => {
    if (response.status === 204) {
      return null;
    }

    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (response.ok) {
      return data;
    }

    const error = {
      status: response.status,
      statusText: response.statusText,
      data,
      message: data?.error?.message || data?.message || response.statusText || 'An error occurred',
    };

    if (response.status === 401) {
      // The Supabase session is missing/expired and re-fetching it won't
      // help synchronously here — send the user back to log in.
      window.location.href = '/login.html';
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after') || 5;
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
    }

    throw error;
  };

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

  const request = async (url, options = {}) => {
    const fullUrl = url.startsWith('http') ? url : `${CONFIG.BASE_URL}${url}`;
    const requestOptions = await requestInterceptor(options);

    let lastError;
    for (let attempt = 0; attempt < CONFIG.RETRY_ATTEMPTS; attempt++) {
      try {
        const response = await fetchWithTimeout(fullUrl, requestOptions, options.timeout || CONFIG.TIMEOUT);
        return await handleResponse(response);
      } catch (error) {
        lastError = error;
        // Only retry genuinely transient failures — a network error (no
        // status at all) or a 5xx from the server. Any 4xx (400, 401, 403,
        // 404, 409, 422, 429...) is a definitive rejection of this exact
        // request; retrying it identically can never produce a different
        // result and just delays the user seeing the real error.
        const isClientError = typeof error.status === 'number' && error.status >= 400 && error.status < 500;
        if (isClientError || error.name === 'AbortError') {
          throw error;
        }
        if (attempt < CONFIG.RETRY_ATTEMPTS - 1) {
          await new Promise((resolve) => setTimeout(resolve, CONFIG.RETRY_DELAY * (attempt + 1)));
        }
      }
    }

    throw lastError;
  };

  const get = (url, options = {}) => request(url, { ...options, method: 'GET' });
  const post = (url, data, options = {}) => request(url, { ...options, method: 'POST', body: JSON.stringify(data) });
  const put = (url, data, options = {}) => request(url, { ...options, method: 'PUT', body: JSON.stringify(data) });
  const patch = (url, data, options = {}) => request(url, { ...options, method: 'PATCH', body: JSON.stringify(data) });
  const del = (url, options = {}) => request(url, { ...options, method: 'DELETE' });
  const upload = (url, formData, options = {}) => request(url, {
    ...options,
    method: 'POST',
    headers: {}, // let the browser set multipart content-type/boundary
    body: formData,
  });

  return {
    request,
    get,
    post,
    put,
    patch,
    delete: del,
    upload,
    getAccessToken,
    CONFIG,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = API;
}
export default API;
