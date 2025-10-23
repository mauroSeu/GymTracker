const CACHE_NAME = 'gym-tracker-v1';
const ASSETS_TO_CACHE = [
  '/GymTracker/',           // La radice del progetto
  '/GymTracker/index.html',
  '/GymTracker/manifest.json'
  // Aggiungi qui anche /GymTracker/gym-tracker-fase3.jsx
];

// Install event - cache assets
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[ServiceWorker] Caching app shell');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => {
        console.log('[ServiceWorker] Installed successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[ServiceWorker] Installation failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_NAME)
            .map((cacheName) => {
              console.log('[ServiceWorker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('[ServiceWorker] Activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          console.log('[ServiceWorker] Serving from cache:', event.request.url);
          return cachedResponse;
        }

        console.log('[ServiceWorker] Fetching from network:', event.request.url);
        return fetch(event.request)
          .then((response) => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch((error) => {
            console.error('[ServiceWorker] Fetch failed:', error);
            
            // Return a custom offline page if available
            return caches.match('/offline.html').then((offlineResponse) => {
              return offlineResponse || new Response('Offline - Please check your internet connection', {
                status: 503,
                statusText: 'Service Unavailable',
                headers: new Headers({
                  'Content-Type': 'text/plain'
                })
              });
            });
          });
      })
  );
});

// Background sync for saving workout data
self.addEventListener('sync', (event) => {
  console.log('[ServiceWorker] Background sync:', event.tag);
  
  if (event.tag === 'sync-workout-data') {
    event.waitUntil(
      // Sync workout data to server when online
      syncWorkoutData()
    );
  }
});

// Push notifications for rest timer completion
self.addEventListener('push', (event) => {
  console.log('[ServiceWorker] Push notification received');
  
  const options = {
    body: event.data ? event.data.text() : 'Il tuo riposo è terminato! 💪',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    vibrate: [200, 100, 200],
    tag: 'gym-tracker-notification',
    requireInteraction: false
  };

  event.waitUntil(
    self.registration.showNotification('GymTracker', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[ServiceWorker] Notification clicked');
  
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing window if available
        for (let client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Open new window if no existing window
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});

// Helper function to sync workout data
async function syncWorkoutData() {
  try {
    // Get data from IndexedDB or localStorage
    const data = await getWorkoutDataToSync();
    
    if (data && data.length > 0) {
      // Send to server API
      const response = await fetch('/api/sync-workouts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      if (response.ok) {
        console.log('[ServiceWorker] Workout data synced successfully');
        await clearSyncedData();
      } else {
        console.error('[ServiceWorker] Sync failed:', response.status);
      }
    }
  } catch (error) {
    console.error('[ServiceWorker] Sync error:', error);
    throw error; // Re-throw to retry sync later
  }
}

async function getWorkoutDataToSync() {
  // Placeholder - implement actual data retrieval
  return [];
}

async function clearSyncedData() {
  // Placeholder - implement actual data clearing
  console.log('[ServiceWorker] Clearing synced data');
}

console.log('[ServiceWorker] Service Worker script loaded');
