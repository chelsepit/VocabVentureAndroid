// story-viewer.js - Manual Speak Button (Works with image icons)
// OPTIMIZED: Preloads next segment video while current one plays

let currentStory = null;
let currentSegmentIndex = 0;
let storyData = null;
let currentAudio = null;
let isSpeaking = false;
let isInitialLoad = true;
let savedResumeSegment = 0;
let hasUserChosenResumeAction = false;

// ⚡ Preload cache: keeps the next video blob URL ready
let preloadedVideos = {}; // { segmentIndex: objectURL }
let preloadedVideoElements = {}; // { segmentIndex: HTMLVideoElement }

// Get story ID from URL parameters
function getStoryIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return parseInt(urlParams.get('id')) || 1;
}

// Load story data from JSON
async function loadStoryData(storyId) {
    try {
        const response = await fetch(`../../data/stories/story-${storyId}.json`);
        if (!response.ok) throw new Error('Story not found');
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

// Wait for modal element to exist in DOM
function waitForModal(timeout = 5000) {
    return new Promise((resolve) => {
        if (document.getElementById('resumeModalOverlay')) return resolve(true);
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

        if (userId) {
            const lastViewedRaw = await ipcRenderer.invoke('progress:getLastViewed', {
                userId,
                storyId
            });

            const lastViewedSegment = (lastViewedRaw && typeof lastViewedRaw === 'object')
                ? lastViewedRaw.segmentId
                : lastViewedRaw;

            if (lastViewedSegment && lastViewedSegment > 1) {
                const modal = document.getElementById('resumeModalOverlay');
                if (modal) {
                    showResumeModal(lastViewedSegment);
                    return lastViewedSegment;
                }
                console.warn('⚠️ resumeModalOverlay not found in DOM');
                return lastViewedSegment;
            }
        } else {
            console.warn('⚠️ No userId found.');
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
        savedResumeSegment = savedSegment;
        modal.classList.remove('hidden');
        console.log('📻 Resume modal shown - saved at segment:', savedSegment);
    }
}

// Hide resume modal
function hideResumeModal() {
    const modal = document.getElementById('resumeModalOverlay');
    if (modal) modal.classList.add('hidden');
}

// Start over button handler
function startOver() {
    console.log('🔄 Starting over from beginning');
    hideResumeModal();
    hasUserChosenResumeAction = true;
    isInitialLoad = false;
    currentSegmentIndex = 0;
    if (currentStory) loadSegment(0);
}

// Continue button handler
function continueGame() {
    console.log('▶️ Continuing from last viewed segment:', savedResumeSegment);
    hideResumeModal();
    hasUserChosenResumeAction = true;
    isInitialLoad = false;

    if (currentStory && savedResumeSegment > 0) {
        const segmentIndex = savedResumeSegment - 1;
        if (segmentIndex >= 0 && segmentIndex < currentStory.segments.length) {
            currentSegmentIndex = segmentIndex;
            loadSegment(segmentIndex, { skipProgressSave: true });
        } else {
            loadSegment(0);
        }
    } else {
        loadSegment(0);
    }
}

// ⚡ PRELOAD: Fetch the next segment's video into memory so it's instant when needed
async function preloadNextSegment(currentIndex) {
    if (!currentStory) return;
    
    const nextIndex = currentIndex + 1;
    if (nextIndex >= currentStory.segments.length) return;
    if (preloadedVideos[nextIndex]) return; // Already preloaded
    
    const nextSegment = currentStory.segments[nextIndex];
    if (!nextSegment || !nextSegment.illustration) return;
    
    const videoPath = '../../' + nextSegment.illustration;
    
    try {
        console.log(`⚡ Preloading video for segment ${nextIndex + 1}: ${videoPath}`);
        
        // Fetch the video file and store as a blob URL so it plays from memory
        const response = await fetch(videoPath);
        if (!response.ok) throw new Error('Fetch failed');
        
        const blob = await response.blob();
        const objectURL = URL.createObjectURL(blob);
        preloadedVideos[nextIndex] = objectURL;
        
        // Also prime a hidden video element so the browser decodes the first frame
        const hiddenVideo = document.createElement('video');
        hiddenVideo.src = objectURL;
        hiddenVideo.preload = 'auto';
        hiddenVideo.muted = true;
        hiddenVideo.style.display = 'none';
        hiddenVideo.load(); // Triggers buffering
        document.body.appendChild(hiddenVideo);
        preloadedVideoElements[nextIndex] = hiddenVideo;
        
        console.log(`✅ Segment ${nextIndex + 1} video preloaded`);
    } catch (err) {
        console.warn(`⚠️ Could not preload segment ${nextIndex + 1}:`, err.message);
    }
}

// ⚡ Cleanup old preloaded blobs to avoid memory leaks
function cleanupPreloadedVideo(index) {
    if (preloadedVideos[index]) {
        URL.revokeObjectURL(preloadedVideos[index]);
        delete preloadedVideos[index];
    }
    if (preloadedVideoElements[index]) {
        preloadedVideoElements[index].remove();
        delete preloadedVideoElements[index];
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

    console.log('⏳ Waiting for resumeModalReady...', typeof window.resumeModalReady);
    if (window.resumeModalReady) {
        await window.resumeModalReady;
        console.log('✅ resumeModalReady resolved');
    } else {
        console.warn('⚠️ window.resumeModalReady is not defined — modal may not be loaded!');
    }

    const savedSegment = await checkAndShowResumeModal(storyId);

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

// ⭐ Setup speak button
function setupSpeakButton() {
    console.log('🎤 Setting up speak button...');
    
    let attempts = 0;
    const maxAttempts = 10;
    
    const trySetup = () => {
        const speakBtn = document.getElementById('speakBtn');
        
        if (speakBtn) {
            const newBtn = speakBtn.cloneNode(true);
            speakBtn.parentNode.replaceChild(newBtn, speakBtn);
            
            updateSpeakButtonContent(newBtn, false);
            newBtn.title = 'Click to play audio';
            newBtn.style.cursor = 'pointer';
            
            newBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                toggleSpeak();
            });
            
            console.log('✅ Speak button initialized (MUTED)');
            return true;
        } else {
            attempts++;
            if (attempts < maxAttempts) {
                setTimeout(trySetup, 300);
            } else {
                console.error('❌ Speak button not found after', maxAttempts, 'attempts');
            }
            return false;
        }
    };
    
    trySetup();
}

// ⭐ Update speak button content
function updateSpeakButtonContent(btn, isSpeaking) {
    const icon = btn.querySelector('img.speak-button-icon');
    
    if (icon) {
        icon.src = '../../assets/images/icons/speak-icon.svg';
        icon.alt = isSpeaking ? 'speaking' : 'muted';
    } else {
        btn.innerHTML = isSpeaking ? '🔊' : '🔇';
    }
}

// ⭐ Toggle speak on/off
function toggleSpeak() {
    if (isSpeaking) {
        stopCurrentAudio();
    } else {
        if (!currentStory || !currentStory.segments[currentSegmentIndex]) return;
        
        const segment = currentStory.segments[currentSegmentIndex];
        const selectedVoice = localStorage.getItem('selected_voice') || 'boy';
        const audioPath = segment[`audio-${selectedVoice}`];
        
        if (audioPath) {
            playSegmentAudio(audioPath);
        } else {
            console.error('❌ No audio path found');
        }
    }
}

// ⭐ Update speak button
function updateSpeakButton() {
    const speakBtn = document.getElementById('speakBtn');
    if (speakBtn) {
        updateSpeakButtonContent(speakBtn, isSpeaking);
        speakBtn.title = isSpeaking ? 'Click to stop audio' : 'Click to play audio';
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
                if (currentAudio) currentAudio.volume = parseInt(volume) / 100;
            });
        }
    }, 500);
}

// Load a specific segment
function loadSegment(index, options = {}) {
    if (!currentStory || index < 0 || index >= currentStory.segments.length) return;

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
    
    const storyTextElement = document.getElementById('storyText');
    const contentContainer = document.getElementById('storyContent');
    
    // Hide content while video plays
    contentContainer.style.opacity = '0';
    storyTextElement.style.opacity = '0';
    storyTextElement.style.transform = 'translateY(30px)';
    storyTextElement.style.transition = 'none';
    storyTextElement.style.animation = 'none';
    
    const videoSource = document.getElementById('videoSource');
    const video = document.getElementById('storyVideo');
    
    // ⚡ Use preloaded blob URL if available, otherwise fall back to file path
    const videoPath = '../../' + segment.illustration;
    const preloadedSrc = preloadedVideos[index];
    
    if (preloadedSrc) {
        console.log(`⚡ Using preloaded video for segment ${index + 1}`);
        videoSource.src = preloadedSrc;
    } else {
        console.log(`📂 Loading video directly for segment ${index + 1}`);
        videoSource.src = videoPath;
    }
    
    video.load();
    video.loop = false;
    
    // Show content when video ends
    video.onended = () => {
        video.currentTime = video.duration;
        
        setTimeout(() => {
            contentContainer.style.transition = 'opacity 0.8s ease-out';
            contentContainer.style.opacity = '1';
            
            storyTextElement.style.transition = 'opacity 0.8s ease-out, transform 1s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
            storyTextElement.style.opacity = '1';
            storyTextElement.style.transform = 'translateY(0)';
            
            setTimeout(() => {
                storyTextElement.style.transition = 'none';
                storyTextElement.style.animation = 'gentleFloat 3s ease-in-out infinite';
            }, 1000);
        }, 300);
        
        // ⚡ Start preloading the NEXT segment as soon as current video finishes
        preloadNextSegment(index);
    };
    
    // ⚡ Also kick off preload immediately when segment loads
    // (handles cases where user navigates before video ends)
    video.play();
    
    // Start preloading next segment right away (in parallel with current video playing)
    preloadNextSegment(index);
    
    // Cleanup the blob we just consumed (previous segment's preload for index-1)
    if (index > 0) {
        cleanupPreloadedVideo(index - 1);
    }
    
    updateStoryText(segment);
    
    isSpeaking = false;
    updateSpeakButton();
    updateNavigationButtons();
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
    
    isSpeaking = true;
    updateSpeakButton();
    
    currentAudio.play().catch(error => {
        console.log('Audio play prevented:', error);
        isSpeaking = false;
        updateSpeakButton();
    });
    
    currentAudio.addEventListener('ended', () => {
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
        if (currentSegmentIndex > 0) loadSegment(currentSegmentIndex - 1);
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

// Save last viewed segment
async function saveLastViewedSegment(segmentNumber) {
    try {
        const { ipcRenderer } = require('electron');
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        const fallbackUserId = parseInt(localStorage.getItem('lastUserId'));
        const userId = currentUser?.id || fallbackUserId;
        const storyId = getStoryIdFromUrl();

        sessionStorage.setItem(`lastViewed_story_${storyId}`, segmentNumber);

        if (userId) {
            await ipcRenderer.invoke('progress:saveLastViewed', {
                userId: currentUser.id || fallbackUserId,
                storyId,
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
                storyId,
                segmentId: segmentNumber
            });
            console.log(`✅ Segment ${segmentNumber} marked as completed`);
        }
    } catch (error) {
        console.error('Error marking segment as completed:', error);
    }
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
                }, 100);
            });
            
            girlVoice.addEventListener('click', () => {
                stopCurrentAudio();
                setTimeout(() => {
                    updateStoryText(currentStory.segments[currentSegmentIndex]);
                }, 100);
            });
        }
    }, 500);
});

// Cleanup - save current segment position when leaving
window.addEventListener('beforeunload', () => {
    stopCurrentAudio();
    
    // Revoke all preloaded blob URLs to free memory
    Object.values(preloadedVideos).forEach(url => URL.revokeObjectURL(url));
    preloadedVideos = {};
    
    if (currentStory && currentSegmentIndex >= 0) {
        const { ipcRenderer } = require('electron');
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        const userId = currentUser?.id || parseInt(localStorage.getItem('lastUserId'));
        const storyId = getStoryIdFromUrl();
        if (userId) {
            ipcRenderer.invoke('progress:saveLastViewed', {
                userId,
                storyId,
                segmentId: currentSegmentIndex + 1
            });
        }
    }
});

// Initialize
window.addEventListener('DOMContentLoaded', initStoryViewer);