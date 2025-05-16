// Define a unique cache name - CHANGE THIS VERSION WHEN YOU UPDATE FILES
const CACHE_NAME = 'sgresolve-cache-v1.1.1'; //

// List the core files needed for the app shell to work offline
// IMPORTANT: Paths must be relative to the service worker's location (root),
// AND accessible from the root URL. For GitHub Pages subdirectories,
// make sure these paths correctly resolve from /NAISC-NAPA/
const urlsToCache = [
  '/NAISC-NAPA/',               // The root of your app on GitHub Pages
  '/NAISC-NAPA/index.html',
  '/NAISC-NAPA/styles.css',
  '/NAISC-NAPA/script.js',
  '/NAISC-NAPA/manifest.json',
  '/NAISC-NAPA/images/logo.png',
  '/NAISC-NAPA/images/green-city.png',
  '/NAISC-NAPA/images/chat-icon.png',
  '/NAISC-NAPA/images/user-location-marker.png',
  // Add paths to essential icons - adjust paths if necessary
  '/NAISC-NAPA/images/icons/icon-192x192.png',
  '/NAISC-NAPA/images/icons/icon-512x512.png',
  // CDN files - Caching these can be complex due to versioning and CORS.
  // Let's rely on the browser's default caching for these initially.
  // If offline Leaflet/Chart.js is critical, download them and add local paths here.
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js',
  'https://cdn.jsdelivr.net/npm/chart.js'
  // Google/Firebase/ImgBB/Railway APIs will be fetched live (cannot be reliably cached here)
];

// --- Installation Event ---
self.addEventListener('install', event => {
  console.log('[Service Worker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching app shell');
        // Use addAll for atomic caching - if one fails, the install fails.
        return cache.addAll(urlsToCache).catch(error => {
          console.error('[Service Worker] Failed to cache files during install:', error);
          // You might want to throw the error to ensure installation fails if core assets aren't cached
          // throw error;
        });
      })
      .then(() => {
        console.log('[Service Worker] Skip waiting on install');
        // Force the waiting service worker to become the active service worker.
        return self.skipWaiting();
      })
  );
});

// --- Activation Event ---
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activate');
  const cacheWhitelist = [CACHE_NAME]; // Keep only the current cache version
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // If the cache name isn't in our whitelist, delete it
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] Claiming clients');
      // Take control of currently open pages immediately, so they use the new SW
      return self.clients.claim();
    })
  );
});

// --- Fetch Event (Network falling back to cache for cached assets) ---
self.addEventListener('fetch', event => {
//   console.log('[Service Worker] Fetching:', event.request.url);

  // --- Strategy: Cache First for core assets, Network First/Only for others ---

  const requestUrl = new URL(event.request.url);

  // Let browser handle non-GET requests normally
  if (event.request.method !== 'GET') {
      // console.log('[Service Worker] Ignoring non-GET request:', event.request.method, event.request.url);
      return;
  }

  // Let browser handle external APIs/services directly (Firebase, Google, ImgBB, Railway, OSM tiles etc.)
  // Check hostname to avoid accidentally blocking necessary external resources
  if (requestUrl.hostname !== self.location.hostname || // Not our domain
      requestUrl.href.includes('firebase') ||           // Firebase calls
      requestUrl.href.includes('gstatic.com') ||        // Firebase/Google resources
      requestUrl.href.includes('google.com/recaptcha') ||// reCAPTCHA
      requestUrl.href.includes('tile.openstreetmap.org')||// Map tiles
      requestUrl.href.includes('imgbb.com') ||           // Image uploads
      requestUrl.href.includes('railway.app')            // Your backend APIs
     ) {
       // console.log('[Service Worker] Ignoring external API/Service request:', event.request.url);
      return; // Let the browser handle it
  }

  // Cache-First strategy for assets defined in urlsToCache (mostly app shell)
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Cache hit - return response from cache
        if (cachedResponse) {
          // console.log('[Service Worker] Serving from cache:', event.request.url);
          return cachedResponse;
        }

        // Not in cache - fetch from network
        // console.log('[Service Worker] Fetching from network (not in cache):', event.request.url);
        return fetch(event.request).then(
          networkResponse => {
            // We don't dynamically cache network responses here to keep it simple
            // and avoid caching potentially dynamic data inappropriately.
            return networkResponse;
          }
        ).catch(error => {
          console.error('[Service Worker] Network fetch failed:', error, event.request.url);
          // Optional: Return a generic offline fallback page if network fails completely
          // You would need to cache an 'offline.html' during install for this.
          // return caches.match('/NAISC-NAPA/offline.html');
        });
      })
  );
});
