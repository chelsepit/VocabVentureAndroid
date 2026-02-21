// story-viewer.js - Manual Speak Button (Works with image icons)
// Uses bridge.js instead of ipcRenderer — works on Electron AND Android.

let currentStory = null;
let currentSegmentIndex = 0;
let storyData = null;
let currentAudio = null;
let isSpeaking = false;
let isInitialLoad = true;
let savedResumeSegment = 0;
let hasUserChosenResumeAction = false;

function getStoryIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return parseInt(urlParams.get('id')) || 1;
}

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

function stopCurrentAudio() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
        isSpeaking = false;
        updateSpeakButton();
    }
}

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

async function checkAndShowResumeModal(storyId) {
    console.log('🔍 checkAndShowResumeModal called, storyId:', storyId);
    try {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        const fallbackUserId = parseInt(localStorage.getItem('lastUserId'));
        const userId = currentUser?.id || fallbackUserId;

        if (userId) {
            const lastViewedRaw = await bridge.invoke('progress:getLastViewed', {
                userId,
                storyId
            });

            const lastViewedSegment = (lastViewedRaw && typeof lastViewedRaw === 'object')
                ? lastViewedRaw.segmentId
                : lastViewedRaw;

            console.log('📦 lastViewed segment:', lastViewedSegment);

            if (lastViewedSegment && lastViewedSegment > 1) {
                const modal = document.getElementById('resumeModalOverlay');
                if (modal) {
                    showResumeModal(lastViewedSegment);
                    return lastViewedSegment;
                }
                console.warn('⚠️ resumeModalOverlay not found in DOM');
                return lastViewedSegment;
            }
        }
    } catch (error) {
        console.error('❌ Error in checkAndShowResumeModal:', error);
    }
    return 0;
}

function showResumeModal(savedSegment) {
    const modal = document.getElementById('resumeModalOverlay');
    if (modal) {
        savedResumeSegment = savedSegment;
        modal.classList.remove('hidden');
    }
}

function hideResumeModal() {
    const modal = document.getElementById('resumeModalOverlay');
    if (modal) modal.classList.add('hidden');
}

function startOver() {
    console.log('🔄 Starting over from beginning');
    hideResumeModal();
    hasUserChosenResumeAction = true;
    isInitialLoad = false;
    currentSegmentIndex = 0;
    if (currentStory) loadSegment(0);
}

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

    if (window.resumeModalReady) {
        await window.resumeModalReady;
    }

    const savedSegment = await checkAndShowResumeModal(storyId);

    if (savedSegment && savedSegment > 1) {
        currentSegmentIndex = savedSegment - 1;
        loadSegment(currentSegmentIndex, { skipProgressSave: true });
        return;
    }

    hasUserChosenResumeAction = true;
    isInitialLoad = false;
    currentSegmentIndex = 0;
    loadSegment(0);
}

function setupSpeakButton() {
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
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleSpeak();
            });
            return true;
        } else {
            attempts++;
            if (attempts < maxAttempts) setTimeout(trySetup, 300);
            return false;
        }
    };

    trySetup();
}

function updateSpeakButtonContent(btn, speaking) {
    const icon = btn.querySelector('img.speak-button-icon');
    if (icon) {
        icon.src = '../../assets/images/icons/speak-icon.svg';
        icon.alt = speaking ? 'speaking' : 'muted';
    } else {
        btn.innerHTML = speaking ? '🔊' : '🔇';
    }
}

function toggleSpeak() {
    if (isSpeaking) {
        stopCurrentAudio();
    } else {
        if (!currentStory || !currentStory.segments[currentSegmentIndex]) return;
        const segment = currentStory.segments[currentSegmentIndex];
        const selectedVoice = localStorage.getItem('selected_voice') || 'boy';
        const audioPath = segment[`audio-${selectedVoice}`];
        if (audioPath) playSegmentAudio(audioPath);
    }
}

function updateSpeakButton() {
    const speakBtn = document.getElementById('speakBtn');
    if (speakBtn) {
        updateSpeakButtonContent(speakBtn, isSpeaking);
        speakBtn.title = isSpeaking ? 'Click to stop audio' : 'Click to play audio';
    }
}

function setupVolumeControl() {
    setTimeout(() => {
        const volumeSlider = document.getElementById('volumeSlider');
        const volumeValue  = document.getElementById('volumeValue');
        if (volumeSlider && volumeValue) {
            volumeSlider.addEventListener('input', function () {
                volumeValue.textContent = this.value;
                localStorage.setItem('volume', this.value);
                if (currentAudio) currentAudio.volume = parseInt(this.value) / 100;
            });
        }
    }, 500);
}

function loadSegment(index, options = {}) {
    if (!currentStory || index < 0 || index >= currentStory.segments.length) return;

    stopCurrentAudio();
    currentSegmentIndex = index;
    const segment = currentStory.segments[index];

    const shouldSkipSave = options.skipProgressSave === true || !hasUserChosenResumeAction;
    if (!shouldSkipSave) {
        saveLastViewedSegment(index + 1);
        markSegmentAsCompleted(index + 1);
    }

    document.getElementById('currentSegment').textContent = index + 1;

    const storyTextElement = document.getElementById('storyText');
    const contentContainer = document.getElementById('storyContent');

    contentContainer.style.opacity = '0';
    storyTextElement.style.opacity = '0';
    storyTextElement.style.transform = 'translateY(30px)';
    storyTextElement.style.transition = 'none';
    storyTextElement.style.animation = 'none';

    const videoSource = document.getElementById('videoSource');
    const video = document.getElementById('storyVideo');

    videoSource.src = '../../' + segment.illustration;
    video.load();
    video.loop = false;

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
    };

    video.play();
    updateStoryText(segment);
    isSpeaking = false;
    updateSpeakButton();
    updateNavigationButtons();
}

async function saveLastViewedSegment(segmentNumber) {
    try {
        const currentUser    = JSON.parse(localStorage.getItem('currentUser'));
        const fallbackUserId = parseInt(localStorage.getItem('lastUserId'));
        const userId  = currentUser?.id || fallbackUserId;
        const storyId = getStoryIdFromUrl();

        sessionStorage.setItem(`lastViewed_story_${storyId}`, segmentNumber);

        if (userId) {
            await bridge.invoke('progress:saveLastViewed', {
                userId,
                storyId,
                segmentId: segmentNumber
            });
        }
    } catch (error) {
        console.error('Error saving last viewed segment:', error);
    }
}

async function markSegmentAsCompleted(segmentNumber) {
    try {
        const currentUser    = JSON.parse(localStorage.getItem('currentUser'));
        const fallbackUserId = parseInt(localStorage.getItem('lastUserId'));
        const userId  = currentUser?.id || fallbackUserId;
        const storyId = getStoryIdFromUrl();

        if (userId) {
            await bridge.invoke('progress:markSegmentComplete', {
                userId,
                storyId,
                segmentId: segmentNumber
            });
        }
    } catch (error) {
        console.error('Error marking segment as completed:', error);
    }
}

function updateStoryText(segment) {
    const storyTextElement = document.getElementById('storyText');
    let textHtml = segment.text;
    const selectedVoice = localStorage.getItem('selected_voice') || 'boy';

    if (segment.vocabulary && segment.vocabulary.length > 0) {
        const sortedVocab = [...segment.vocabulary].sort((a, b) => b.word.length - a.word.length);

        sortedVocab.forEach(vocab => {
            const escapedWord = vocab.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\b${escapedWord}\\b`, 'gi');

            if (regex.test(textHtml)) {
                regex.lastIndex = 0;
                const vocabAudioPath = vocab[`audio-${selectedVoice}`] || '';

                textHtml = textHtml.replace(regex, (match) => {
                    const safeWord        = vocab.word.replace(/'/g, "\\'");
                    const safePronunc     = vocab.pronunciation.replace(/'/g, "\\'");
                    const safeSynonym     = vocab.synonym.replace(/'/g, "\\'");
                    const safeDefinition  = vocab.definition.replace(/'/g, "\\'");
                    const safeAudioPath   = vocabAudioPath.replace(/'/g, "\\'");

                    return `<span class="interactive-word"
                        onclick="showDefinition('${safeWord}', '${safePronunc}', 'Synonym: ${safeSynonym}', '${safeDefinition}', '${safeAudioPath}')">
                        ${match}
                    </span>`;
                });
            }
        });
    }

    storyTextElement.innerHTML = textHtml;
}

function playSegmentAudio(audioPath) {
    stopCurrentAudio();
    currentAudio = new Audio('../../' + audioPath);
    const volume = parseInt(localStorage.getItem('volume') || '70') / 100;
    currentAudio.volume = volume;

    isSpeaking = true;
    updateSpeakButton();

    currentAudio.play().catch(error => {
        isSpeaking = false;
        updateSpeakButton();
    });

    currentAudio.addEventListener('ended', () => {
        currentAudio = null;
        isSpeaking = false;
        updateSpeakButton();
    });
}

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
        if (e.key === 'ArrowLeft' && currentSegmentIndex > 0)   prevBtn.click();
        else if (e.key === 'ArrowRight')                          nextBtn.click();
    });
}

function updateNavigationButtons() {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    prevBtn.style.opacity  = currentSegmentIndex === 0 ? '0.5' : '1';
    prevBtn.style.cursor   = currentSegmentIndex === 0 ? 'not-allowed' : 'pointer';
    prevBtn.disabled       = currentSegmentIndex === 0;

    if (currentSegmentIndex === currentStory.segments.length - 1) {
        nextBtn.textContent = 'Complete ✓';
        nextBtn.style.background = '#4ade80';
    } else {
        nextBtn.textContent = 'Next →';
        nextBtn.style.background = '#FFD93D';
    }
}

function showCompletionScreen() {
    stopCurrentAudio();
    const storyId    = currentStory.id;
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

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const boyVoice  = document.getElementById('boyVoice');
        const girlVoice = document.getElementById('girlVoice');
        if (boyVoice && girlVoice) {
            boyVoice.addEventListener('click',  () => { stopCurrentAudio(); setTimeout(() => updateStoryText(currentStory.segments[currentSegmentIndex]), 100); });
            girlVoice.addEventListener('click', () => { stopCurrentAudio(); setTimeout(() => updateStoryText(currentStory.segments[currentSegmentIndex]), 100); });
        }
    }, 500);
});

// Save position before navigating away
window.addEventListener('beforeunload', () => {
    stopCurrentAudio();
    if (currentStory && currentSegmentIndex >= 0) {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        const userId  = currentUser?.id || parseInt(localStorage.getItem('lastUserId'));
        const storyId = getStoryIdFromUrl();
        if (userId) {
            // Best-effort async save on page unload
            bridge.invoke('progress:saveLastViewed', {
                userId,
                storyId,
                segmentId: currentSegmentIndex + 1
            }).catch(() => {});
        }
    }
});

window.addEventListener('DOMContentLoaded', initStoryViewer);
