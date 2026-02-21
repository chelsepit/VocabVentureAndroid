// app-init.js
// ============================================================
// Include this script in EVERY HTML page as the FIRST module.
// It initializes the Capacitor SQLite DB before any other code runs.
//
// Usage in HTML:
//   <script type="module" src="../../js/app-init.js"></script>
//   (adjust relative path based on page location)
// ============================================================

import { initDB } from './db/db-interface.js';

let initialized = false;

async function bootstrap() {
    if (initialized) return;
    initialized = true;
    try {
        await initDB();
        console.log('✅ VocabVenture DB ready');
        window.__dbReady = true;
        document.dispatchEvent(new CustomEvent('db:ready'));
    } catch (err) {
        console.error('❌ DB init failed:', err);
        // Still dispatch so pages don't hang forever — they'll error gracefully
        document.dispatchEvent(new CustomEvent('db:ready'));
    }
}

// Capacitor native
document.addEventListener('deviceready', bootstrap, { once: true });

// Web / Capacitor browser fallback
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    bootstrap();
} else {
    window.addEventListener('DOMContentLoaded', bootstrap, { once: true });
}