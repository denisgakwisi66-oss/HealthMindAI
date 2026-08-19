/**
 * ============================================
 * HEALTHMIND AI — TOAST COMPONENT
 * ============================================
 */

const Toast = (() => {
  // ===== STATE =====

  let container = null;
  const toasts = [];
  const defaults = {
    duration: 5000,
    position: 'bottom-right',
  };

  // ===== INITIALIZE =====

  const init = () => {
    container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  };

  // ===== CREATE TOAST =====

  const show = (options) => {
    if (!container) init();

    const {
      type = 'info',
      title = '',
      message = '',
      duration = defaults.duration,
      actions = [],
      onClose = null,
    } = typeof options === 'string' ? { message: options } : options;

    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️',
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-enter`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');

    let html = `
      <div class="toast-icon ${type}">${icons[type] || 'ℹ️'}</div>
      <div class="toast-content">
    `;

    if (title) {
      html += `<div class="toast-title">${title}</div>`;
    }

    if (message) {
      html += `<div class="toast-message">${message}</div>`;
    }

    if (actions.length > 0) {
      html += `<div style="display: flex; gap: var(--spacing-2); margin-top: var(--spacing-2); flex-wrap: wrap;">`;
      actions.forEach(action => {
        html += `
          <button class="btn btn-sm ${action.class || 'btn-primary'}" data-action="${action.id}">
            ${action.label}
          </button>
        `;
      });
      html += `</div>`;
    }

    html += `
      </div>
      <button class="toast-close" aria-label="Close notification">&times;</button>
    `;

    toast.innerHTML = html;

    // Handle actions
    if (actions.length > 0) {
      toast.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const actionId = e.target.dataset.action;
          const action = actions.find(a => a.id === actionId);
          if (action && action.handler) {
            action.handler(e);
          }
          removeToast(toast);
        });
      });
    }

    // Handle close
    const closeBtn = toast.querySelector('.toast-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        if (onClose) onClose();
        removeToast(toast);
      });
    }

    // Auto-remove
    let timeout = null;
    if (duration > 0) {
      timeout = setTimeout(() => {
        removeToast(toast);
        if (onClose) onClose();
      }, duration);
    }

    // Click to dismiss
    toast.addEventListener('click', (e) => {
      if (e.target === toast) {
        clearTimeout(timeout);
        removeToast(toast);
        if (onClose) onClose();
      }
    });

    // Pause on hover
    toast.addEventListener('mouseenter', () => {
      clearTimeout(timeout);
    });

    toast.addEventListener('mouseleave', () => {
      if (duration > 0) {
        timeout = setTimeout(() => {
          removeToast(toast);
          if (onClose) onClose();
        }, duration);
      }
    });

    container.appendChild(toast);
    toasts.push(toast);

    return toast;
  };

  // ===== REMOVE TOAST =====

  const removeToast = (toast) => {
    if (!toast) return;
    
    toast.classList.remove('toast-enter');
    toast.classList.add('toast-exit');
    
    const index = toasts.indexOf(toast);
    if (index > -1) {
      toasts.splice(index, 1);
    }
    
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  };

  // ===== CLEAR ALL =====

  const clearAll = () => {
    toasts.forEach(toast => removeToast(toast));
  };

  // ===== CONVENIENCE METHODS =====

  const success = (title, message, options = {}) => {
    return show({ type: 'success', title, message, ...options });
  };

  const error = (title, message, options = {}) => {
    return show({ type: 'error', title, message, ...options });
  };

  const warning = (title, message, options = {}) => {
    return show({ type: 'warning', title, message, ...options });
  };

  const info = (title, message, options = {}) => {
    return show({ type: 'info', title, message, ...options });
  };

  // ===== PUBLIC API =====

  return {
    init,
    show,
    removeToast,
    clearAll,
    success,
    error,
    warning,
    info,
  };
})();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Toast;
}

export default Toast;