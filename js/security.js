/**
 * ============================================
 * HEALTHMIND AI — SECURITY MODULE
 * ============================================
 */

import API from './services/api.js';
import Toast from './toast.js';

const Security = (() => {
  // ===== STATE =====

  let csrfToken = null;
  let sessionTimeout = 30 * 60 * 1000; // 30 minutes
  let lastActivity = Date.now();

  // ===== INITIALIZE =====

  const init = () => {
    // The API client uses a relative base URL ('/api') when it is served from
    // the same origin as the backend, so resolve it to an absolute URL for CSP.
    const apiOrigin = API.CONFIG.BASE_URL.startsWith('http')
      ? API.CONFIG.BASE_URL
      : window.location.origin + API.CONFIG.BASE_URL;

    // Set CSP meta tag if not present
    if (!document.querySelector('meta[http-equiv="Content-Security-Policy"]')) {
      const meta = document.createElement('meta');
      meta.httpEquiv = 'Content-Security-Policy';
      meta.content = `
        default-src 'self';
        script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net;
        style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
        font-src 'self' https://fonts.gstatic.com;
        img-src 'self' data: https:;
        connect-src 'self' ${apiOrigin};
        frame-src 'none';
        form-action 'self';
        base-uri 'self';
      `.replace(/\s+/g, ' ').trim();
      document.head.appendChild(meta);
    }

    // Set up CSRF protection
    setupCSRF();

    // Set up session timeout
    setupSessionTimeout();

    // Set up clickjacking protection
    setupClickjackingProtection();

    // Set up XSS protection
    setupXSSProtection();

    // Monitor for suspicious activity
    setupSecurityMonitoring();

    console.log('🔒 Security hardening complete');
  };

  // ===== CSRF PROTECTION =====

  const setupCSRF = () => {
    // Get CSRF token from meta tag or cookie
    const metaTag = document.querySelector('meta[name="csrf-token"]');
    if (metaTag) {
      csrfToken = metaTag.content;
    }

    // Intercept fetch requests to add CSRF token
    const originalFetch = window.fetch;
    window.fetch = function(url, options = {}) {
      if (csrfToken && options.method && options.method !== 'GET' && options.method !== 'HEAD') {
        options.headers = options.headers || {};
        options.headers['X-CSRF-Token'] = csrfToken;
      }
      return originalFetch.call(this, url, options);
    };
  };

  // ===== SESSION TIMEOUT =====

  const setupSessionTimeout = () => {
    // Reset activity timer on user interaction
    const resetTimer = () => {
      lastActivity = Date.now();
    };

    ['click', 'keydown', 'scroll', 'touchstart'].forEach(event => {
      document.addEventListener(event, resetTimer);
    });

    // Check session every minute
    setInterval(() => {
      const idleTime = Date.now() - lastActivity;
      if (idleTime > sessionTimeout) {
        // Session expired - redirect to login
        console.warn('🔒 Session expired due to inactivity');
        
        // Show warning
        const toast = Toast.show({
          type: 'warning',
          title: 'Session Expired',
          message: 'Your session has expired. Please log in again.',
          duration: 5000,
        });

        // Clear tokens and redirect
        setTimeout(() => {
          AuthService.logout();
          window.location.href = '/login.html';
        }, 3000);
      }
    }, 60000);
  };

  // ===== CLICKJACKING PROTECTION =====

  const setupClickjackingProtection = () => {
    if (window.top !== window.self) {
      // Page is in an iframe - break out
      window.top.location = window.self.location;
    }
  };

  // ===== XSS PROTECTION =====

  const setupXSSProtection = () => {
    // Sanitize HTML content
    window.sanitizeHTML = (html) => {
      const template = document.createElement('template');
      template.innerHTML = html;
      
      // Remove script tags
      template.content.querySelectorAll('script').forEach(el => el.remove());
      template.content.querySelectorAll('[onload]').forEach(el => el.removeAttribute('onload'));
      template.content.querySelectorAll('[onerror]').forEach(el => el.removeAttribute('onerror'));
      template.content.querySelectorAll('[onclick]').forEach(el => el.removeAttribute('onclick'));
      
      return template.innerHTML;
    };

    // Sanitize user input
    window.sanitizeInput = (input) => {
      if (typeof input !== 'string') return input;
      return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    };
  };

  // ===== SECURITY MONITORING =====

  const setupSecurityMonitoring = () => {
    // Monitor console for suspicious messages
    const originalConsoleLog = console.log;
    const originalConsoleWarn = console.warn;
    const originalConsoleError = console.error;

    console.log = function(...args) {
      const message = args.join(' ');
      if (message.includes('password') || message.includes('token') || message.includes('secret')) {
        // Redact sensitive information in console
        const redacted = message.replace(/password[:=]\s*\S+/gi, 'password: [REDACTED]');
        originalConsoleLog.apply(console, [redacted]);
      } else {
        originalConsoleLog.apply(console, args);
      }
    };

    console.warn = function(...args) {
      const message = args.join(' ');
      if (message.includes('sensitive')) {
        return;
      }
      originalConsoleWarn.apply(console, args);
    };

    console.error = function(...args) {
      // Don't expose raw errors in production
      if (window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1')) {
        const sanitized = args.map(arg => {
          if (arg instanceof Error) {
            return { message: 'An error occurred' };
          }
          return arg;
        });
        originalConsoleError.apply(console, sanitized);
      } else {
        originalConsoleError.apply(console, args);
      }
    };

    // Prevent right-click context menu (optional)
    // document.addEventListener('contextmenu', (e) => {
    //   if (e.target.closest('.sensitive-content')) {
    //     e.preventDefault();
    //   }
    // });

    // Detect dev tools opening
    const devToolsCheck = () => {
      const threshold = 160;
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;
      
      if (widthThreshold || heightThreshold) {
        console.warn('🔒 Dev tools detected');
        // Could take action here (e.g., disable certain features)
      }
    };

    // Check periodically
    setInterval(devToolsCheck, 5000);
  };

  // ===== ENCRYPTION HELPERS =====

  const encrypt = async (data, key) => {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const keyBuffer = encoder.encode(key);
    
    // Use Web Crypto API
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      dataBuffer
    );
    
    return {
      iv: Array.from(iv),
      data: Array.from(new Uint8Array(encrypted)),
    };
  };

  const decrypt = async (encryptedData, key) => {
    const encoder = new TextEncoder();
    const keyBuffer = encoder.encode(key);
    const iv = new Uint8Array(encryptedData.iv);
    const data = new Uint8Array(encryptedData.data);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      data
    );
    
    return new TextDecoder().decode(decrypted);
  };

  // ===== PUBLIC API =====

  return {
    init,
    encrypt,
    decrypt,
    sanitizeHTML: window.sanitizeHTML,
    sanitizeInput: window.sanitizeInput,
  };
})();

// ===== EXPORT =====

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Security;
}

export default Security;