/**
 * ============================================
 * HEALTHMIND AI — NOTIFICATIONS PAGE
 * ============================================
 */

import App from '/js/app.js';
import AuthService from '/js/services/auth.js';
import Navigation from '/js/navigation.js';
import Theme from '/js/theme.js';
import API from '/js/services/api.js';
import Toast from '/js/components/toast.js';

const Notifications = (() => {
  // ===== STATE =====

  let notifications = [];
  let unreadCount = 0;
  let currentFilter = 'all';

  // ===== DOM REFS =====

  const elements = {
    list: document.getElementById('notifications-list'),
    unreadBadge: document.getElementById('unread-badge'),
    markAllRead: document.getElementById('mark-all-read'),
    clearAll: document.getElementById('clear-all'),
    filterBtns: document.querySelectorAll('.filter-btn'),
  };

  // ===== INITIALIZE =====

  const init = async () => {
    try {
      const userRole = AuthService.getRole() || 'patient';
      Navigation.init(userRole, true);

      await loadNotifications();

      setupEventListeners();

      App.hideLoading();

    } catch (error) {
      App.handleError(error);
      App.hideLoading();
    }
  };

  // ===== LOAD NOTIFICATIONS =====

  const loadNotifications = async () => {
    try {
      const params = {};
      if (currentFilter === 'unread') params.read = false;
      else if (currentFilter !== 'all') params.type = currentFilter;

      const response = await API.get('/notifications', { params });
      notifications = response.notifications || [];
      unreadCount = response.unread_count || 0;
      
      renderNotifications();
      updateBadge();
      
    } catch (error) {
      console.error('Error loading notifications:', error);
      notifications = [];
      renderNotifications();
      Toast.error('Error', 'Failed to load notifications.');
    }
  };

  // ===== RENDER NOTIFICATIONS =====

  const renderNotifications = () => {
    const container = elements.list;
    if (!container) return;

    const filtered = notifications.filter(n => {
      if (currentFilter === 'all') return true;
      if (currentFilter === 'unread') return !n.read;
      return n.type === currentFilter;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-notifications">
          <div class="empty-icon">🔔</div>
          <div class="empty-title">No notifications</div>
          <div class="empty-description">
            ${currentFilter === 'all' 
              ? 'You\'re all caught up!' 
              : 'No notifications in this category.'}
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(notif => {
      const isUnread = !notif.read;
      const icon = notif.icon || getIconForType(notif.type);
      const timeAgo = getTimeAgo(notif.created_at);
      
      return `
        <div class="notification-item ${isUnread ? 'unread' : ''}" data-id="${notif.id}">
          ${isUnread ? '<span class="unread-dot"></span>' : ''}
          <div class="notification-icon">${icon}</div>
          <div class="notification-content">
            <div class="notification-title">${notif.title}</div>
            <div class="notification-message">${notif.message}</div>
            <span class="notification-time">${timeAgo}</span>
          </div>
          <div class="notification-actions">
            ${isUnread ? `
              <button class="mark-read-btn" title="Mark as read">✓</button>
            ` : ''}
            <button class="delete-btn" title="Delete">✕</button>
          </div>
        </div>
      `;
    }).join('');

    // Event handlers
    container.querySelectorAll('.notification-item').forEach(item => {
      const id = item.dataset.id;
      
      item.addEventListener('click', (e) => {
        // Don't trigger if clicking on action buttons
        if (e.target.closest('.notification-actions')) return;
        
        const notif = notifications.find(n => n.id === id);
        if (notif && !notif.read) {
          markAsRead(id);
        }
        if (notif?.action_url) {
          window.location.href = notif.action_url;
        }
      });
    });

    container.querySelectorAll('.mark-read-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.closest('.notification-item').dataset.id;
        markAsRead(id);
      });
    });

    container.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.closest('.notification-item').dataset.id;
        if (confirm('Delete this notification?')) {
          deleteNotification(id);
        }
      });
    });
  };

  // ===== MARK AS READ =====

  const markAsRead = async (id) => {
    try {
      await API.post(`/notifications/${id}/read`);
      
      const notif = notifications.find(n => n.id === id);
      if (notif) {
        notif.read = true;
        unreadCount = Math.max(0, unreadCount - 1);
        updateBadge();
        renderNotifications();
      }
      
    } catch (error) {
      App.handleError(error);
    }
  };

  // ===== MARK ALL READ =====

  const markAllRead = async () => {
    try {
      await API.post('/notifications/read-all');
      
      notifications.forEach(n => n.read = true);
      unreadCount = 0;
      updateBadge();
      renderNotifications();
      
      Toast.success('Done', 'All notifications marked as read.');
      
    } catch (error) {
      App.handleError(error);
    }
  };

  // ===== DELETE NOTIFICATION =====

  const deleteNotification = async (id) => {
    try {
      await API.delete(`/notifications/${id}`);
      
      notifications = notifications.filter(n => n.id !== id);
      const wasUnread = notifications.find(n => n.id === id)?.read === false;
      if (wasUnread) {
        unreadCount = Math.max(0, unreadCount - 1);
        updateBadge();
      }
      renderNotifications();
      
    } catch (error) {
      App.handleError(error);
    }
  };

  // ===== CLEAR ALL =====

  const clearAll = async () => {
    if (!confirm('Delete all notifications?')) return;
    
    try {
      // Delete all one by one or use a bulk endpoint
      await Promise.all(notifications.map(n => API.delete(`/notifications/${n.id}`)));
      
      notifications = [];
      unreadCount = 0;
      updateBadge();
      renderNotifications();
      
      Toast.success('Cleared', 'All notifications cleared.');
      
    } catch (error) {
      App.handleError(error);
    }
  };

  // ===== UPDATE BADGE =====

  const updateBadge = () => {
    if (elements.unreadBadge) {
      elements.unreadBadge.textContent = unreadCount;
      elements.unreadBadge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
    }
    
    // Update navigation badge
    Navigation.updateBadgeCount(unreadCount);
  };

  // ===== HELPERS =====

  const getIconForType = (type) => {
    const icons = {
      appointment: '📅',
      medication: '💊',
      system: '⚙️',
      reminder: '⏰',
      alert: '⚠️',
    };
    return icons[type] || '🔔';
  };

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
    // Mark all read
    if (elements.markAllRead) {
      elements.markAllRead.addEventListener('click', markAllRead);
    }

    // Clear all
    if (elements.clearAll) {
      elements.clearAll.addEventListener('click', clearAll);
    }

    // Filters
    elements.filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        elements.filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        loadNotifications();
      });
    });

    // Theme toggle
    document.querySelector('.theme-toggle')?.addEventListener('click', Theme.toggle);
  };

  // ===== PUBLIC API =====

  return {
    init,
    loadNotifications,
    markAsRead,
    markAllRead,
    deleteNotification,
    clearAll,
  };
})();

// ===== START =====

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Notifications.init());
} else {
  Notifications.init();
}

export default Notifications;