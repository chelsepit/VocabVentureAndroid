// story-music.js - Background Music for Story Viewer (Dynamic based on Story ID)

let storyMusic = null;
let isStoryMusicPlaying = false;

// ⭐ Get story ID from URL parameters
function getStoryId() {
    const urlParams = new URLSearchParams(window.location.search);
    const storyId = urlParams.get('id');
    return storyId ? parseInt(storyId) : 1; // Default to story 1
}

// ⭐ Get the appropriate audio file for the story
function getStoryMusicPath(storyId) {
    // You can customize which story uses which music file
    // For now, we'll use: story-1-audio.mp3, story-2-audio.mp3, story-3-audio.mp3
    // And loop back after story 3
    
    const musicNumber = ((storyId - 1) % 3) + 1; // This will give us 1, 2, or 3
    return `../../assets/audio/background-music/story-${musicNumber}-audio.mp3`;
    
    // Alternative: If you want different mapping, you can do:
    // const musicMap = {
    //     1: 'story-1-audio.mp3',
    //     2: 'story-2-audio.mp3',
    //     3: 'story-3-audio.mp3',
    //     4: 'story-1-audio.mp3',  // Reuse music for story 4
    //     5: 'story-2-audio.mp3',  // Reuse music for story 5
    //     // ... etc
    // };
    // return `../../assets/audio/background-music/${musicMap[storyId] || 'story-1-audio.mp3'}`;
}

// ⭐ Initialize story background music
function initStoryMusic() {
    console.log('🎵 Initializing story background music...');
    
    // Check if sound is enabled
    const soundEnabled = localStorage.getItem('sound_enabled');
    if (soundEnabled === 'false') {
        console.log('🔇 Sound disabled, not playing story music');
        return;
    }
    
    // Play story background music
    playStoryMusic();
}

// Play story background music
function playStoryMusic() {
    if (storyMusic) {
        // Music already exists, just play it
        storyMusic.play().catch(err => console.log('Story music play prevented:', err));
        isStoryMusicPlaying = true;
        return;
    }
    
    // Get current story ID
    const storyId = getStoryId();
    const musicPath = getStoryMusicPath(storyId);
    
    console.log(`🎵 Loading music for Story ${storyId}`);
    console.log(`🎵 Music file: ${musicPath}`);
    
    // Create new audio for story background
    storyMusic = new Audio(musicPath);
    
    // Set volume using music_volume setting (default 80%)
    const musicVolume = parseInt(localStorage.getItem('music_volume') || '80') / 100;
    // Story music should be quieter than dashboard music (50% of music volume)
    storyMusic.volume = musicVolume * 0.5;
    
    console.log('🎵 Story music created');
    console.log('🎵 Audio file path:', storyMusic.src);
    console.log('🎵 Volume set to:', Math.round(musicVolume * 50) + '%');
    
    // Loop forever
    storyMusic.loop = true;
    
    // Add event listeners
    storyMusic.addEventListener('canplay', () => {
        console.log(`✅ Story ${storyId} music can play - audio file loaded`);
    });
    
    storyMusic.addEventListener('error', (e) => {
        console.error('❌ Story music error:', e);
        console.error('❌ Error details:', storyMusic.error);
        console.error(`❌ Could not load: ${musicPath}`);
        console.error('❌ Available music files: story-1-audio.mp3, story-2-audio.mp3, story-3-audio.mp3');
    });
    
    // Play
    storyMusic.play()
        .then(() => {
            console.log(`✅ Story ${storyId} music playing successfully!`);
            isStoryMusicPlaying = true;
        })
        .catch(error => {
            console.error('❌ Story music play prevented:', error);
        });
    
    console.log(`🎵 Story ${storyId} music playing at ${Math.round(musicVolume * 50)}%`);
}

// Stop story music
function stopStoryMusic() {
    if (storyMusic) {
        storyMusic.pause();
        storyMusic.currentTime = 0;
        isStoryMusicPlaying = false;
        console.log('🔇 Story music stopped');
    }
}

// Update story music volume
function updateStoryMusicVolume(volume) {
    console.log(`🔊 updateStoryMusicVolume called with: ${volume}`);
    
    if (storyMusic) {
        // Story music is 50% of the music volume setting
        const newVolume = (volume / 100) * 0.5;
        storyMusic.volume = newVolume;
        console.log(`🎵 Story music volume updated to: ${Math.round(volume * 0.5)}%`);
        console.log(`🎵 Actual volume value: ${newVolume}`);
    } else {
        console.log('⚠️ Story music not initialized yet, volume will apply when music starts');
    }
}

// Toggle story music on/off
function toggleStoryMusic(enabled) {
    if (enabled) {
        playStoryMusic();
    } else {
        stopStoryMusic();
    }
}

// Listen for sound toggle changes
window.addEventListener('storage', (e) => {
    if (e.key === 'sound_enabled') {
        const enabled = e.newValue === 'true';
        toggleStoryMusic(enabled);
    }
});

// Listen for music volume changes
window.addEventListener('storage', (e) => {
    if (e.key === 'music_volume' && storyMusic) {
        updateStoryMusicVolume(parseInt(e.newValue));
    }
});

// Stop music when leaving story page
window.addEventListener('beforeunload', () => {
    stopStoryMusic();
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Delay to ensure page is ready and other scripts are loaded
    setTimeout(initStoryMusic, 800);
});

// Export functions
window.storyMusic = {
    play: playStoryMusic,
    stop: stopStoryMusic,
    updateMusicVolume: updateStoryMusicVolume,
    toggle: toggleStoryMusic
};