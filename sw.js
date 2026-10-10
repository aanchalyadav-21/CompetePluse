self.addEventListener('install', (e) => {
    console.log('[CompetePulse] Service Worker Installed');
    self.skipWaiting();
});
self.addEventListener('fetch', (e) => {
    // Allows the app to work and be installable on mobile
});