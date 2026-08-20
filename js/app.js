/**
 * ============================================
 * HEALTHMIND AI — MAIN APPLICATION (ENHANCED)
 * ============================================
 * Entry point with testing, performance, and security
 */

// Import services
import API from './services/api.js';
import AuthService from './services/auth.js';
import Navigation from './navigation.js';
import Theme from './theme.js';
import Performance from './performance.js';
import Security from './security.js';
import Accessibility from './accessibility.js';
import Toast, { showToast } from './toast.js';

// ===== APP STATE =====

const App = (() => {
  // ===== DOM REFS =====

  const elements = {
    sidebar: document.getElementById('sidebar'),
    bottomNav: document.getElementById('bottom-nav'),
    mainContent: document.getElementById('main-content'),
    pageContent: document.getElementById('page-content'),
    loadingOverlay: document.getElementById('loading-overlay'),
    toastContainer: document.getElementById('toast-container'),
  };

  // ===== INITIALIZATION =====

  const isDev = window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1');

  const init = async () => {
    // 1. Initialize security
    Security.init();

    // 2. Initialize performance monitoring
    Performance.init();
    Performance.startMonitoring();

    // 3. Initialize accessibility
    Accessibility.init();

    // 4. Initialize theme
    Theme.init();
    Theme.listenToSystemChanges();

    // 5. Check authentication
    const isAuthenticated = await AuthService.init();
    const role = isAuthenticated ? AuthService.getRole() : 'public';

        // Guard protected pages — redirect unauthenticated users to login.
    const publicPages = [
      '/',
      '/index.html',
      '/login.html',
      '/register.html',
      '/forgot-password.html',
      '/reset-password.html',
    ];
    if (!isAuthenticated && !publicPages.includes(window.location.pathname)) {
      window.location.href = '/login.html';
      return;
    }

    // 6. Setup navigation
    if (isAuthenticated) {
      Navigation.init(role, true, AuthService.getUser());
    } else {
      Navigation.init('patient', false, null);
    }

    // 7. Setup auth event listeners
    AuthService.subscribe((event, data) => {
      if (event === 'logout') {
        Accessibility.announce('You have been logged out');
        window.location.href = '/login.html';
      } else if (event === 'login' || event === 'register') {
        const role = data.user?.role || 'patient';
        Navigation.init(role, true, data.user);
        Accessibility.announce(`Welcome ${data.user?.full_name || 'User'}`);
      }
    });

    // 8. Setup page-specific scripts
    setupPageScripts();

    // 9. Setup global event listeners
    setupGlobalListeners();

    // 10. Run tests in development only — never shipped to a real hostname.
    if (isDev) {
      try {
        const testRunnerModule = await import('./tests/test-runner.js');
        await (testRunnerModule.default ?? testRunnerModule).runAll();
      } catch (error) {
        console.warn('Dev test suite failed:', error);
      }
    }

    // 11. Hide loading
    hideLoading();
  };

  // ===== PAGE SCRIPTS =====

  const setupPageScripts = () => {
    const page = window.location.pathname;
    
    // Performance-measured page loading
    Performance.measureAsync('Page Setup', async () => {
      const pages = {
        'doctor-dashboard': './pages/doctor-dashboard.js',
        'admin-dashboard': './pages/admin-dashboard.js',
        'ai-assistant': './pages/ai-assistant.js',
        'medical-records': './pages/medical-records.js',
        'forgot-password': './pages/forgot-password.js',
        'reset-password': './pages/reset-password.js',
        'appointments': './pages/appointments.js',
        'notifications': './pages/notifications.js',
        'medications': './pages/medications.js',
        'dashboard': './pages/dashboard.js',
        'emergency': './pages/emergency.js',
        'settings': './pages/settings.js',
        'patients': './pages/patients.js',
        'profile': './pages/profile.js',
        'register': './pages/register.js',
        'analytics': './pages/analytics.js',
        'users': './pages/users.js',
        'login': './pages/login.js',
      };

      for (const [key, path] of Object.entries(pages)) {
        if (page.includes(key)) {
          const module = await import(path);
          const pageController = module.default ?? module;
          if (pageController.init) {
            await pageController.init();
          }
          break;
        }
      }
    });
  };

  // ===== GLOBAL LISTENERS =====

  const setupGlobalListeners = () => {
    // Network status
    window.addEventListener('online', () => {
      Toast.success('Connection restored', 'You are back online.');
      Accessibility.announce('Connection restored');
    });

    window.addEventListener('offline', () => {
      Toast.warning('Offline', 'You appear to be offline. Some features may be unavailable.');
      Accessibility.announce('You are offline');
    });

    // Navigation changes
    window.addEventListener('popstate', () => {
      Navigation.highlightCurrentPage();
    });

    // Theme changes
    document.addEventListener('themechange', (e) => {
      if (isDev) console.log('Theme changed to:', e.detail.theme);
    });

    // Click outside sidebar to close on mobile
    document.addEventListener('click', (e) => {
      const sidebar = document.querySelector('.sidebar');
      const overlay = document.querySelector('.sidebar-overlay');
      const toggle = document.querySelector('.mobile-menu-toggle');
      
      if (window.innerWidth < 1024 && sidebar && sidebar.classList.contains('mobile-open')) {
        if (!sidebar.contains(e.target) && !toggle?.contains(e.target)) {
          sidebar.classList.remove('mobile-open');
          if (overlay) overlay.classList.remove('active');
          document.body.style.overflow = '';
        }
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Alt+1 through Alt+9 for navigation shortcuts
      if (e.altKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const navItems = document.querySelectorAll('.sidebar-nav-item');
        const index = parseInt(e.key) - 1;
        if (navItems[index]) {
          navItems[index].click();
        }
      }
    });
  };

  // ===== LOADING =====

  const showLoading = (message = 'Loading...') => {
    const overlay = elements.loadingOverlay;
    if (overlay) {
      overlay.innerHTML = `
        <div class="flex flex-col items-center justify-center min-h-screen gap-4">
          <div class="spinner spinner-lg"></div>
          <p class="text-secondary">${message}</p>
        </div>
      `;
      overlay.classList.remove('hidden');
    }
  };

  const hideLoading = () => {
    const overlay = elements.loadingOverlay;
    if (overlay) {
      overlay.classList.add('hidden');
      // Dispatch event for accessibility
      document.dispatchEvent(new CustomEvent('page-load', { 
        detail: { page: window.location.pathname } 
      }));
    }
  };

  // ===== ERROR HANDLING =====

  const handleError = (error) => {
    const message = error?.message || 'Something went wrong. Please try again.';
    return Toast.error('Error', message);
  };

  // ===== PUBLIC API =====

  return {
    init,
    showLoading,
    hideLoading,
    showToast,
    handleError,
    elements,
  };
})();

// ===== START APP =====

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    App.init();
  });
} else {
  App.init();
}

// ===== EXPORT =====

if (typeof module !== 'undefined' && module.exports) {
  module.exports = App;
}

export default App;