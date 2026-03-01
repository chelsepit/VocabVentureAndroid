// orientation.js
// ─────────────────────────────────────────────────────────────────────────────
// Central orientation controller for VocabVenture.
//
// KEY FIX: Use 'landscape-primary' / 'portrait-primary' instead of the soft
// 'landscape' / 'portrait' values. The soft values on Android allow the sensor
// to switch between primary/secondary variants, which can break the lock.
// The 'primary' variants tell the OS to pin to exactly one rotation and ignore
// the physical sensor entirely.
//
// KEY FIX 2: A continuous orientationchange guard is registered whenever a lock
// is active. If Android's WebView ever releases the lock during navigation, the
// guard immediately re-applies it — the user cannot break out by rotating.
// ─────────────────────────────────────────────────────────────────────────────

// ── Internal state ────────────────────────────────────────────────────────────

/** @type {'landscape-primary' | 'portrait-primary' | null} */
let _activeLock = null;

// Keeps a reference so we can remove the listener cleanly when resetting.
let _guardHandler = null;

// ── Helper: safely resolve the Capacitor ScreenOrientation plugin ────────────

async function getPlugin() {
    try {
        const { ScreenOrientation } = await import('@capacitor/screen-orientation');
        return ScreenOrientation;
    } catch {
        // No-op fallback for browser testing
        return {
            lock:        async () => {},
            unlock:      async () => {},
            orientation: async () => ({ type: 'portrait-primary' }),
        };
    }
}

// ── Internal: apply lock + register continuous guard ─────────────────────────

/**
 * Applies the Capacitor lock AND registers a continuous orientationchange
 * listener that immediately re-applies the lock if Android ever releases it.
 *
 * @param {'landscape-primary' | 'portrait-primary'} orientationType
 */
async function applyLock(orientationType) {
    const plugin = await getPlugin();

    // Remove any existing guard before registering a new one
    _removeGuard();

    _activeLock = orientationType;
    await plugin.lock({ orientation: orientationType });
    console.log(`[Orientation] Locked → ${orientationType}`);

    // Continuous guard: re-lock if the OS/sensor ever breaks it
    _guardHandler = async () => {
        if (!_activeLock) return;
        const current = screen.orientation?.type ?? '';
        if (!current.startsWith(_activeLock.split('-')[0])) {
            // Wrong orientation detected — re-apply immediately
            console.warn(`[Orientation] Lock broken (got ${current}), re-applying ${_activeLock}`);
            const p = await getPlugin();
            await p.lock({ orientation: _activeLock });
        }
    };

    screen.orientation?.addEventListener('change', _guardHandler);
    window.addEventListener('orientationchange', _guardHandler);
}

function _removeGuard() {
    if (_guardHandler) {
        screen.orientation?.removeEventListener('change', _guardHandler);
        window.removeEventListener('orientationchange', _guardHandler);
        _guardHandler = null;
    }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Lock the screen to landscape-primary and mark the story as active.
 * Call this when the user taps "Switch to Landscape" in the modal.
 *
 * Uses 'landscape-primary' (not soft 'landscape') so the OS cannot
 * rotate between primary and secondary landscape on sensor input.
 */
export async function lockLandscape() {
    await applyLock('landscape-primary');
    sessionStorage.setItem('vocabventure_story_active', '1');
    sessionStorage.removeItem('vocabventure_quiz_mode');
}

/**
 * Lock the screen to portrait-primary and mark quiz mode active.
 * Call this when the story completes and the user navigates forward.
 *
 * Uses 'portrait-primary' (not soft 'portrait') so the sensor cannot
 * override it while the user is on quiz / finish pages.
 */
export async function lockPortrait() {
    await applyLock('portrait-primary');
    sessionStorage.setItem('vocabventure_quiz_mode', '1');
    sessionStorage.removeItem('vocabventure_story_active');
}

/**
 * Fully unlock orientation (sensors take over).
 * Call this only when genuinely releasing control (e.g. returning to home).
 */
export async function unlockOrientation() {
    _activeLock = null;
    _removeGuard();
    const plugin = await getPlugin();
    await plugin.unlock();
    console.log('[Orientation] Unlocked');
}

/**
 * Returns true if a story is currently active (landscape lock is on).
 */
export function isStoryActive() {
    return sessionStorage.getItem('vocabventure_story_active') === '1';
}

/**
 * Returns true if quiz mode is active (portrait lock is on).
 */
export function isQuizMode() {
    return sessionStorage.getItem('vocabventure_quiz_mode') === '1';
}

/**
 * Called at the top of every quiz/finish page.
 * Re-applies the portrait lock silently — handles the WebView navigation gap.
 * Also re-registers the continuous guard for this page's lifetime.
 */
export async function enforceQuizOrientation() {
    if (isQuizMode()) {
        await applyLock('portrait-primary');
        console.log('[Orientation] Re-enforced portrait for quiz/finish page');
    }
}

/**
 * Called at the top of the story-viewer page.
 * Re-applies the landscape lock silently if the story was already active
 * (e.g. user navigated back). Also re-registers the continuous guard.
 */
export async function enforceStoryOrientation() {
    if (isStoryActive()) {
        await applyLock('landscape-primary');
        console.log('[Orientation] Re-enforced landscape for story page');
    }
}

/**
 * Clear all orientation state and unlock.
 * Call this when the user returns to the app home / library.
 */
export async function resetOrientation() {
    _activeLock = null;
    _removeGuard();
    const plugin = await getPlugin();
    await plugin.unlock();
    sessionStorage.removeItem('vocabventure_story_active');
    sessionStorage.removeItem('vocabventure_quiz_mode');
    console.log('[Orientation] State reset');
}