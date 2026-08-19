/**
 * ============================================
 * HEALTHMIND AI â€” AUTHENTICATION SERVICE
 * ============================================
 */

import API from './api.js';

const AuthService = (() => {
    // ===== LOCAL STORAGE HELPERS =====
  // The authenticated user snapshot is persisted so the role/navigation resolve
  // synchronously on reload (before the async /auth/me round-trip).

  const STORE_KEY = 'healthmind_auth_user';

  const getStoredUser = () => {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORE_KEY);
        return raw ? JSON.parse(raw) : null;
      }
    } catch (e) {
      // corrupted / unavailable storage
    }
    return null;
  };

  const persistUser = () => {
    try {
      if (typeof localStorage === 'undefined') return;
      if (currentUser) {
        localStorage.setItem(STORE_KEY, JSON.stringify(currentUser));
      } else {
        localStorage.removeItem(STORE_KEY);
      }
    } catch (e) {
      // ignore storage errors
    }
  };

  const clearStoredUser = () => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORE_KEY);
      }
    } catch (e) {}
  };

  // ===== USER STATE =====

    let currentUser = getStoredUser();
  let userRole = currentUser?.role || null;
  const listeners = [];

  // ===== AUTHENTICATION =====

  const login = async (email, password) => {
    try {
      const response = await API.post('/auth/login', { email, password });
      
      // Store tokens
      API.setTokens(response.access_token, response.refresh_token);
      
      // Set user
      currentUser = response.user;
      userRole = response.user?.role || 'patient';
      
      // Notify listeners
        persistUser();
  notifyListeners('login', { user: currentUser });
      
      return response;
    } catch (error) {
      throw error;
    }
  };

  const register = async (userData) => {
    try {
      const response = await API.post('/auth/register', userData);
      
      // Store tokens if auto-login
      if (response.access_token) {
        API.setTokens(response.access_token, response.refresh_token);
        currentUser = response.user;
        userRole = response.user?.role || 'patient';
          persistUser();
  notifyListeners('register', { user: currentUser });
      }
      
      return response;
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      await API.post('/auth/logout', {});
    } catch (error) {
      // Ignore errors on logout
    } finally {
      // Clear tokens and user state
            API.clearTokens();
      currentUser = null;
      userRole = null;
      clearStoredUser();
      notifyListeners('logout', {});
    }
  };

  const refreshToken = async () => {
    try {
      const newToken = await API.refreshAccessToken();
      return newToken;
    } catch (error) {
      // Force logout on refresh failure
      await logout();
      throw error;
    }
  };

  // ===== USER MANAGEMENT =====

  const getCurrentUser = async () => {
        if (!API.getAccessToken()) {
      currentUser = null;
      userRole = null;
      clearStoredUser();
      return null;
    }

    try {
      const response = await API.get('/auth/me');
            currentUser = response.user;
      userRole = response.user?.role || 'patient';
      persistUser();
      return currentUser;
    } catch (error) {
      // Token might be invalid
      if (error.status === 401) {
        await logout();
      }
      throw error;
    }
  };

  const updateProfile = async (profileData) => {
    try {
      const response = await API.put('/users/profile', profileData);
            currentUser = response.user;
      userRole = response.user?.role || 'patient';
      persistUser();
      notifyListeners('profileUpdate', { user: currentUser });
      return response;
    } catch (error) {
      throw error;
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      const response = await API.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      return response;
    } catch (error) {
      throw error;
    }
  };

  const forgotPassword = async (email) => {
    try {
      const response = await API.post('/auth/forgot-password', { email });
      return response;
    } catch (error) {
      throw error;
    }
  };

  const resetPassword = async (token, newPassword) => {
    try {
      const response = await API.post('/auth/reset-password', {
        token,
        new_password: newPassword,
      });
      return response;
    } catch (error) {
      throw error;
    }
  };

  const deleteAccount = async (password, confirmation) => {
    try {
      const response = await API.delete('/users/delete', {
        body: JSON.stringify({ password, confirmation }),
      });
      await logout();
      return response;
    } catch (error) {
      throw error;
    }
  };

  // ===== ROLE MANAGEMENT =====

  const getRole = () => {
    return userRole || currentUser?.role || 'patient';
  };

  const hasRole = (role) => {
    const userRole = getRole();
    if (Array.isArray(role)) {
      return role.includes(userRole);
    }
    return userRole === role;
  };

  const isAuthenticated = () => {
    return !!API.getAccessToken();
  };

  const getUser = () => currentUser;

  // ===== EVENT LISTENERS =====

  const subscribe = (callback) => {
    listeners.push(callback);
    return () => {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  };

  const notifyListeners = (event, data) => {
    listeners.forEach((callback) => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Error in auth listener:', error);
      }
    });
  };

  // ===== INITIALIZATION =====

  const init = async () => {
    // Check if we have a token
    if (isAuthenticated()) {
      try {
        await getCurrentUser();
        return true;
            } catch (error) {
        // Token invalid, clear state
        API.clearTokens();
        currentUser = null;
        userRole = null;
        clearStoredUser();
        return false;
      }
    }
    return false;
  };

  // ===== PUBLIC API =====

  return {
    // Authentication
    login,
    register,
    logout,
    refreshToken,
    
    // User management
    getCurrentUser,
    updateProfile,
    changePassword,
    forgotPassword,
    resetPassword,
    deleteAccount,
    getUser,
    
    // Role management
    getRole,
    hasRole,
    isAuthenticated,
    
    // Event system
    subscribe,
    init,
  };
})();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AuthService;
}
export default AuthService;
