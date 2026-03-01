// finish-book-orientation.js
// ─────────────────────────────────────────────────────────────────────────────
// Handles portrait enforcement on finish-book.html.
// Auto-runs on DOMContentLoaded — no manual call needed in finish-book.js.
// ─────────────────────────────────────────────────────────────────────────────

import { lockPortrait, enforceQuizOrientation } from './orientation.js';

function getCurrentOrientationType() {
    if (screen.orientation && screen.orientation.type) {
        return screen.orientation.type;
    }
    const angle = window.orientation ?? 0;
    return (angle === 90 || angle === -90) ? 'landscape-primary' : 'portrait-primary';
}

function dismissOverlay(overlay) {
    overlay.classList.remove('orient-overlay--visible');
    overlay.addEventListener('transitionend', () => {
        overlay.style.display = 'none';
    }, { once: true });
}

async function initOrientationGuard() {
    // Re-apply portrait-primary lock + re-register the continuous sensor guard
    await lockPortrait();

    // Sync sessionStorage state
    await enforceQuizOrientation();

    const overlay = document.getElementById('portraitOverlay');
    const btn     = document.getElementById('continuePortraitBtn');

    if (!overlay || !btn) return;

    const isLandscape = getCurrentOrientationType().startsWith('landscape');

    if (!isLandscape) {
        // Already portrait — nothing to show
        return;
    }

    // Device is still physically in landscape — show the reminder overlay
    overlay.classList.add('orient-overlay--visible');

    // Auto-dismiss when the user physically rotates to portrait
    const rotationHandler = () => {
        if (!getCurrentOrientationType().startsWith('landscape')) {
            dismissOverlay(overlay);
            screen.orientation?.removeEventListener('change', rotationHandler);
            window.removeEventListener('orientationchange', rotationHandler);
        }
    };
    screen.orientation?.addEventListener('change', rotationHandler);
    window.addEventListener('orientationchange', rotationHandler);

    // Button: re-apply the OS lock and wait for physical rotation
    btn.addEventListener('click', async () => {
        btn.disabled    = true;
        btn.textContent = 'Rotating...';

        await lockPortrait();

        if (!getCurrentOrientationType().startsWith('landscape')) {
            // Already rotated — dismiss now
            dismissOverlay(overlay);
            screen.orientation?.removeEventListener('change', rotationHandler);
            window.removeEventListener('orientationchange', rotationHandler);
        } else {
            // Still landscape — keep overlay visible, rotation listener will dismiss
            btn.textContent = 'Please rotate your device ↺';
        }
    });
}

// Auto-run — no manual call needed from finish-book.js
document.addEventListener('DOMContentLoaded', () => {
    initOrientationGuard();
});

export { initOrientationGuard };