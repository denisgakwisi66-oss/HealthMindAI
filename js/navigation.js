/**
 * ============================================
 * HEALTHMIND AI — ENHANCED NAVIGATION SYSTEM
 * ============================================
 */

const Navigation = (() => {
  // ===== NAVIGATION CONFIG =====

  const ROUTES = {
    public: [
      { path: '/', label: 'Home', icon: '🏠' },
      { path: '/#features', label: 'Features' },
      { path: '/#how-it-works', label: 'How It Works' },
      { path: '/#ai', label: 'AI' },
      { path: '/#security', label: 'Security' },
      { path: '/#about', label: 'About' },
      { path: '/#contact', label: 'Contact' },
    ],
    
    patient: [
      { path: '/dashboard.html', label: 'Dashboard', icon: '📊', section: 'Main' },
      { path: '/ai-assistant.html', label: 'AI Assistant', icon: '🤖', section: 'Main' },
      { path: '/appointments.html', label: 'Appointments', icon: '📅', section: 'Main' },
      { path: '/medical-records.html', label: 'Medical Records', icon: '📋', section: 'Main' },
      { path: '/medications.html', label: 'Medications', icon: '💊', section: 'Main' },
      { path: '/notifications.html', label: 'Notifications', icon: '🔔', section: 'Management' },
      { path: '/emergency.html', label: 'Emergency', icon: '🚨', section: 'Management' },
      { path: '/profile.html', label: 'Profile', icon: '👤', section: 'Account' },
      { path: '/settings.html', label: 'Settings', icon: '⚙️', section: 'Account' },
    ],
    
    doctor: [
      { path: '/doctor-dashboard.html', label: 'Dashboard', icon: '📊', section: 'Main' },
      { path: '/patients.html', label: 'Patients', icon: '👥', section: 'Main' },
      { path: '/appointments.html', label: 'Appointments', icon: '📅', section: 'Main' },
      { path: '/medical-records.html', label: 'Patient Records', icon: '📋', section: 'Main' },
      { path: '/ai-assistant.html', label: 'AI Assistant', icon: '🤖', section: 'Main' },
      { path: '/notifications.html', label: 'Notifications', icon: '🔔', section: 'Management' },
      { path: '/emergency.html', label: 'Emergency', icon: '🚨', section: 'Management' },
      { path: '/profile.html', label: 'Profile', icon: '👤', section: 'Account' },
      { path: '/settings.html', label: 'Settings', icon: '⚙️', section: 'Account' },
    ],
    
    admin: [
      { path: '/admin-dashboard.html', label: 'Dashboard', icon: '📊', section: 'Main' },
      { path: '/users.html', label: 'Users', icon: '👥', section: 'Main' },
      { path: '/appointments.html', label: 'Appointments', icon: '📅', section: 'Management' },
      { path: '/analytics.html', label: 'Analytics', icon: '📈', section: 'Management' },
      { path: '/notifications.html', label: 'Notifications', icon: '🔔', section: 'Management' },
      { path: '/emergency.html', label: 'Emergency', icon: '🚨', section: 'Management' },
      { path: '/settings.html', label: 'Settings', icon: '⚙️', section: 'Account' },
    ],
    
    bottomNav: {
      patient: [
        { path: '/dashboard.html', label: 'Home', icon: '🏠' },
        { path: '/ai-assistant.html', label: 'AI', icon: '🤖', isAI: true },
        { path: '/appointments.html', label: 'Appointments', icon: '📅' },
        { path: '/notifications.html', label: 'Alerts', icon: '🔔' },
        { path: '/profile.html', label: 'Me', icon: '👤' },
      ],
      doctor: [
        { path: '/doctor-dashboard.html', label: 'Home', icon: '🏠' },
        { path: '/ai-assistant.html', label: 'AI', icon: '🤖', isAI: true },
        { path: '/patients.html', label: 'Patients', icon: '👥' },
        { path: '/notifications.html', label: 'Alerts', icon: '🔔' },
        { path: '/profile.html', label: 'Me', icon: '👤' },
      ],
      admin: [
        { path: '/admin-dashboard.html', label: 'Home', icon: '🏠' },
        { path: '/users.html', label: 'Users', icon: '👥' },
        { path: '/analytics.html', label: 'Analytics', icon: '📈' },
        { path: '/notifications.html', label: 'Alerts', icon: '🔔' },
        { path: '/profile.html', label: 'Me', icon: '👤' },
      ],
    }
  };

  // ===== STATE =====

  let currentRole = 'patient';
  let currentPath = window.location.pathname;
  let isAuthenticated = false;
  let userBadgeCount = 0;

  // ===== NAVIGATION RENDERERS =====

  const renderSidebar = (containerId, role) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    const routes = ROUTES[role] || ROUTES.patient;
    const currentPath = window.location.pathname;

    // Group routes by section
    const sections = {};
    routes.forEach(route => {
      const section = route.section || 'Main';
      if (!sections[section]) sections[section] = [];
      sections[section].push(route);
    });

    let html = `
      <div class="sidebar-header">
        <a href="/dashboard.html" class="sidebar-brand">
          <span class="sidebar-brand-icon">HM</span>
          <span class="sidebar-brand-text">HealthMind AI</span>
        </a>
        <button class="sidebar-toggle" aria-label="Toggle sidebar">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 5L8 10L15 15" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M5 5L5 15" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <nav class="sidebar-nav" aria-label="Main navigation">
    `;

    Object.keys(sections).forEach(sectionName => {
      const sectionRoutes = sections[sectionName];
      if (sectionRoutes.length === 0) return;
      
      html += `<div class="sidebar-nav-section">`;
      html += `<div class="sidebar-nav-label">${sectionName}</div>`;
      
      sectionRoutes.forEach(route => {
        const isActive = currentPath === route.path || 
                         (currentPath === '/' && route.path === '/dashboard.html');
        const isEmergency = route.path === '/emergency.html';
        const isAI = route.path === '/ai-assistant.html';
        
        let additionalClass = '';
        if (isEmergency) additionalClass += ' emergency-nav-item';
        if (isAI) additionalClass += ' ai-nav-item';
        
        html += `
          <a href="${route.path}" class="sidebar-nav-item ${isActive ? 'active' : ''}${additionalClass}" data-path="${route.path}">
            <span class="nav-icon">${route.icon || '📄'}</span>
            <span class="nav-text">${route.label}</span>
            ${route.badge ? `<span class="nav-badge">${route.badge}</span>` : ''}
          </a>
        `;
      });
      
      html += `</div>`;
    });

    html += `
      </nav>
      <div class="sidebar-footer">
        <div class="flex items-center gap-3 p-2">
          <div class="w-10 h-10 rounded-full bg-primary-surface flex items-center justify-center flex-shrink-0">
            <span class="text-primary font-semibold">${getUserInitials()}</span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-medium text-sm truncate">${getUserName()}</div>
            <div class="text-xs text-secondary truncate capitalize">${role}</div>
          </div>
          <button class="theme-toggle" aria-label="Toggle theme">
            <span class="icon-sun">☀️</span>
            <span class="icon-moon">🌙</span>
          </button>
        </div>
        <button id="logout-btn" class="btn btn-ghost btn-sm btn-block" style="margin-top: var(--spacing-2); color: var(--color-danger);">
          Log Out
        </button>
      </div>
    `;

    container.innerHTML = html;

    // Setup toggle
    const toggleBtn = container.querySelector('.sidebar-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        container.classList.toggle('collapsed');
        localStorage.setItem('sidebar-collapsed', container.classList.contains('collapsed'));
      });
      
      // Restore state
      if (localStorage.getItem('sidebar-collapsed') === 'true') {
        container.classList.add('collapsed');
      }
    }

    // Setup theme toggle
    const themeBtn = container.querySelector('.theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
        localStorage.setItem('theme', isDark ? 'light' : 'dark');
      });
    }

    // Setup logout
    const logoutBtn = container.querySelector('#logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to log out?')) {
          try {
            const { default: AuthService } = await import('/js/services/auth.js');
            await AuthService.logout();
            window.location.href = '/login.html';
          } catch (error) {
            console.error('Logout error:', error);
            window.location.href = '/login.html';
          }
        }
      });
    }
  };

  const renderBottomNav = (containerId, role) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    const routes = ROUTES.bottomNav[role] || ROUTES.bottomNav.patient;
    const currentPath = window.location.pathname;

    let html = `<nav class="bottom-nav-items" aria-label="Mobile navigation">`;

    routes.forEach(route => {
      const isActive = currentPath === route.path || 
                       (currentPath === '/' && route.path === '/dashboard.html');
      const isAI = route.isAI || false;
      const isEmergency = route.path === '/emergency.html';
      
      let additionalClass = '';
      if (isAI) additionalClass += ' bottom-nav-item-ai';
      if (isEmergency) additionalClass += ' bottom-nav-item-emergency';
      
      html += `
        <a href="${route.path}" class="bottom-nav-item ${isActive ? 'active' : ''}${additionalClass}" data-path="${route.path}">
          <span class="nav-icon">${isAI ? '🤖' : route.icon}</span>
          <span class="nav-label">${route.label}</span>
          ${route.badge ? `<span class="nav-badge">${route.badge}</span>` : ''}
        </a>
      `;
    });

    html += `</nav>`;
    container.innerHTML = html;
  };

  // ===== USER HELPERS =====

  const getUserName = () => {
    try {
      const userStr = localStorage.getItem('healthmind_auth_user');
      if (userStr) {
        const user = JSON.parse(userStr);
        return user.full_name || user.name || 'User';
      }
    } catch (e) {}
    return 'User';
  };

  const getUserInitials = () => {
    const name = getUserName();
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // ===== NAVIGATION INITIALIZATION =====

  const init = (role = 'patient', authenticated = false) => {
    currentRole = role;
    isAuthenticated = authenticated;

    // Render sidebar
    const sidebarContainer = document.getElementById('sidebar');
    if (sidebarContainer) {
      renderSidebar('sidebar', role);
    }

    // Render bottom nav
    const bottomNavContainer = document.getElementById('bottom-nav');
    if (bottomNavContainer) {
      renderBottomNav('bottom-nav', role);
    }

    // Setup mobile menu toggle
    const menuToggle = document.querySelector('.mobile-menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');

    if (menuToggle && sidebar) {
      menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('mobile-open');
        if (overlay) {
          overlay.classList.toggle('active');
        }
        document.body.style.overflow = sidebar.classList.contains('mobile-open') ? 'hidden' : '';
      });
    }

    if (overlay && sidebar) {
      overlay.addEventListener('click', () => {
        sidebar.classList.remove('mobile-open');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
      });
    }

    // Highlight current page
    highlightCurrentPage();

    // Update badge count
    updateBadgeCount();

    return true;
  };

  const highlightCurrentPage = () => {
    const currentPath = window.location.pathname;
    const navItems = document.querySelectorAll('.sidebar-nav-item, .bottom-nav-item');
    
    navItems.forEach(item => {
      const path = item.dataset.path;
      if (path) {
        if (currentPath === path || (currentPath === '/' && path === '/dashboard.html')) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      }
    });
  };

  const updateBadgeCount = (count) => {
    if (count !== undefined) {
      userBadgeCount = count;
    }
    
    const badges = document.querySelectorAll('.nav-badge');
    badges.forEach(badge => {
      if (userBadgeCount > 0) {
        badge.textContent = userBadgeCount > 99 ? '99+' : userBadgeCount;
        badge.style.display = 'block';
      } else {
        badge.style.display = 'none';
      }
    });
  };

  // ===== NAVIGATION HELPERS =====

  const navigateTo = (path) => {
    window.location.href = path;
  };

  const getCurrentPath = () => window.location.pathname;

  const getRole = () => currentRole;

  const getRoutes = (role) => {
    return ROUTES[role] || ROUTES.patient;
  };

  // ===== PUBLIC API =====

  return {
    init,
    renderSidebar,
    renderBottomNav,
    navigateTo,
    getCurrentPath,
    getRole,
    getRoutes,
    highlightCurrentPage,
    updateBadgeCount,
    ROUTES,
  };
})();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Navigation;
}

export default Navigation;