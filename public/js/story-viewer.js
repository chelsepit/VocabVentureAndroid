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

    // ORIENTATION FIX:
    // Lock portrait BEFORE navigating so the new page inherits it immediately.
    // If we locked after navigation the WebView would briefly flash in landscape.
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

function getCurrentOrientationType() {
    // Modern API
    if (screen.orientation && screen.orientation.type) {
        return screen.orientation.type; // e.g. "portrait-primary", "landscape-primary"
    }
    // Legacy Android WebView fallback
    const angle = window.orientation ?? 0;
    return (angle === 90 || angle === -90) ? 'landscape-primary' : 'portrait-primary';
}

function showLandscapeModal() {
    const overlay  = document.getElementById('landscapeOverlay');
    const btn      = document.getElementById('switchLandscapeBtn');
    const note     = document.getElementById('alreadyLandscapeNote');

    const alreadyLandscape = getCurrentOrientationType().startsWith('landscape');

    if (alreadyLandscape) {
        note.style.display = 'block';
        btn.textContent    = '✅ Continue in Landscape';
    }

    // Make overlay visible (CSS transition handles the fade-in)
    overlay.classList.add('orient-overlay--visible');

    // Button tap → lock orientation → dismiss modal
    btn.addEventListener('click', async () => {
        btn.disabled    = true;
        btn.textContent = 'Locking...';

        await lockLandscape();

        // Dismiss overlay
        overlay.classList.remove('orient-overlay--visible');

        // After transition ends, remove from paint tree so it can't intercept taps
        overlay.addEventListener('transitionend', () => {
            overlay.style.display = 'none';
        }, { once: true });
    });
}

// ── Main init ─────────────────────────────────────────────────────────────────

async function initStoryViewer() {
    const storyId = getStoryIdFromUrl();
    const story   = await loadStoryData(storyId);
    if (!story) return;

    currentStory         = story;
    currentSegmentIndex  = getSegmentFromUrl();

    document.title = story.title + ' - VocabVenture';
    document.getElementById('totalSegments').textContent = story.totalSegments;

    loadSegment(currentSegmentIndex);
    setupNavigation();
    setupVolumeControl();
    setupSpeakButton();
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    // Re-register the continuous landscape guard in case Android dropped it
    // during WebView navigation (e.g. user navigated back to this page).
    enforceStoryOrientation();

    // Show landscape modal immediately — story loads in the background.
    // The modal overlay blocks all interaction until the user locks orientation.
    showLandscapeModal();

    document.getElementById('boyVoice')?.addEventListener('click',  () => stopCurrentAudio());
    document.getElementById('girlVoice')?.addEventListener('click', () => stopCurrentAudio());

    // Wait for DB before starting the viewer
    if (window.__dbReady) {
        initStoryViewer();
    } else {
        document.addEventListener('db:ready', () => initStoryViewer(), { once: true });
    }
});

window.addEventListener('beforeunload', () => stopCurrentAudio());