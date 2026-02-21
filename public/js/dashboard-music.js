// dashboard-music.js - Persistent Background Music for All Dashboard Pages

let dashboardMusic = null;
let isMusicPlaying = false;

const STORAGE_KEY = 'dashboard_music_state';
const ACTIVE_KEY  = 'dashboard_music_active';

// ⭐ FIX BUG 1 & 2: Clear the ACTIVE_KEY immediately when this script loads.
// Previously, the flag was never cleared on app open or when returning from a
// story page. This caused:
//   - App open: flag still true from last session → no music created → silence
//   - Return from story: flag still true → dashboard music never started →
//     story music kept playing in background
// Clearing it here (script load = new page) forces fresh audio creation every time.
sessionStorage.removeItem(ACTIVE_KEY);

const DASHBOARD_PAGES_EXCLUDE = [
    'story-viewer', 'pick-a-word', 'decode-the-word',
    'lets-review', 'game-result', 'finish-book'
];

function initDashboardMusic() {
    const currentPage = window.location.pathname;
    const shouldExclude = DASHBOARD_PAGES_EXCLUDE.some(page => currentPage.includes(page));

    if (shouldExclude) {
        console.log('🎵 Skipping dashboard music on story/quiz page');
        return;
    }

    const soundEnabled = localStorage.getItem('sound_enabled');
    if (soundEnabled === 'false') {
        console.log('🔇 Sound disabled, not playing dashboard music');
        return;
    }

    const musicState = getMusicState();

    if (musicState && musicState.isPlaying && musicState.currentTime > 0) {
        console.log('🎵 Resuming dashboard music from saved position');
        resumeDashboardMusic(musicState);
    } else {
        console.log('🎵 Starting fresh dashboard music');
        playDashboardMusic();
    }

    console.log('✅ Dashboard music initialized');
}

function getMusicState() {
    try {
        const state = sessionStorage.getItem(STORAGE_KEY);
        return state ? JSON.parse(state) : null;
    } catch (e) {
        return null;
    }
}

function saveMusicState(currentTime, isPlaying) {
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
            currentTime: currentTime,
            isPlaying: isPlaying,
            timestamp: Date.now()
        }));
    } catch (e) {
        console.error('Failed to save music state:', e);
    }
}

function resumeDashboardMusic(state) {
    // ACTIVE_KEY was cleared on script load, so this is always safe to create
    dashboardMusic = new Audio('../../assets/audio/background-music/dashboard_music.mp3');

    const musicVolume = parseInt(localStorage.getItem('music_volume') || '30') / 100;
    dashboardMusic.volume = musicVolume;
    dashboardMusic.loop = true;

    if (state.currentTime) {
        dashboardMusic.currentTime = state.currentTime;
    }

    setupAudioListeners();

    dashboardMusic.play()
        .then(() => {
            console.log('✅ Dashboard music resumed from', Math.round(state.currentTime), 'seconds');
            isMusicPlaying = true;
            sessionStorage.setItem(ACTIVE_KEY, 'true');
        })
        .catch(error => {
            console.error('❌ Dashboard music resume prevented:', error);
            sessionStorage.removeItem(ACTIVE_KEY);
        });
}

function playDashboardMusic() {
    if (dashboardMusic) {
        dashboardMusic.play().catch(err => console.log('Music play prevented:', err));
        isMusicPlaying = true;
        return;
    }

    dashboardMusic = new Audio('../../assets/audio/background-music/dashboard_music.mp3');

    const musicVolume = parseInt(localStorage.getItem('music_volume') || '80') / 100;
    dashboardMusic.volume = musicVolume;
    dashboardMusic.loop = true;

    console.log('🎵 Dashboard music created');
    console.log('🎵 Audio file path:', dashboardMusic.src);
    console.log('🎵 Volume set to:', Math.round(musicVolume * 100) + '%');

    setupAudioListeners();

    dashboardMusic.play()
        .then(() => {
            console.log('✅ Dashboard music playing successfully!');
            isMusicPlaying = true;
            sessionStorage.setItem(ACTIVE_KEY, 'true');
        })
        .catch(error => {
            console.error('❌ Dashboard music play prevented:', error);
            sessionStorage.removeItem(ACTIVE_KEY);
        });

    console.log(`🎵 Dashboard music playing at ${Math.round(musicVolume * 100)}%`);
}

function setupAudioListeners() {
    if (!dashboardMusic) return;

    dashboardMusic.addEventListener('canplay', () => {
        console.log('✅ Music can play - audio file loaded');
    });

    dashboardMusic.addEventListener('error', (e) => {
        console.error('❌ Music error:', e);
        console.error('❌ Error details:', dashboardMusic.error);
    });

    dashboardMusic.addEventListener('timeupdate', () => {
        if (isMusicPlaying) {
            saveMusicState(dashboardMusic.currentTime, true);
        }
    });
}

function stopDashboardMusic() {
    if (dashboardMusic) {
        dashboardMusic.pause();
        dashboardMusic.currentTime = 0;
        isMusicPlaying = false;
        saveMusicState(0, false);
        sessionStorage.removeItem(ACTIVE_KEY);
        console.log('🔇 Dashboard music stopped');
    }
}

function pauseDashboardMusic() {
    if (dashboardMusic) {
        const currentTime = dashboardMusic.currentTime;
        dashboardMusic.pause();
        isMusicPlaying = false;
        saveMusicState(currentTime, false);
        sessionStorage.removeItem(ACTIVE_KEY);
        console.log('⏸️ Dashboard music paused at', Math.round(currentTime), 'seconds');
    }
}

function updateDashboardMusicVolume(volume) {
    if (dashboardMusic) {
        dashboardMusic.volume = volume / 100;
        console.log(`🎵 Dashboard music volume: ${volume}%`);
    }
}

function toggleDashboardMusic(enabled) {
    if (enabled) {
        playDashboardMusic();
    } else {
        stopDashboardMusic();
    }
}

window.addEventListener('storage', (e) => {
    if (e.key === 'sound_enabled') {
        toggleDashboardMusic(e.newValue === 'true');
    }
});

window.addEventListener('storage', (e) => {
    if (e.key === 'music_volume' && dashboardMusic) {
        updateDashboardMusicVolume(parseInt(e.newValue));
    }
});

window.addEventListener('beforeunload', () => {
    if (dashboardMusic && isMusicPlaying) {
        saveMusicState(dashboardMusic.currentTime, true);
        console.log('💾 Saved music position for next page');
    }
});

window.addEventListener('pagehide', () => {
    if (dashboardMusic && isMusicPlaying) {
        saveMusicState(dashboardMusic.currentTime, true);
        console.log('💾 Saved music position (pagehide)');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initDashboardMusic, 500);
});

window.dashboardMusic = {
    play: playDashboardMusic,
    stop: stopDashboardMusic,
    pause: pauseDashboardMusic,
    updateMusicVolume: updateDashboardMusicVolume,
    toggle: toggleDashboardMusic
};