/**
 * ============================================
 * HEALTHMIND AI — PERFORMANCE OPTIMIZER
 * ============================================
 */

const Performance = (() => {
  // ===== STATE =====

  let metrics = {};
  let isMonitoring = false;
  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const devLog = (...args) => { if (isDev) console.log(...args); };

  // ===== INITIALIZE =====

  const init = () => {
    // Monitor Core Web Vitals
    if ('PerformanceObserver' in window) {
      // LCP (Largest Contentful Paint)
      const lcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const lastEntry = entries[entries.length - 1];
        metrics.lcp = lastEntry.startTime;
        devLog(`LCP: ${Math.round(lastEntry.startTime)}ms`);
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

      // FID (First Input Delay)
      const fidObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        entries.forEach(entry => {
          metrics.fid = entry.processingStart - entry.startTime;
          devLog(`FID: ${Math.round(metrics.fid)}ms`);
        });
      });
      fidObserver.observe({ type: 'first-input', buffered: true });

      // CLS (Cumulative Layout Shift)
      const clsObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        entries.forEach(entry => {
          if (!entry.hadRecentInput) {
            metrics.cls = (metrics.cls || 0) + entry.value;
          }
        });
        devLog(`CLS: ${(metrics.cls || 0).toFixed(3)}`);
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });
    }

    // Monitor memory usage
    if (performance.memory) {
      metrics.memory = {
        total: performance.memory.totalJSHeapSize,
        used: performance.memory.usedJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit,
      };
    }

    // Log performance on page unload
    window.addEventListener('beforeunload', () => {
      devLog('Performance Metrics:', metrics);
    });
  };

  // ===== MEASURE FUNCTION =====

  const measure = (name, fn) => {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;
    
    devLog(`⏱️ ${name}: ${Math.round(duration)}ms`);
    
    if (duration > 100) {
      console.warn(`⚠️ ${name} took ${Math.round(duration)}ms - consider optimizing`);
    }
    
    return result;
  };

  const measureAsync = async (name, fn) => {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;
    
    devLog(`⏱️ ${name}: ${Math.round(duration)}ms`);
    
    if (duration > 100) {
      console.warn(`⚠️ ${name} took ${Math.round(duration)}ms - consider optimizing`);
    }
    
    return result;
  };

  // ===== DEBOUNCE =====

  const debounce = (fn, delay = 300) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  };

  // ===== THROTTLE =====

  const throttle = (fn, limit = 300) => {
    let inThrottle = false;
    return (...args) => {
      if (!inThrottle) {
        fn(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  };

  // ===== LAZY LOAD =====

  const lazyLoad = (element, callback) => {
    if (!element) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          callback(element);
          observer.unobserve(element);
        }
      });
    });

    observer.observe(element);
  };

  const lazyLoadImages = () => {
    document.querySelectorAll('img[data-src]').forEach(img => {
      lazyLoad(img, () => {
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
      });
    });
  };

  // ===== CACHE MANAGEMENT =====

  const cache = {
    store: new Map(),
    maxSize: 100,
    ttl: 5 * 60 * 1000, // 5 minutes

    get(key) {
      const item = this.store.get(key);
      if (!item) return null;
      
      if (Date.now() - item.timestamp > this.ttl) {
        this.store.delete(key);
        return null;
      }
      
      return item.value;
    },

    set(key, value) {
      // Limit cache size
      if (this.store.size >= this.maxSize) {
        const firstKey = this.store.keys().next().value;
        this.store.delete(firstKey);
      }
      
      this.store.set(key, {
        value,
        timestamp: Date.now(),
      });
    },

    clear() {
      this.store.clear();
    },

    invalidate(key) {
      this.store.delete(key);
    },
  };

  // ===== DOM OPTIMIZATION =====

  const batchDOMUpdates = (updates) => {
    requestAnimationFrame(() => {
      updates.forEach(update => update());
    });
  };

  // ===== MEMORY MANAGEMENT =====

  const cleanup = () => {
    // Clear large objects
    cache.clear();
    
    // Remove event listeners if needed
    // (Implement as needed for specific components)
    
    // Force garbage collection if available
    if (window.gc) {
      window.gc();
    }
  };

  // ===== MONITORING =====

  const startMonitoring = () => {
    isMonitoring = true;
    setInterval(() => {
      if (performance.memory) {
        metrics.memory = {
          total: performance.memory.totalJSHeapSize,
          used: performance.memory.usedJSHeapSize,
          limit: performance.memory.jsHeapSizeLimit,
        };
        
        const usagePercent = (metrics.memory.used / metrics.memory.limit) * 100;
        if (usagePercent > 80) {
          console.warn(`⚠️ High memory usage: ${Math.round(usagePercent)}%`);
          cleanup();
        }
      }
    }, 30000);
  };

  // ===== PUBLIC API =====

  return {
    init,
    measure,
    measureAsync,
    debounce,
    throttle,
    lazyLoad,
    lazyLoadImages,
    cache,
    batchDOMUpdates,
    cleanup,
    startMonitoring,
    getMetrics: () => ({ ...metrics }),
  };
})();

// ===== EXPORT =====

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Performance;
}

export default Performance;