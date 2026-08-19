/**
 * ============================================
 * HEALTHMIND AI — ENHANCED THEME MANAGEMENT
 * ============================================
 */

const Theme = (() => {
  // ===== STATE =====

  const STORAGE_KEY = 'healthmind-theme';
  const DEFAULT_THEME = 'light';
  let currentTheme = DEFAULT_THEME;
  let listeners = [];

  // ===== DETECT SYSTEM THEME =====

  const getSystemTheme = () => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  };

  // ===== APPLY THEME =====

  const applyTheme = (theme) => {
    const html = document.documentElement;
    const isDark = theme === 'dark';
    
    if (isDark) {
      html.setAttribute('data-theme', 'dark');
    } else {
      html.removeAttribute('data-theme');
    }
    
    currentTheme = theme;
    localStorage.setItem(STORAGE_KEY, theme);
    
    // Update meta theme-color
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.content = isDark ? '#0F172A' : '#2563EB';
    }
    
    // Notify listeners
    listeners.forEach(listener => {
      try {
        listener(theme);
      } catch (e) {
        console.error('Theme listener error:', e);
      }
    });
    
    // Dispatch event
    const event = new CustomEvent('themechange', { detail: { theme } });
    document.dispatchEvent(event);
    
    return theme;
  };

  // ===== GET CURRENT THEME =====

  const getTheme = () => {
    return currentTheme;
  };

  const isDark = () => {
    return currentTheme === 'dark';
  };

  // ===== TOGGLE THEME =====

  const toggleTheme = () => {
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    return applyTheme(newTheme);
  };

  // ===== INITIALIZE THEME =====

  const init = () => {
    // Check for stored preference
    const stored = localStorage.getItem(STORAGE_KEY);
    
    if (stored && (stored === 'light' || stored === 'dark')) {
      applyTheme(stored);
      return stored;
    }
    
    // Check system preference
    const systemTheme = getSystemTheme();
    applyTheme(systemTheme);
    return systemTheme;
  };

  // ===== LISTEN TO SYSTEM THEME CHANGES =====

  const listenToSystemChanges = () => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handler = (e) => {
      // Only change if user hasn't explicitly set a preference
      if (!localStorage.getItem(STORAGE_KEY)) {
        const theme = e.matches ? 'dark' : 'light';
        applyTheme(theme);
      }
    };
    
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handler);
    }
    
    // Return cleanup function
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handler);
      } else {
        mediaQuery.removeListener(handler);
      }
    };
  };

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

  // ===== PUBLIC API =====

  return {
    init,
    getTheme,
    isDark,
    applyTheme,
    toggleTheme,
    getSystemTheme,
    listenToSystemChanges,
    subscribe,
  };
})();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Theme;
}

export default Theme;