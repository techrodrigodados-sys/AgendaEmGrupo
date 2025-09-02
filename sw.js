const CACHE_NAME = 'groupscheduler-v2';
const urlsToCache = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/manifest.json'
];

// Cache dos arquivos
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});

// Notificações Push em Background
self.addEventListener('push', event => {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body,
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23667eea"/><text y="0.9em" font-size="80" x="50%" text-anchor="middle" fill="white">🗓️</text></svg>',
            badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="0.9em" font-size="90">🔔</text></svg>',
            vibrate: [200, 100, 200, 100, 200],
            requireInteraction: true,
            actions: [
                {
                    action: 'join',
                    title: '✅ Confirmar Presença',
                    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="0.9em" font-size="90">✅</text></svg>'
                },
                {
                    action: 'snooze',
                    title: '⏰ Lembrar em 5min',
                    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="0.9em" font-size="90">⏰</text></svg>'
                }
            ],
            data: {
                eventId: data.eventId,
                url: '/?event=' + data.eventId
            }
        };

        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

// Clique nas notificações
self.addEventListener('notificationclick', event => {
    event.notification.close();

    if (event.action === 'join') {
        // Confirmar presença no evento
        event.waitUntil(
            clients.openWindow('/?action=join&event=' + event.notification.data.eventId)
        );
    } else if (event.action === 'snooze') {
        // Reagendar notificação para 5 minutos
        setTimeout(() => {
            self.registration.showNotification('🔔 Lembrete - ' + event.notification.title, {
                body: 'Seu evento está começando agora!',
                icon: event.notification.icon,
                vibrate: [300, 100, 300],
                requireInteraction: true
            });
        }, 5 * 60 * 1000); // 5 minutos
    } else {
        // Abrir o app
        event.waitUntil(
            clients.openWindow(event.notification.data.url || '/')
        );
    }
});

// Background Sync para notificações offline
self.addEventListener('sync', event => {
    if (event.tag === 'background-sync-notifications') {
        event.waitUntil(checkAndSendNotifications());
    }
});

async function checkAndSendNotifications() {
    // Verificar eventos que precisam de notificação
    const cache = await caches.open(CACHE_NAME);
    const eventsResponse = await cache.match('/events');
    
    if (eventsResponse) {
        const events = await eventsResponse.json();
        const now = new Date();
        
        events.forEach(event => {
            const eventTime = new Date(event.date + 'T' + event.time);
            const notificationTime = new Date(eventTime.getTime() - (15 * 60 * 1000)); // 15 min antes
            
            if (Math.abs(now.getTime() - notificationTime.getTime()) < 60000) { // 1 minuto de tolerância
                self.registration.showNotification(`🗓️ ${event.title}`, {
                    body: `Seu evento "${event.title}" começará em 15 minutos!\n📍 Grupo: ${event.groupName}`,
                    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23667eea"/><text y="0.9em" font-size="80" x="50%" text-anchor="middle" fill="white">🗓️</text></svg>',
                    vibrate: [200, 100, 200, 100, 200, 100, 400],
                    requireInteraction: true,
                    actions: [
                        { action: 'join', title: '✅ Confirmar Presença' },
                        { action: 'calendar', title: '📅 Adicionar ao Calendário' }
                    ]
                });
            }
        });
    }
}
