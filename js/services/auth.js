/**
 * ============================================
 * HEALTHMIND AI — AUTHENTICATION SERVICE
 * ============================================
 * Signup, login, logout, and password reset are Supabase Auth's job — this
 * module wraps the Supabase client for those, then asks our own backend
 * (GET /auth/me) for the application-specific profile row (role, full_name,
 * etc.) that Supabase itself doesn't know about.
 */

import API from './api.js';
import { getSupabase } from './supabase-client.js';

const AuthService = (() => {
  let currentUser = null;
  const listeners = [];

  const notifyListeners = (event, data) => {
    listeners.forEach((callback) => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Error in auth listener:', error);
      }
    });
  };

  const normalizeError = (error) => ({
    status: error?.status || 400,
    message: error?.message || 'Something went wrong. Please try again.',
    data: { error: { message: error?.message } },
  });

  // ===== AUTHENTICATION =====

  const _establishSession = async (email, password) => {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw normalizeError(error);

    const me = await API.get('/auth/me');
    currentUser = me.user;
    return currentUser;
  };

  const register = async (userData) => {
    // Created server-side (Supabase Admin API, email_confirm: true) so
    // account creation never depends on the project's dashboard-level
    // "Confirm email" setting — the account is ready to log into
    // immediately, no confirmation email in the loop at all.
    await API.post('/auth/register', {
      full_name: userData.full_name,
      email: userData.email,
      password: userData.password,
      phone: userData.phone || null,
      date_of_birth: userData.date_of_birth || null,
      role: userData.role || 'patient',
    });

    // Best-effort admin notification — never let this block registration.
    API.post('/notify/user-registered', { email: userData.email }).catch(() => {});

    // Sign in immediately with the same credentials, exactly like a
    // returning user — this is what actually establishes the session.
    const user = await _establishSession(userData.email, userData.password);
    notifyListeners('register', { user });
    return { needsEmailConfirmation: false, user };
  };

  const login = async (email, password) => {
    const user = await _establishSession(email, password);
    notifyListeners('login', { user });
    return { user };
  };

  const loginWithGoogle = async () => {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard.html` },
    });
    if (error) throw normalizeError(error);
  };

  const logout = async () => {
    try {
      const supabase = await getSupabase();
      await supabase.auth.signOut();
    } catch (error) {
      // Ignore errors on logout — we still clear local state below.
    } finally {
      currentUser = null;
      notifyListeners('logout', {});
    }
  };

  // ===== USER MANAGEMENT =====

  const getCurrentUser = async () => {
    const supabase = await getSupabase();
    const { data } = await supabase.auth.getSession();
    if (!data?.session) {
      currentUser = null;
      return null;
    }
    try {
      const response = await API.get('/auth/me');
      currentUser = response.user;
      return currentUser;
    } catch (error) {
      if (error.status === 401) {
        currentUser = null;
      }
      throw error;
    }
  };

  const updateProfile = async (profileData) => {
    const response = await API.put('/users/profile', profileData);
    currentUser = response.user;
    notifyListeners('profileUpdate', { user: currentUser });
    return response;
  };

  const changePassword = async (newPassword) => {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw normalizeError(error);
    return { message: 'Password updated successfully.' };
  };

  const forgotPassword = async (email) => {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password.html`,
    });
    if (error) throw normalizeError(error);
    return { message: 'If that email exists in our system, password reset instructions have been sent.' };
  };

  const resetPassword = async (newPassword) => {
    // The recovery session is already active at this point — Supabase's
    // client established it from the URL the reset-password email linked to.
    const supabase = await getSupabase();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw normalizeError(error);
    return { message: 'Password reset completed. Please log in with your new password.' };
  };

  const hasRecoverySession = async () => {
    const supabase = await getSupabase();
    const { data } = await supabase.auth.getSession();
    return !!data?.session;
  };

  const deleteAccount = async () => {
    const response = await API.delete('/users/delete', {
      body: JSON.stringify({ confirmation: 'delete' }),
    });
    await logout();
    return response;
  };

  // ===== ROLE MANAGEMENT =====

  const getRole = () => currentUser?.role || 'patient';

  const hasRole = (role) => {
    const role_ = getRole();
    if (Array.isArray(role)) return role.includes(role_);
    return role_ === role;
  };

  const isAuthenticated = () => !!currentUser;

  const getUser = () => currentUser;

  // ===== EVENT LISTENERS =====

  const subscribe = (callback) => {
    listeners.push(callback);
    return () => {
      const index = listeners.indexOf(callback);
      if (index > -1) listeners.splice(index, 1);
    };
  };

  // ===== INITIALIZATION =====

  const init = async () => {
    try {
      const user = await getCurrentUser();
      return !!user;
    } catch (error) {
      currentUser = null;
      return false;
    }
  };

  // ===== PUBLIC API =====

  return {
    login,
    loginWithGoogle,
    register,
    logout,
    getCurrentUser,
    updateProfile,
    changePassword,
    forgotPassword,
    resetPassword,
    hasRecoverySession,
    deleteAccount,
    getUser,
    getRole,
    hasRole,
    isAuthenticated,
    subscribe,
    init,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AuthService;
}
export default AuthService;
