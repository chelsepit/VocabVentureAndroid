// story-viewer.js — Capacitor/Android version
// ─────────────────────────────────────────────────────────────────────────────
// ORIENTATION CHANGES (new in this version):
//
//   1. showLandscapeModal()  — called on DOMContentLoaded.
//      Detects current orientation. If already landscape, shows the modal
//      with a "you're already in landscape" note so the user still taps
//      confirm (ensuring the plugin lock fires — not just assumed).
//
//   2. lockLandscape()       — imported from orientation.js.
//      Called when the user taps "Switch to Landscape". The story viewer
//      and all navigation are hidden behind the modal until this fires.
//
//   3. showCompletionScreen() — now calls lockPortrait() before navigating.
//      This ensures the portrait lock is in place before finish-book.html
//      loads, so there is no gap between pages where the user could rotate.
//
// WHY THE MODAL GATES THE ENTIRE STORY:
//   The overlay has pointer-events blocked until dismissed, and the story
//   content, video, and nav buttons all start hidden (opacity:0 via CSS).
//   This prevents the user from tapping Next before landscape is locked.
// ─────────────────────────────────────────────────────────────────────────────

import { db } from './db/db-interface.js';
import { lockLandscape, lockPortrait, enforceStoryOrientation } from './orientation.js';

let currentStory = null;
let currentSegmentIndex = 0;
let storyData = null;
let currentAudio = null;
let isSpeaking = false;

// ── URL helpers ───────────────────────────────────────────────────────────────

function getStoryIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return parseInt(urlParams.get('id')) || 1;
}

function getSegmentFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const segment = parseInt(urlParams.get('segment'));
    return segment && segment > 0 ? segment - 1 : 0;
}

// ── Data loading ──────────────────────────────────────────────────────────────

async function loadStoryData(storyId) {
    try {
        const cacheKey = `storyData_${storyId}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
            storyData = JSON.parse(cached);
        } else {
            const response = await fetch(`../../data/stories/story-${storyId}.json`);
            if (!response.ok) throw new Error('Story not found');
            storyData = await response.json();
            sessionStorage.setItem(cacheKey, JSON.stringify(storyData));
        }
        return storyData;
    } catch (error) {
        console.error('Error loading story data:', error);
        return null;
    }
}

// ── Audio helpers ─────────────────────────────────────────────────────────────

function stopCurrentAudio() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
        isSpeaking = false;
        updateSpeakButton();
    }
}

function playSegmentAudio(audioPath) {
    stopCurrentAudio();
    currentAudio = new Audio('../../' + audioPath);
    const volume = parseInt(localStorage.getItem('volume') || '70') / 100;
    currentAudio.volume = volume;
    isSpeaking = true;
    updateSpeakButton();
    currentAudio.play().catch(() => { isSpeaking = false; updateSpeakButton(); });
    currentAudio.addEventListener('ended', () => {
        currentAudio = null;
        isSpeaking = false;
        updateSpeakButton();
    });
}

// ── Speak button ──────────────────────────────────────────────────────────────

function setupSpeakButton() {
    let attempts = 0;
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
        } else if (++attempts < 10) {
            setTimeout(trySetup, 300);
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

// ── Volume control ────────────────────────────────────────────────────────────

function setupVolumeControl() {
    setTimeout(() => {
        const volumeSlider = document.getElementById('volumeSlider');
        const volumeValue  = document.getElementById('volumeValue');
        if (volumeSlider && volumeValue) {
            volumeSlider.addEventListener('input', function () {
                const volume = this.value;
                volumeValue.textContent = volume;
                localStorage.setItem('volume', volume);
                if (currentAudio) currentAudio.volume = parseInt(volume) / 100;
            });
        }
    }, 500);
}

// ── Segment loading ───────────────────────────────────────────────────────────

function loadSegment(index) {
    if (!currentStory || index < 0 || index >= currentStory.segments.length) return;

    stopCurrentAudio();
    currentSegmentIndex = index;
    const segment = currentStory.segments[index];

    saveLastViewedSegment(index + 1);
    markSegmentAsCompleted(index + 1);

    document.getElementById('currentSegment').textContent = index + 1;

    const storyTextElement = document.getElementById('storyText');
    const contentContainer = document.getElementById('storyContent');

    contentContainer.style.opacity = '0';
    storyTextElement.style.opacity = '0';
    storyTextElement.style.transform = 'translateY(30px)';
    storyTextElement.style.transition = 'none';
    storyTextElement.style.animation  = 'none';

    const video = document.getElementById('storyVideo');
    if (video) {
        const source = video.querySelector('source');
        if (source) {
            source.src = `../../assets/videos/story-${getStoryIdFromUrl()}/segment-${index + 1}.mp4`;
        }
        video.load();
        video.loop = false;

        video.onended = () => {
            video.currentTime = video.duration;
            setTimeout(() => {
                contentContainer.style.transition = 'opacity 0.8s ease-out';
                contentContainer.style.opacity = '1';
                storyTextElement.style.transition =
                    'opacity 0.8s ease-out, transform 1s cubic-bezier(0.68,-0.55,0.265,1.55)';
                storyTextElement.style.opacity   = '1';
                storyTextElement.style.transform = 'translateY(0)';
                setTimeout(() => {
                    storyTextElement.style.transition = 'none';
                    storyTextElement.style.animation  = 'gentleFloat 3s ease-in-out infinite';
                }, 1000);
            }, 300);
        };

        video.play();
    }

    updateStoryText(segment);
    isSpeaking = false;
    updateSpeakButton();
    updateNavigationButtons();
    preloadNextSegment(index);
}

function preloadNextSegment(currentIndex) {
    const nextIndex = currentIndex + 1;
    if (!currentStory || nextIndex >= currentStory.segments.length) return;
    const storyId = getStoryIdFromUrl();
    const existing = document.getElementById('videoPreloadLink');
    if (existing) existing.remove();
    const link = document.createElement('link');
    link.id = 'videoPreloadLink';
    link.rel = 'prefetch';
    link.as = 'video';
    link.href = `../../assets/videos/story-${storyId}/segment-${nextIndex + 1}.mp4`;
    document.head.appendChild(link);
}


// ── DB writes ─────────────────────────────────────────────────────────────────

async function saveLastViewedSegment(segmentNumber) {
    try {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        const storyId = getStoryIdFromUrl();
        if (currentUser) {
            await db.saveLastViewedSegment(currentUser.id, storyId, segmentNumber);
        }
    } catch (error) {
        console.error('Error saving last viewed segment:', error);
    }
}

async function markSegmentAsCompleted(segmentNumber) {
    try {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        const storyId = getStoryIdFromUrl();
        if (currentUser) {
            await db.markSegmentComplete(currentUser.id, storyId, segmentNumber);
        }
    } catch (error) {
        console.error('Error marking segment as completed:', error);
    }
}

// ── Story text rendering ──────────────────────────────────────────────────────

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
                    const safeWord       = vocab.word.replace(/'/g, "\\'");
                    const safePronunc    = vocab.pronunciation.replace(/'/g, "\\'");
                    const safeSynonym    = vocab.synonym.replace(/'/g, "\\'");
                    const safeDefinition = vocab.definition.replace(/'/g, "\\'");
                    const safeAudioPath  = vocabAudioPath.replace(/'/g, "\\'");
                    return `<span class="interactive-word"
                        onclick="showDefinition('${safeWord}','${safePronunc}','Synonym: ${safeSynonym}','${safeDefinition}','${safeAudioPath}')">
                        ${match}</span>`;
                });
            }
        });
    }
    storyTextElement.innerHTML = textHtml;
}

// ── Navigation ────────────────────────────────────────────────────────────────

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
        if (e.key === 'ArrowLeft' && currentSegmentIndex > 0) prevBtn.click();
        else if (e.key === 'ArrowRight') nextBtn.click();
    });
}

function updateNavigationButtons() {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    prevBtn.style.opacity = currentSegmentIndex === 0 ? '0.5' : '1';
    prevBtn.style.cursor  = currentSegmentIndex === 0 ? 'not-allowed' : 'pointer';
    prevBtn.disabled      = currentSegmentIndex === 0;

    if (currentSegmentIndex === currentStory.segments.length - 1) {
        nextBtn.textContent       = 'Complete ✓';
        nextBtn.style.background  = '#4ade80';
    } else {
        nextBtn.textContent       = 'Next →';
        nextBtn.style.background  = '#FFD93D';
    }
}

// ── Completion ────────────────────────────────────────────────────────────────

async function showCompletionScreen() {
    stopCurrentAudio();
  await lockPortrait();   

    const storyId    = currentStory.id;
    const storyTitle = currentStory.title;
    sessionStorage.setItem('quizStoryId', storyId);
    sessionStorage.setItem('completedStory', JSON.stringify({
        id: storyId,
        title: storyTitle,
        totalSegments: currentStory.totalSegments,
        vocabularyCount: currentStory.vocabularySummary?.length ?? 0
    }));

    window.location.href = `finish-book.html?story=${storyId}`;
}

// ── ORIENTATION MODAL ─────────────────────────────────────────────────────────
//
// Strategy:
//   • Show the modal immediately on page load (before the story starts).
//   • Detect if the device is already in landscape using window.screen.orientation
//     or the legacy window.orientation fallback (some Android WebViews).
//   • If already landscape → show a note and change button text to "Continue".
//   • When the button is tapped → call lockLandscape() from orientation.js,
//     then dismiss the modal.
//
// WHY WE STILL CALL lockLandscape() EVEN WHEN ALREADY IN LANDSCAPE:
//   screen.orientation.type can return 'landscape-primary' but the Capacitor
//   plugin lock may not have been applied yet (e.g. user rotated manually).
//   Without the plugin lock, Android will allow the user to rotate back.
//   Calling lock() even when already in landscape guarantees the OS-level
//   lock is engaged.



// ── Resume Modal (Electron-pattern: story loads first, modal shows on top) ────

let savedResumeSegment = 0;

async function checkAndShowResumeModal(storyId) {
    console.log('🔍 checkAndShowResumeModal, storyId:', storyId);
    try {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        const userId = currentUser?.id || parseInt(localStorage.getItem('lastUserId'));
        if (!userId) return 0;

        const lastSegment = await db.getLastViewedSegment(userId, storyId);
        console.log('📍 lastViewedSegment from DB:', lastSegment);

        if (lastSegment && lastSegment > 1 && lastSegment <= currentStory.totalSegments) {
            savedResumeSegment = lastSegment;
            const modal = document.getElementById('resumeModalOverlay');
            if (modal) {
                modal.classList.remove('hidden');
                console.log('📻 Resume modal shown — saved at segment:', lastSegment);
                return lastSegment;
            } else {
                console.warn('⚠️ resumeModalOverlay not found in DOM');
            }
        }
    } catch (err) {
        console.error('❌ checkAndShowResumeModal error:', err);
    }
    return 0;
}


// ── Main init ─────────────────────────────────────────────────────────────────

async function initStoryViewer() {
   lockLandscape().catch(() => {});

    const storyId = getStoryIdFromUrl();
    const story   = await loadStoryData(storyId);
    if (!story) return;

    currentStory = story;

    document.title = story.title + ' - VocabVenture';
    document.getElementById('totalSegments').textContent = story.totalSegments;

    setupNavigation();
    setupVolumeControl();
    setupSpeakButton();

    // ── Step 1: Check DB and show resume modal if needed ──────────────────
    // This follows the Electron pattern: story is ready, modal shows ON TOP.
    // continueGame() / startOver() call loadSegment() directly — no Promise needed.
    const savedSegment = await checkAndShowResumeModal(storyId);

    if (savedSegment && savedSegment > 1) {
        // Resume modal is visible — load the saved segment silently in background.
        // The user will see it after they tap Continue or Start Over.
        console.log('📍 Pre-loading saved segment', savedSegment, 'behind resume modal');
        currentSegmentIndex = savedSegment - 1;
        loadSegment(currentSegmentIndex);
        // Don't show orientation modal yet — continueGame/startOver will trigger it
        return;
    }

    // ── Step 2: No saved progress — show orientation modal then start ──────
  
    loadSegment(0);
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
      enforceStoryOrientation();
      
    document.getElementById('boyVoice')?.addEventListener('click',  () => stopCurrentAudio());
    document.getElementById('girlVoice')?.addEventListener('click', () => stopCurrentAudio());

    if (window.__dbReady) {
        initStoryViewer();
    } else {
        document.addEventListener('db:ready', () => initStoryViewer(), { once: true });
    }
});

window.addEventListener('beforeunload', () => stopCurrentAudio());