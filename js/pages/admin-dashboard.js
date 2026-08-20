/**
 * ============================================
 * HEALTHMIND AI — ADMIN DASHBOARD
 * ============================================
 */

import App from '/js/app.js';
import Theme from '/js/theme.js';
import API from '/js/services/api.js';
import Toast from '/js/toast.js';
import { escapeText as esc } from '/js/security.js';
import { requireRole } from '/js/utils/auth-guard.js';

const AdminDashboard = (() => {
  // ===== STATE =====

  let stats = {};
  let activity = [];

  // ===== DOM REFS =====

  const elements = {
    totalUsers: document.getElementById('admin-total-users'),
    totalDoctors: document.getElementById('admin-total-doctors'),
    totalHospitals: document.getElementById('admin-total-hospitals'),
    totalAppointments: document.getElementById('admin-total-appointments'),
    recentActivity: document.getElementById('recent-activity'),
  };

  // ===== INITIALIZE =====

  const init = async () => {
    try {
      if (!requireRole(['admin'])) return;

      // App.init() already rendered navigation (with the fetched user)
      // before this page script ran — re-calling it here without that
      // user object would blank out the sidebar's name/avatar.
      await loadDashboard();

      App.hideLoading();

    } catch (error) {
      App.handleError(error);
      App.hideLoading();
    }
  };

  // ===== LOAD DASHBOARD =====

  const loadDashboard = async () => {
    try {
      const response = await API.get('/admin/dashboard');
      
      stats = response.stats || {};
      activity = response.recent_activity || [];

      renderStats();
      renderActivity();

    } catch (error) {
      console.error('Error loading admin dashboard:', error);
      Toast.error('Error', 'Failed to load dashboard data.');
    }
  };

  // ===== RENDER STATS =====

  const renderStats = () => {
    elements.totalUsers.textContent = stats.total_users || 0;
    elements.totalDoctors.textContent = stats.total_doctors || 0;
    elements.totalHospitals.textContent = stats.total_hospitals || 0;
    elements.totalAppointments.textContent = stats.total_appointments || 0;
  };

  // ===== RENDER ACTIVITY =====

  const renderActivity = () => {
    const container = elements.recentActivity;

    if (!activity || activity.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: var(--spacing-4);">
          <p style="color: var(--color-text-secondary);">No recent activity.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = activity.slice(0, 10).map(item => {
      const timeAgo = getTimeAgo(item.timestamp);
      
      return `
        <div class="activity-item">
          <div class="activity-icon">${esc(item.icon) || '📌'}</div>
          <div class="activity-content">
            <div class="activity-title">${esc(item.title)}</div>
            <div class="activity-details">${esc(item.details)}</div>
          </div>
          <div class="activity-time">${esc(timeAgo)}</div>
        </div>
      `;
    }).join('');
  };

  // ===== HELPERS =====

  const getTimeAgo = (dateStr) => {
    if (!dateStr) return 'Just now';
    
    const now = new Date();
    const date = new Date(dateStr);
    const diff = Math.floor((now - date) / 1000);
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    
    return date.toLocaleDateString();
  };

  // ===== EVENT LISTENERS =====

  const setupEventListeners = () => {
    document.querySelector('.theme-toggle')?.addEventListener('click', Theme.toggle);
  };

  // ===== PUBLIC API =====

  return {
    init,
    loadDashboard,
  };
})();

export default AdminDashboard;