// story-viewer.js — Capacitor/Android version
// REMOVED: const { ipcRenderer } = require('electron') (in saveLastViewedSegment & markSegmentAsCompleted)
// REPLACED: ipcRenderer.invoke → direct db calls

import { db } from './db/db-interface.js';

let currentStory = null;
let currentSegmentIndex = 0;
let storyData = null;
let currentAudio = null;
let isSpeaking = false;

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

function getSegmentFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const segment = parseInt(urlParams.get('segment'));
    return segment && segment > 0 ? segment - 1 : 0;
}

async function initStoryViewer() {
    const storyId = getStoryIdFromUrl();
    const story = await loadStoryData(storyId);
    if (!story) return;

    currentStory = story;
    currentSegmentIndex = getSegmentFromUrl();

    document.title = story.title + ' - VocabVenture';
    document.getElementById('totalSegments').textContent = story.totalSegments;

    loadSegment(currentSegmentIndex);
    setupNavigation();
    setupVolumeControl();
    setupSpeakButton();
}

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

function setupVolumeControl() {
    setTimeout(() => {
        const volumeSlider = document.getElementById('volumeSlider');
        const volumeValue = document.getElementById('volumeValue');
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
    storyTextElement.style.animation = 'none';

    // Video handling — unchanged from Electron version
    const video = document.getElementById('storyVideo');
    if (video) {
        const source = video.querySelector('source');
        if (source) source.src = `../../assets/videos/story-${getStoryIdFromUrl()}/segment-${index + 1}.mp4`;
        video.load();
        video.loop = false;

        video.onended = () => {
            video.currentTime = video.duration;
            setTimeout(() => {
                contentContainer.style.transition = 'opacity 0.8s ease-out';
                contentContainer.style.opacity = '1';
                storyTextElement.style.transition = 'opacity 0.8s ease-out, transform 1s cubic-bezier(0.68,-0.55,0.265,1.55)';
                storyTextElement.style.opacity = '1';
                storyTextElement.style.transform = 'translateY(0)';
                setTimeout(() => {
                    storyTextElement.style.transition = 'none';
                    storyTextElement.style.animation = 'gentleFloat 3s ease-in-out infinite';
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

// CHANGED: was ipcRenderer.invoke('progress:saveLastViewed', ...)
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

// CHANGED: was ipcRenderer.invoke('progress:markSegmentComplete', ...)
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
                        onclick="showDefinition('${safeWord}','${safePronunc}','Synonym: ${safeSynonym}','${safeDefinition}','${safeAudioPath}')">
                        ${match}</span>`;
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
    currentAudio.play().catch(() => { isSpeaking = false; updateSpeakButton(); });
    currentAudio.addEventListener('ended', () => { currentAudio = null; isSpeaking = false; updateSpeakButton(); });
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
        if (e.key === 'ArrowLeft' && currentSegmentIndex > 0) prevBtn.click();
        else if (e.key === 'ArrowRight') nextBtn.click();
    });
}

function updateNavigationButtons() {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    prevBtn.style.opacity     = currentSegmentIndex === 0 ? '0.5' : '1';
    prevBtn.style.cursor      = currentSegmentIndex === 0 ? 'not-allowed' : 'pointer';
    prevBtn.disabled          = currentSegmentIndex === 0;

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
        vocabularyCount: currentStory.vocabularySummary?.length ?? 0
    }));
    window.location.href = `finish-book.html?story=${storyId}`;
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        document.getElementById('boyVoice')?.addEventListener('click',  () => stopCurrentAudio());
        document.getElementById('girlVoice')?.addEventListener('click', () => stopCurrentAudio());
    }, 500);
});

window.addEventListener('beforeunload', () => stopCurrentAudio());
window.addEventListener('DOMContentLoaded', initStoryViewer);
