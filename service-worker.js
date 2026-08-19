/**
 * ============================================
 * HEALTHMIND AI — SERVICE WORKER
 * ============================================
 */

const CACHE_NAME = 'healthmind-v1';
const STATIC_CACHE = 'healthmind-static-v1';
const API_CACHE = 'healthmind-api-v1';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/variables.css',
  '/css/base.css',
  '/css/components.css',
  '/css/layout.css',
  '/css/animations.css',
  '/css/responsive.css',
  '/css/themes.css',
  '/js/app.js',
  '/js/navigation.js',
  '/js/theme.js',
  '/js/services/api.js',
  '/js/services/auth.js',
  '/manifest.json',
  '/favicon.svg',
];

// API routes to cache (GET requests only)
const API_ROUTES = [
  '/api/appointments/doctors',
  '/api/appointments/specialties',
  '/api/system/status',
  '/api/health',
];

// ===== INSTALL EVENT =====

// ===== INSTALL EVENT =====

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(STATIC_CACHE).then((cache) => {
        return cache.addAll(STATIC_ASSETS);
      }),
      // Cache API responses
      caches.open(API_CACHE).then((cache) => {
        return cache.addAll(API_ROUTES);
      }),
    ])
  );
  self.skipWaiting();
});

// ===== ACTIVATE EVENT =====

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            return name !== STATIC_CACHE && name !== API_CACHE;
          })
          .map((name) => {
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// ===== FETCH EVENT =====

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isApiRequest = url.pathname.startsWith('/api/');
  const isStaticAsset = STATIC_ASSETS.some(asset => {
    return event.request.url.includes(asset);
  });

  // Handle API requests
  if (isApiRequest) {
    // Only cache GET requests
    if (event.request.method === 'GET' && API_ROUTES.some(route => url.pathname.includes(route))) {
      event.respondWith(networkFirst(event.request));
      return;
    }
    
    // Non-cached API requests go network-only
    event.respondWith(networkOnly(event.request));
    return;
  }

  // Handle HTML requests - network first, fallback to cache
  if (url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(networkFirstHtml(event.request));
    return;
  }

  // Handle static assets - cache first, fallback to network
  if (isStaticAsset) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // Default - network first
  event.respondWith(networkFirst(event.request));
});

// ===== STRATEGIES =====

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  
  if (cached) {
    return cached;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('Resource not available offline', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    const cache = await caches.open(API_CACHE);
    const cached = await cache.match(request);
    
    if (cached) {
      return cached;
    }
    
    return new Response(JSON.stringify({
      error: {
        code: 'OFFLINE',
        message: 'You appear to be offline. Please check your connection.',
      }
    }), {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}

async function networkOnly(request) {
  try {
    return await fetch(request);
  } catch (error) {
    return new Response(JSON.stringify({
      error: {
        code: 'OFFLINE',
        message: 'Network request failed. Please check your connection.',
      }
    }), {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}

async function networkFirstHtml(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cache = await caches.open(STATIC_CACHE);
    const cached = await cache.match(request);
    
    if (cached) {
      return cached;
    }
    
    // Fallback to offline page
    return cache.match('/offline.html') || new Response('You are offline', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }
}

// ===== BACKGROUND SYNC =====

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-appointments') {
    event.waitUntil(syncAppointments());
  }
});

async function syncAppointments() {
  // Implement background sync for offline appointments
  console.log('Syncing appointments...');
}

// ===== PUSH NOTIFICATIONS =====

self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  
  const options = {
    body: data.body || 'You have a new notification from HealthMind AI.',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-icon.png',
    vibrate: [200, 100, 200],
    data: data.data || {},
    actions: [
      {
        action: 'view',
        title: 'View',
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
      },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'HealthMind AI', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  // Navigate to the notification's URL or default
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.openWindow(url)
  );
});