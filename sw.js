const CACHE_NAME = 'eventos-v1';
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './eventos.png'
];

// Instalación: cachear assets estáticos
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Activación: limpiar caches viejas
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch: estrategia Network First para API, Cache First para estáticos
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Si es una petición a la API de Google Apps Script → Network Only
    if (url.hostname.includes('script.google.com')) {
        event.respondWith(
            fetch(request).catch(() => {
                return new Response(
                    JSON.stringify({ ok: false, error: 'Sin conexión. Conectate a internet para sincronizar.' }),
                    {
                        status: 503,
                        headers: { 'Content-Type': 'application/json' }
                    }
                );
            })
        );
        return;
    }

    // Para todo lo demás → Cache First, fallback a network
    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) {
                return cached;
            }
            return fetch(request).then((response) => {
                // Cachear respuestas válidas
                if (response.status === 200 && response.type === 'basic') {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, clone);
                    });
                }
                return response;
            }).catch(() => {
                // Si falla y es una navegación, devolver index.html (SPA fallback)
                if (request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
                return new Response('Sin conexión', { status: 503 });
            });
        })
    );
});
