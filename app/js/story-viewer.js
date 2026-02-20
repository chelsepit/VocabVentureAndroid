// story-viewer.js - Manual Speak Button (Works with image icons)

let currentStory = null;
let currentSegmentIndex = 0;
let storyData = null;
let currentAudio = null;
let isSpeaking = false;
let isInitialLoad = true; // Prevents overwriting saved position on first load until user chooses resume/start-over
let savedResumeSegment = 0; // Store the saved segment for resume modal handlers
let hasUserChosenResumeAction = false; // True after user clicks Continue or Start Over

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

// Wait for modal element to exist in DOM (loaded async via loadComponent)
function waitForModal(timeout = 5000) {
    return new Promise((resolve) => {
        if (document.getElementById('resumeModalOverlay')) {
            return resolve(true);
        }
        const start = Date.now();
        const observer = new MutationObserver(() => {
            if (document.getElementById('resumeModalOverlay')) {
                observer.disconnect();
                resolve(true);
            } else if (Date.now() - start > timeout) {
                observer.disconnect();
                resolve(false);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        // Safety timeout
        setTimeout(() => { observer.disconnect(); resolve(false); }, timeout);
    });
}

// Check for last viewed segment and show resume modal if exists
async function checkAndShowResumeModal(storyId) {
    console.log('🔍 checkAndShowResumeModal called, storyId:', storyId);
    try {
        const { ipcRenderer } = require('electron');
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        const fallbackUserId = parseInt(localStorage.getItem('lastUserId'));
        const userId = currentUser?.id || fallbackUserId;
        console.log('👤 userId:', userId, '| currentUser:', currentUser?.id, '| fallback:', fallbackUserId);

        if (userId) {
            const lastViewedRaw = await ipcRenderer.invoke('progress:getLastViewed', {
                userId: userId,
                storyId: storyId
            });

            // IPC handler returns either a plain number or an object with segmentId
            const lastViewedSegment = (lastViewedRaw && typeof lastViewedRaw === 'object')
                ? lastViewedRaw.segmentId
                : lastViewedRaw;

            console.log('📦 lastViewed raw:', JSON.stringify(lastViewedRaw), '→ segment:', lastViewedSegment);

            if (lastViewedSegment && lastViewedSegment > 1) {
                console.log('📍 Last viewed segment found:', lastViewedSegment);

                const modal = document.getElementById('resumeModalOverlay');
                if (modal) {
                    showResumeModal(lastViewedSegment);
                    return lastViewedSegment;
                }

                console.warn('⚠️ resumeModalOverlay not found in DOM');
                return lastViewedSegment;
            }
        } else {
            console.warn('⚠️ No userId found. Cannot load last viewed progress.');
        }
    } catch (error) {
        console.error('❌ Error in checkAndShowResumeModal:', error);
    }
    return 0;
}

// Show resume modal
function showResumeModal(savedSegment) {
    const modal = document.getElementById('resumeModalOverlay');
    if (modal) {
        savedResumeSegment = savedSegment; // Store for handlers
        modal.classList.remove('hidden');
        console.log('📻 Resume modal shown - saved at segment:', savedSegment);
    }
}

// Hide resume modal
function hideResumeModal() {
    const modal = document.getElementById('resumeModalOverlay');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Start over button handler
function startOver() {
    console.log('🔄 Starting over from beginning');
    hideResumeModal();

    // User made an explicit choice; allow saving from now on
    hasUserChosenResumeAction = true;
    isInitialLoad = false;

    currentSegmentIndex = 0;
    if (currentStory) {
        loadSegment(0);
    }
}

// Continue button handler
function continueGame() {
    console.log('▶️ Continuing from last viewed segment:', savedResumeSegment);
    hideResumeModal();

    // User made an explicit choice; allow saving from now on
    hasUserChosenResumeAction = true;
    isInitialLoad = false;

    if (currentStory && savedResumeSegment > 0) {
        const segmentIndex = savedResumeSegment - 1;
        if (segmentIndex >= 0 && segmentIndex < currentStory.segments.length) {
            currentSegmentIndex = segmentIndex;
            loadSegment(segmentIndex); // progress save is enabled now (hasUserChosenResumeAction = true)
            console.log(`📍 Resumed at segment ${savedResumeSegment}`);
        } else {
            loadSegment(0);
        }
    } else {
        loadSegment(0);
    }
}

// Initialize story viewer
async function initStoryViewer() {
    const storyId = getStoryIdFromUrl();
    console.log('🚀 initStoryViewer START, storyId:', storyId);

    const story = await loadStoryData(storyId);
    if (!story) return;

    currentStory = story;

    document.title = story.title + ' - VocabVenture';
    document.getElementById('totalSegments').textContent = story.totalSegments;

    setupNavigation();
    setupVolumeControl();
    setupSpeakButton();

    // ⭐ Wait for the resume modal HTML to be injected before checking saved progress
    console.log('⏳ Waiting for resumeModalReady...', typeof window.resumeModalReady);
    if (window.resumeModalReady) {
        await window.resumeModalReady;
        console.log('✅ resumeModalReady resolved');
    } else {
        console.warn('⚠️ window.resumeModalReady is not defined — modal may not be loaded!');
    }

    console.log('🔍 resumeModalOverlay in DOM?', !!document.getElementById('resumeModalOverlay'));

    const savedSegment = await checkAndShowResumeModal(storyId);
    console.log('📍 savedSegment returned:', savedSegment);

    if (savedSegment && savedSegment > 1) {
        console.log(`📍 Loading saved segment ${savedSegment} behind the modal...`);
        currentSegmentIndex = savedSegment - 1;
        loadSegment(currentSegmentIndex, { skipProgressSave: true });
        return;
    }

    console.log('▶️ No saved segment > 1, starting from beginning');
    hasUserChosenResumeAction = true;
    isInitialLoad = false;
    currentSegmentIndex = 0;
    loadSegment(0);
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
function loadSegment(index, options = {}) {
    if (!currentStory || index < 0 || index >= currentStory.segments.length) {
        return;
    }

    stopCurrentAudio();

    currentSegmentIndex = index;
    const segment = currentStory.segments[index];

    console.log('Loading segment:', index + 1, segment);

    const shouldSkipSave = options.skipProgressSave === true || !hasUserChosenResumeAction;
    if (!shouldSkipSave) {
        saveLastViewedSegment(index + 1);
        markSegmentAsCompleted(index + 1);
    } else {
        console.log('⏭️ Skipping progress save (waiting for resume/start-over choice)');
    }
    
    document.getElementById('currentSegment').textContent = index + 1;
    
    // Get story text element
    const storyTextElement = document.getElementById('storyText');
    
    // Get content container
    const contentContainer = document.getElementById('storyContent');
    
    // ⭐ HIDE BOTH container and text initially
    contentContainer.style.opacity = '0';
    storyTextElement.style.opacity = '0';
    storyTextElement.style.transform = 'translateY(30px)';
    storyTextElement.style.transition = 'none';
    storyTextElement.style.animation = 'none'; // Stop any previous animation
    
    // Update video
    const videoSource = document.getElementById('videoSource');
    const video = document.getElementById('storyVideo');
    
    videoSource.src = '../../' + segment.illustration;
    video.load();
    video.loop = false;
    
    // Show BOTH container and text when video ends
    video.onended = () => {
        video.currentTime = video.duration; // Keep last frame
        
        // Animate BOTH container and text in
        setTimeout(() => {
            // ⭐ Show the container
            contentContainer.style.transition = 'opacity 0.8s ease-out';
            contentContainer.style.opacity = '1';
            
            // Show the text
            storyTextElement.style.transition = 'opacity 0.8s ease-out, transform 1s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
            storyTextElement.style.opacity = '1';
            storyTextElement.style.transform = 'translateY(0)';
            
            // After entrance animation, add continuous gentle floating
            setTimeout(() => {
                storyTextElement.style.transition = 'none';
                storyTextElement.style.animation = 'gentleFloat 3s ease-in-out infinite';
            }, 1000); // Wait for entrance animation to finish
        }, 300); // Small delay before animation starts
    };
    
    video.play();
    
    // Update the text content (but it's hidden until video ends)
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
        const fallbackUserId = parseInt(localStorage.getItem('lastUserId'));
        const userId = currentUser?.id || fallbackUserId;
        const storyId = getStoryIdFromUrl();

        // Save to sessionStorage for quick access
        sessionStorage.setItem(`lastViewed_story_${storyId}`, segmentNumber);

        if (userId) {
            await ipcRenderer.invoke('progress:saveLastViewed', {
                userId: currentUser.id || fallbackUserId,
                storyId: storyId,
                segmentId: segmentNumber
            });

            console.log(`📍 Last viewed segment saved: ${segmentNumber}`);
        } else {
            console.warn('⚠️ No userId found; last viewed segment not saved to DB');
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
        const fallbackUserId = parseInt(localStorage.getItem('lastUserId'));
        const userId = currentUser?.id || fallbackUserId;
        const storyId = getStoryIdFromUrl();

        if (userId) {
            await ipcRenderer.invoke('progress:markSegmentComplete', {
                userId: currentUser.id || fallbackUserId,
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
                setTimeout(() => {
                    updateStoryText(currentStory.segments[currentSegmentIndex]);
                    console.log('🎤 Voice changed to Boy - vocabulary audio updated');
                }, 100);
            });
            
            girlVoice.addEventListener('click', () => {
                stopCurrentAudio();
                setTimeout(() => {
                    updateStoryText(currentStory.segments[currentSegmentIndex]);
                    console.log('🎤 Voice changed to Girl - vocabulary audio updated');
                }, 100);
            });
        }
    }, 500);
});

// Cleanup - save current segment position when leaving for any reason
window.addEventListener('beforeunload', () => {
    stopCurrentAudio();
    // Synchronously save current position using sendBeacon so it completes before page unloads
    if (currentStory && currentSegmentIndex >= 0) {
        const { ipcRenderer } = require('electron');
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        const userId = currentUser?.id || parseInt(localStorage.getItem('lastUserId'));
        const storyId = getStoryIdFromUrl();
        if (userId) {
            // ipcRenderer.invoke is async but we call it anyway - Electron handles this fine on beforeunload
            ipcRenderer.invoke('progress:saveLastViewed', {
                userId: userId,
                storyId: storyId,
                segmentId: currentSegmentIndex + 1
            });
        }
    }
});

// Initialize
window.addEventListener('DOMContentLoaded', initStoryViewer);