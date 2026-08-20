/**
 * ============================================
 * HEALTHMIND AI — ACCESSIBILITY MODULE
 * ============================================
 */

const Accessibility = (() => {
  // ===== STATE =====

  let preferences = {
    reducedMotion: false,
    highContrast: false,
    fontSize: 16,
  };

  // ===== INITIALIZE =====

  const init = () => {
    detectSystemPreferences();
    setupKeyboardNavigation();
    setupFocusManagement();
    setupARIALandmarks();
    setupSkipLinks();
    setupReducedMotion();
    setupScreenReaderAnnouncements();
  };

  const detectSystemPreferences = () => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    preferences.reducedMotion = motionQuery.matches;
    motionQuery.addEventListener('change', (e) => {
      preferences.reducedMotion = e.matches;
      applyReducedMotion(e.matches);
    });

    const contrastQuery = window.matchMedia('(prefers-contrast: high)');
    preferences.highContrast = contrastQuery.matches;
    contrastQuery.addEventListener('change', (e) => {
      preferences.highContrast = e.matches;
      applyHighContrast(e.matches);
    });

    const fontSize = localStorage.getItem('healthmind-font-size');
    if (fontSize) {
      preferences.fontSize = parseInt(fontSize, 10);
      applyFontSize(preferences.fontSize);
    }
  };

  const applyReducedMotion = (reduced) => {
    if (reduced) {
      document.documentElement.classList.add('reduced-motion');
    } else {
      document.documentElement.classList.remove('reduced-motion');
    }
  };

  const setupReducedMotion = () => {
    applyReducedMotion(preferences.reducedMotion);
  };

  const applyFontSize = (size) => {
    document.documentElement.style.fontSize = `${size}px`;
    localStorage.setItem('healthmind-font-size', size);
  };

  const increaseFontSize = () => {
    const newSize = Math.min(preferences.fontSize + 2, 24);
    preferences.fontSize = newSize;
    applyFontSize(newSize);
  };

  const decreaseFontSize = () => {
    const newSize = Math.max(preferences.fontSize - 2, 12);
    preferences.fontSize = newSize;
    applyFontSize(newSize);
  };

  const applyHighContrast = (high) => {
    if (high) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }
  };

  const toggleHighContrast = () => {
    preferences.highContrast = !preferences.highContrast;
    applyHighContrast(preferences.highContrast);
    return preferences.highContrast;
  };

  const setupKeyboardNavigation = () => {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        const modals = document.querySelectorAll('.modal-overlay.active');
        if (modals.length > 0) {
          trapFocus(e, modals[0]);
        }
      }

      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach((modal) => {
          const closeBtn = modal.querySelector('.modal-close');
          if (closeBtn) closeBtn.click();
          modal.classList.remove('active');
        });
      }
    });

    document.addEventListener('mousedown', () => {
      document.documentElement.classList.add('mouse-navigation');
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        document.documentElement.classList.remove('mouse-navigation');
      }
    });
  };

  const trapFocus = (e, container) => {
    const focusable = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusable = focusable[0];
    const lastFocusable = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === firstFocusable) {
      e.preventDefault();
      lastFocusable.focus();
    } else if (!e.shiftKey && document.activeElement === lastFocusable) {
      e.preventDefault();
      firstFocusable.focus();
    }
  };

  const setupFocusManagement = () => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            if (node.classList?.contains('modal-overlay') && node.classList.contains('active')) {
              setTimeout(() => {
                const firstFocusable = node.querySelector(
                  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
                );
                if (firstFocusable) firstFocusable.focus();
              }, 100);
            }
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  };

  const setupARIALandmarks = () => {
    if (!document.querySelector('header[role="banner"]')) {
      const header = document.querySelector('header');
      if (header) header.setAttribute('role', 'banner');
    }

    if (!document.querySelector('main[role="main"]')) {
      const main = document.querySelector('main');
      if (main) main.setAttribute('role', 'main');
    }

    if (!document.querySelector('nav[role="navigation"]')) {
      document.querySelectorAll('nav').forEach((nav) => {
        if (!nav.hasAttribute('role')) {
          nav.setAttribute('role', 'navigation');
        }
      });
    }

    if (!document.querySelector('footer[role="contentinfo"]')) {
      const footer = document.querySelector('footer');
      if (footer) footer.setAttribute('role', 'contentinfo');
    }
  };

  const setupSkipLinks = () => {
    if (!document.querySelector('.skip-link')) {
      const skipLink = document.createElement('a');
      skipLink.className = 'skip-link';
      skipLink.href = '#main-content';
      skipLink.textContent = 'Skip to main content';
      skipLink.style.cssText = `
        position: absolute;
        top: -1000px;
        left: 50%;
        transform: translateX(-50%);
        padding: var(--spacing-2) var(--spacing-4);
        background: var(--color-primary);
        color: white;
        border-radius: var(--radius-md);
        z-index: 9999;
        text-decoration: none;
        font-weight: var(--font-weight-semibold);
      `;

      skipLink.addEventListener('focus', () => {
        skipLink.style.top = 'var(--spacing-2)';
      });

      skipLink.addEventListener('blur', () => {
        skipLink.style.top = '-1000px';
      });

      document.body.insertBefore(skipLink, document.body.firstChild);
    }
  };

  const announce = (message, polite = true) => {
    const announcer = document.getElementById('a11y-announcer') || (() => {
      const el = document.createElement('div');
      el.id = 'a11y-announcer';
      el.setAttribute('aria-live', polite ? 'polite' : 'assertive');
      el.setAttribute('aria-atomic', 'true');
      el.style.cssText = `
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        border: 0;
      `;
      document.body.appendChild(el);
      return el;
    })();

    announcer.textContent = '';
    setTimeout(() => {
      announcer.textContent = message;
    }, 100);
  };

  const setupScreenReaderAnnouncements = () => {
    const observer = new MutationObserver(() => {
      const title = document.querySelector('title');
      if (title) {
        announce(`Navigated to ${title.textContent}`);
      }
    });

    observer.observe(document.querySelector('title') || document.head, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    document.addEventListener('toast-show', (e) => {
      const { title, message } = e.detail;
      announce(`${title}: ${message}`);
    });

    document.addEventListener('page-load', (e) => {
      announce(`Page loaded: ${e.detail.page}`);
    });
  };

  return {
    init,
    announce,
    toggleHighContrast,
    increaseFontSize,
    decreaseFontSize,
    getPreferences: () => ({ ...preferences }),
  };
})();

export default Accessibility;
