// story-viewer.js - Manual Speak Button (Works with image icons)

let currentStory = null;
let currentSegmentIndex = 0;
let storyData = null;
let currentAudio = null;
let isSpeaking = false;

// Get story ID from URL parameters
function getStoryIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return parseInt(urlParams.get('id')) || 1;
}

// Load story data from JSON
async function loadStoryData(storyId) {
    try {
        const response = await fetch(`../../data/stories/story-${storyId}.json`);
        if (!response.ok) {
            throw new Error('Story not found');
        }
        storyData = await response.json();
        console.log('Story loaded:', storyData.title);
        return storyData;
    } catch (error) {
        console.error('Error loading story:', error);
        alert('Failed to load story. Redirecting to library...');
        window.location.href = 'library.html';
        return null;
    }
}

// Stop and cleanup current audio
function stopCurrentAudio() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
        isSpeaking = false;
        updateSpeakButton();
    }
}

// Get segment from URL
function getSegmentFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const segment = parseInt(urlParams.get('segment'));
    return segment && segment > 0 ? segment - 1 : 0;
}

// Initialize story viewer
async function initStoryViewer() {
    const storyId = getStoryIdFromUrl();
    console.log('Loading story ID:', storyId);
    
    const story = await loadStoryData(storyId);
    if (!story) return;
    
    currentStory = story;
    
    const resumeSegment = getSegmentFromUrl();
    currentSegmentIndex = resumeSegment;
    
    console.log('Starting at segment:', currentSegmentIndex + 1);
    
    document.title = story.title + ' - VocabVenture';
    document.getElementById('totalSegments').textContent = story.totalSegments;
    
    loadSegment(currentSegmentIndex);
    setupNavigation();
    setupVolumeControl();
    setupSpeakButton();
}

// ⭐ Setup speak button (works with both emoji and image icons)
function setupSpeakButton() {
    console.log('🎤 Setting up speak button...');
    
    let attempts = 0;
    const maxAttempts = 10;
    
    const trySetup = () => {
        const speakBtn = document.getElementById('speakBtn');
        
        if (speakBtn) {
            console.log('✅ Speak button found!');
            
            // Remove any existing listeners
            const newBtn = speakBtn.cloneNode(true);
            speakBtn.parentNode.replaceChild(newBtn, speakBtn);
            
            // Set initial state to MUTED
            updateSpeakButtonContent(newBtn, false);
            newBtn.title = 'Click to play audio';
            newBtn.style.cursor = 'pointer';
            
            // Add click handler
            newBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('🎤 Speak button clicked!');
                toggleSpeak();
            });
            
            console.log('✅ Speak button initialized (MUTED)');
            return true;
        } else {
            attempts++;
            if (attempts < maxAttempts) {
                console.log(`⏳ Speak button not found, attempt ${attempts}/${maxAttempts}`);
                setTimeout(trySetup, 300);
            } else {
                console.error('❌ Speak button not found after', maxAttempts, 'attempts');
            }
            return false;
        }
    };
    
    trySetup();
}

// ⭐ Update speak button content (handles both emoji and image icons)
function updateSpeakButtonContent(btn, isSpeaking) {
    // Check if button has an img child (icon version)
    const icon = btn.querySelector('img.speak-button-icon');
    
    if (icon) {
        // Image icon version
        if (isSpeaking) {
            icon.src = '../../assets/images/icons/speak-icon.svg';
            icon.alt = 'speaking';
        } else {
            icon.src = '../../assets/images/icons/speak-icon.svg';
            icon.alt = 'muted';
        }
    } else {
        // Emoji version
        if (isSpeaking) {
            btn.innerHTML = '🔊';
        } else {
            btn.innerHTML = '🔇';
        }
    }
}

// ⭐ Toggle speak on/off
function toggleSpeak() {
    console.log('🎤 toggleSpeak called, isSpeaking:', isSpeaking);
    
    if (isSpeaking) {
        stopCurrentAudio();
        console.log('🔇 Audio stopped');
    } else {
        if (!currentStory || !currentStory.segments[currentSegmentIndex]) {
            console.error('❌ No story or segment available');
            return;
        }
        
        const segment = currentStory.segments[currentSegmentIndex];
        const selectedVoice = localStorage.getItem('selected_voice') || 'boy';
        const audioPath = segment[`audio-${selectedVoice}`];
        
        console.log('🎤 Audio path:', audioPath);
        
        if (audioPath) {
            playSegmentAudio(audioPath);
            console.log('🔊 Audio playing');
        } else {
            console.error('❌ No audio path found');
        }
    }
}

// ⭐ Update speak button (finds button each time)
function updateSpeakButton() {
    const speakBtn = document.getElementById('speakBtn');
    if (speakBtn) {
        updateSpeakButtonContent(speakBtn, isSpeaking);
        speakBtn.title = isSpeaking ? 'Click to stop audio' : 'Click to play audio';
        console.log(isSpeaking ? '🔊 Button: SPEAKING' : '🔇 Button: MUTED');
    }
}

// Setup volume control
function setupVolumeControl() {
    setTimeout(() => {
        const volumeSlider = document.getElementById('volumeSlider');
        const volumeValue = document.getElementById('volumeValue');
        
        if (volumeSlider && volumeValue) {
            volumeSlider.addEventListener('input', function() {
                const volume = this.value;
                volumeValue.textContent = volume;
                localStorage.setItem('volume', volume);
                
                if (currentAudio) {
                    currentAudio.volume = parseInt(volume) / 100;
                    console.log(`🔊 Volume adjusted to ${volume}%`);
                }
            });
            
            console.log('✅ Volume control initialized');
        }
    }, 500);
}

// Load a specific segment
function loadSegment(index) {
    if (!currentStory || index < 0 || index >= currentStory.segments.length) {
        return;
    }
    
    stopCurrentAudio();
    
    currentSegmentIndex = index;
    const segment = currentStory.segments[index];
    
    console.log('Loading segment:', index + 1, segment);
    
    saveLastViewedSegment(index + 1);
    markSegmentAsCompleted(index + 1);
    
    document.getElementById('currentSegment').textContent = index + 1;
    
    // Update video
    const videoSource = document.getElementById('videoSource');
    const video = document.getElementById('storyVideo');
    
    videoSource.src = '../../' + segment.illustration;
    video.load();
    video.loop = false;
    
    video.onended = () => {
        video.currentTime = video.duration;
    };
    
    video.play();
    
    updateStoryText(segment);
    
    isSpeaking = false;
    updateSpeakButton();
    
    updateNavigationButtons();
}

// Save last viewed segment
async function saveLastViewedSegment(segmentNumber) {
    try {
        const { ipcRenderer } = require('electron');
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        const storyId = getStoryIdFromUrl();
        
        if (currentUser) {
            await ipcRenderer.invoke('progress:saveLastViewed', {
                userId: currentUser.id,
                storyId: storyId,
                segmentId: segmentNumber
            });
            
            console.log(`📍 Last viewed segment saved: ${segmentNumber}`);
        }
    } catch (error) {
        console.error('Error saving last viewed segment:', error);
    }
}

// Mark segment as completed
async function markSegmentAsCompleted(segmentNumber) {
    try {
        const { ipcRenderer } = require('electron');
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        const storyId = getStoryIdFromUrl();
        
        if (currentUser) {
            await ipcRenderer.invoke('progress:markSegmentComplete', {
                userId: currentUser.id,
                storyId: storyId,
                segmentId: segmentNumber
            });
            
            console.log(`✅ Segment ${segmentNumber} marked as completed`);
        }
    } catch (error) {
        console.error('Error marking segment as completed:', error);
    }
}

// Update story text
function updateStoryText(segment) {
    const storyTextElement = document.getElementById('storyText');
    let textHtml = segment.text;
    const selectedVoice = localStorage.getItem('selected_voice') || 'boy';
    
    if (segment.vocabulary && segment.vocabulary.length > 0) {
        const sortedVocab = [...segment.vocabulary].sort((a, b) => b.word.length - a.word.length);
        
        sortedVocab.forEach(vocab => {
            const word = vocab.word;
            const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\b${escapedWord}\\b`, 'gi');
            
            if (regex.test(textHtml)) {
                regex.lastIndex = 0;
                const vocabAudioPath = vocab[`audio-${selectedVoice}`] || '';
                
                textHtml = textHtml.replace(regex, (match) => {
                    const safeWord = vocab.word.replace(/'/g, "\\'");
                    const safePronunciation = vocab.pronunciation.replace(/'/g, "\\'");
                    const safeSynonym = vocab.synonym.replace(/'/g, "\\'");
                    const safeDefinition = vocab.definition.replace(/'/g, "\\'");
                    const safeAudioPath = vocabAudioPath.replace(/'/g, "\\'");
                    
                    return `<span class="interactive-word" 
                        onclick="showDefinition('${safeWord}', '${safePronunciation}', 'Synonym: ${safeSynonym}', '${safeDefinition}', '${safeAudioPath}')">
                        ${match}
                    </span>`;
                });
            }
        });
    }
    
    storyTextElement.innerHTML = textHtml;
}

// Play segment audio
function playSegmentAudio(audioPath) {
    stopCurrentAudio();
    
    currentAudio = new Audio('../../' + audioPath);
    const volume = parseInt(localStorage.getItem('volume') || '70') / 100;
    currentAudio.volume = volume;
    
    console.log(`🔊 Playing audio: ${audioPath} at ${Math.round(volume * 100)}% volume`);
    
    isSpeaking = true;
    updateSpeakButton();
    
    currentAudio.play().catch(error => {
        console.log('Audio play prevented:', error);
        isSpeaking = false;
        updateSpeakButton();
    });
    
    currentAudio.addEventListener('ended', () => {
        console.log('🔊 Audio ended');
        currentAudio = null;
        isSpeaking = false;
        updateSpeakButton();
    });
}

// Setup navigation
function setupNavigation() {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    prevBtn.addEventListener('click', () => {
        if (currentSegmentIndex > 0) {
            loadSegment(currentSegmentIndex - 1);
        }
    });
    
    nextBtn.addEventListener('click', () => {
        if (currentSegmentIndex < currentStory.segments.length - 1) {
            loadSegment(currentSegmentIndex + 1);
        } else {
            showCompletionScreen();
        }
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft' && currentSegmentIndex > 0) {
            prevBtn.click();
        } else if (e.key === 'ArrowRight') {
            nextBtn.click();
        }
    });
}

// Update navigation buttons
function updateNavigationButtons() {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    if (currentSegmentIndex === 0) {
        prevBtn.style.opacity = '0.5';
        prevBtn.style.cursor = 'not-allowed';
        prevBtn.disabled = true;
    } else {
        prevBtn.style.opacity = '1';
        prevBtn.style.cursor = 'pointer';
        prevBtn.disabled = false;
    }
    
    if (currentSegmentIndex === currentStory.segments.length - 1) {
        nextBtn.textContent = 'Complete ✓';
        nextBtn.style.background = '#4ade80';
    } else {
        nextBtn.textContent = 'Next →';
        nextBtn.style.background = '#FFD93D';
    }
}

// Show completion screen
function showCompletionScreen() {
    stopCurrentAudio();
    
    const storyId = currentStory.id;
    const storyTitle = currentStory.title;
    
    sessionStorage.setItem('quizStoryId', storyId);
    sessionStorage.setItem('completedStory', JSON.stringify({
        id: storyId,
        title: storyTitle,
        totalSegments: currentStory.totalSegments,
        vocabularyCount: currentStory.vocabularySummary ? currentStory.vocabularySummary.length : 0
    }));
    
    window.location.href = `finish-book.html?story=${storyId}`;
}

// Listen for voice changes
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const boyVoice = document.getElementById('boyVoice');
        const girlVoice = document.getElementById('girlVoice');
        
        if (boyVoice && girlVoice) {
            boyVoice.addEventListener('click', () => {
                stopCurrentAudio();
            });
            
            girlVoice.addEventListener('click', () => {
                stopCurrentAudio();
            });
        }
    }, 500);
});

// Cleanup
window.addEventListener('beforeunload', () => {
    stopCurrentAudio();
});

// Initialize
window.addEventListener('DOMContentLoaded', initStoryViewer);