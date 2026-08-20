/**
 * ============================================
 * HEALTHMIND AI — SECURITY MODULE
 * ============================================
 * The Content-Security-Policy, X-Frame-Options, and other security headers
 * are set server-side (see backend/app/main.py) — a header sent before the
 * page even starts parsing is strictly better than anything this module
 * could inject client-side after the fact, so this file only covers what
 * genuinely has to run in the browser: session-idle timeout and a real
 * HTML sanitizer for the handful of places that still build markup from
 * dynamic strings.
 */

import AuthService from './services/auth.js';
import Toast from './toast.js';

const Security = (() => {
  let sessionTimeout = 30 * 60 * 1000; // 30 minutes
  let lastActivity = Date.now();

  const init = () => {
    setupSessionTimeout();
  };

  // ===== SESSION TIMEOUT =====

  const setupSessionTimeout = () => {
    const resetTimer = () => {
      lastActivity = Date.now();
    };

    ['click', 'keydown', 'scroll', 'touchstart'].forEach((event) => {
      document.addEventListener(event, resetTimer);
    });

    setInterval(async () => {
      const idleTime = Date.now() - lastActivity;
      if (idleTime > sessionTimeout) {
        Toast.show({
          type: 'warning',
          title: 'Session Expired',
          message: 'Your session has expired. Please log in again.',
          duration: 5000,
        });

        setTimeout(async () => {
          await AuthService.logout();
          window.location.href = '/login.html';
        }, 3000);
      }
    }, 60000);
  };

  // ===== HTML SANITIZATION =====
  // A real sanitizer (strips scripts/handlers/style, keeps a small safe tag
  // allowlist) for the few call sites that need to render simple formatted
  // text. Plain text interpolation (names, statuses, messages) should use
  // escapeText below or textContent instead — it doesn't need this at all.

  const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'BR', 'P', 'SPAN', 'UL', 'LI', 'OL', 'A']);

  const sanitizeHTML = (html) => {
    const template = document.createElement('template');
    template.innerHTML = String(html ?? '');

    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === Node.ELEMENT_NODE) {
          if (!ALLOWED_TAGS.has(child.tagName)) {
            child.replaceWith(...child.childNodes);
            return;
          }
          [...child.attributes].forEach((attr) => {
            const isSafeHref = attr.name === 'href' && /^(https?:|mailto:|\/)/i.test(attr.value);
            if (!isSafeHref) child.removeAttribute(attr.name);
          });
          walk(child);
        }
      });
    };
    walk(template.content);
    return template.innerHTML;
  };

  const escapeText = (input) => {
    if (typeof input !== 'string') return input;
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  };

  return {
    init,
    sanitizeHTML,
    escapeText,
  };
})();

export const sanitizeHTML = Security.sanitizeHTML;
export const escapeText = Security.escapeText;

// Kept on window for the handful of legacy inline call sites; prefer
// importing { sanitizeHTML, escapeText } from this module in new code.
window.sanitizeHTML = Security.sanitizeHTML;
window.escapeText = Security.escapeText;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Security;
}

export default Security;
