// dashboard-music.js - Persistent Background Music for All Dashboard Pages

let dashboardMusic = null;
let isMusicPlaying = false;

// ⭐ PERSISTENCE: Store audio in sessionStorage so it persists across page navigations
const STORAGE_KEY = 'dashboard_music_state';

// ⭐ Initialize dashboard background music
function initDashboardMusic() {
    // Don't play on story-viewer or quiz pages (they have their own music)
    const currentPage = window.location.pathname;
    const excludePages = ['story-viewer', 'pick-a-word', 'decode-the-word', 'lets-review', 'game-result', 'finish-book'];
    
    const shouldExclude = excludePages.some(page => currentPage.includes(page));
    if (shouldExclude) {
        console.log('🎵 Skipping dashboard music on this page (story/quiz page)');
        // Don't stop music if it's playing - let story music take over
        return;
    }
    
    // Check if sound is enabled
    const soundEnabled = localStorage.getItem('sound_enabled');
    if (soundEnabled === 'false') {
        console.log('🔇 Sound disabled, not playing dashboard music');
        return;
    }
    
    // ⭐ PERSISTENCE: Check if music is already playing (from another dashboard page)
    const musicState = getMusicState();
    
    if (musicState && musicState.isPlaying) {
        console.log('🎵 Music already playing from another page, resuming...');
        resumeDashboardMusic(musicState);
    } else {
        console.log('🎵 Starting fresh dashboard music');
        playDashboardMusic();
    }
    
    console.log('✅ Dashboard music initialized');
}

// ⭐ Get music state from sessionStorage
function getMusicState() {
    try {
        const state = sessionStorage.getItem(STORAGE_KEY);
        return state ? JSON.parse(state) : null;
    } catch (e) {
        return null;
    }
}

// ⭐ Save music state to sessionStorage
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

// ⭐ Resume music from saved state
function resumeDashboardMusic(state) {
    if (dashboardMusic) {
        return; // Already have music instance
    }
    
    // Create new audio
    dashboardMusic = new Audio('../../assets/audio/background-music/dashboard_music.mp3');
    
    // Set volume
    const musicVolume = parseInt(localStorage.getItem('music_volume') || '30') / 100;
    dashboardMusic.volume = musicVolume;
    
    // Loop forever
    dashboardMusic.loop = true;
    
    // Resume from saved position
    if (state.currentTime) {
        dashboardMusic.currentTime = state.currentTime;
    }
    
    // Add event listeners
    setupAudioListeners();
    
    // Play
    dashboardMusic.play()
        .then(() => {
            console.log('✅ Dashboard music resumed from', Math.round(state.currentTime), 'seconds');
            isMusicPlaying = true;
        })
        .catch(error => {
            console.error('❌ Dashboard music resume prevented:', error);
        });
}

// Play dashboard background music
function playDashboardMusic() {
    if (dashboardMusic) {
        // Music already exists, just play it
        dashboardMusic.play().catch(err => console.log('Music play prevented:', err));
        isMusicPlaying = true;
        return;
    }
    
    // Create new audio
    dashboardMusic = new Audio('../../assets/audio/background-music/dashboard_music.mp3');
    
    // Set volume using music_volume setting (default 80% - much louder!)
    const musicVolume = parseInt(localStorage.getItem('music_volume') || '80') / 100;
    dashboardMusic.volume = musicVolume;
    
    console.log('🎵 Dashboard music created');
    console.log('🎵 Audio file path:', dashboardMusic.src);
    console.log('🎵 Volume set to:', Math.round(musicVolume * 100) + '%');
    
    // Loop forever
    dashboardMusic.loop = true;
    
    // Setup listeners
    setupAudioListeners();
    
    // Play
    dashboardMusic.play()
        .then(() => {
            console.log('✅ Dashboard music playing successfully!');
            isMusicPlaying = true;
        })
        .catch(error => {
            console.error('❌ Dashboard music play prevented:', error);
        });
    
    console.log(`🎵 Dashboard music playing at ${Math.round(musicVolume * 100)}%`);
}

// ⭐ Setup audio event listeners
function setupAudioListeners() {
    if (!dashboardMusic) return;
    
    dashboardMusic.addEventListener('canplay', () => {
        console.log('✅ Music can play - audio file loaded');
    });
    
    dashboardMusic.addEventListener('error', (e) => {
        console.error('❌ Music error:', e);
        console.error('❌ Error details:', dashboardMusic.error);
    });
    
    // ⭐ PERSISTENCE: Save current time periodically
    dashboardMusic.addEventListener('timeupdate', () => {
        if (isMusicPlaying) {
            saveMusicState(dashboardMusic.currentTime, true);
        }
    });
}

// Stop dashboard music
function stopDashboardMusic() {
    if (dashboardMusic) {
        dashboardMusic.pause();
        dashboardMusic.currentTime = 0;
        isMusicPlaying = false;
        saveMusicState(0, false);
        console.log('🔇 Dashboard music stopped');
    }
}

// Pause dashboard music (without resetting)
function pauseDashboardMusic() {
    if (dashboardMusic) {
        const currentTime = dashboardMusic.currentTime;
        dashboardMusic.pause();
        isMusicPlaying = false;
        saveMusicState(currentTime, false);
        console.log('⏸️ Dashboard music paused at', Math.round(currentTime), 'seconds');
    }
}

// Update dashboard music volume
function updateDashboardMusicVolume(volume) {
    if (dashboardMusic) {
        dashboardMusic.volume = volume / 100;
        console.log(`🎵 Dashboard music volume: ${volume}%`);
    }
}

// Toggle dashboard music on/off
function toggleDashboardMusic(enabled) {
    if (enabled) {
        playDashboardMusic();
    } else {
        stopDashboardMusic();
    }
}

// Listen for sound toggle changes
window.addEventListener('storage', (e) => {
    if (e.key === 'sound_enabled') {
        const enabled = e.newValue === 'true';
        toggleDashboardMusic(enabled);
    }
});

// Listen for music volume changes
window.addEventListener('storage', (e) => {
    if (e.key === 'music_volume' && dashboardMusic) {
        updateDashboardMusicVolume(parseInt(e.newValue));
    }
});

// ⭐ PERSISTENCE: Save state before page unload (but don't stop music)
window.addEventListener('beforeunload', () => {
    if (dashboardMusic && isMusicPlaying) {
        saveMusicState(dashboardMusic.currentTime, true);
        console.log('💾 Saved music position for next page');
    }
});

// ⭐ PERSISTENCE: Save state when navigating away
window.addEventListener('pagehide', () => {
    if (dashboardMusic && isMusicPlaying) {
        saveMusicState(dashboardMusic.currentTime, true);
        console.log('💾 Saved music position (pagehide)');
    }
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Small delay to ensure page is ready
    setTimeout(initDashboardMusic, 500);
});

// Export functions
window.dashboardMusic = {
    play: playDashboardMusic,
    stop: stopDashboardMusic,
    pause: pauseDashboardMusic,
    updateMusicVolume: updateDashboardMusicVolume,
    toggle: toggleDashboardMusic
};