// story-viewer.js - Dynamic Story Viewer with finish-book.html Flow

let currentStory = null;
let currentSegmentIndex = 0;
let storyData = null;
let currentAudio = null; // Track current audio for cleanup

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
    }
}

// Get segment from URL (for resume functionality)
function getSegmentFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const segment = parseInt(urlParams.get('segment'));
    return segment && segment > 0 ? segment - 1 : 0; // Convert to 0-indexed
}

// Initialize story viewer
async function initStoryViewer() {
    const storyId = getStoryIdFromUrl();
    console.log('Loading story ID:', storyId);
    
    const story = await loadStoryData(storyId);
    if (!story) return;
    
    currentStory = story;
    
    // Check if resuming from a specific segment
    const resumeSegment = getSegmentFromUrl();
    currentSegmentIndex = resumeSegment;
    
    console.log('Starting at segment:', currentSegmentIndex + 1);
    
    // Update page title
    document.title = story.title + ' - VocabVenture';
    
    // Update total segments display
    document.getElementById('totalSegments').textContent = story.totalSegments;
    
    // Load the starting segment
    loadSegment(currentSegmentIndex);
    
    // Setup navigation buttons
    setupNavigation();
}

// Load a specific segment
function loadSegment(index) {
    if (!currentStory || index < 0 || index >= currentStory.segments.length) {
        return;
    }
    
    // Stop any currently playing audio before loading new segment
    stopCurrentAudio();
    
    currentSegmentIndex = index;
    const segment = currentStory.segments[index];
    
    console.log('Loading segment:', index + 1, segment);
    
    // Save last viewed segment to database
    saveLastViewedSegment(index + 1); // Save as 1-indexed
    
    // Update segment counter
    document.getElementById('currentSegment').textContent = index + 1;
    
    // Update video
    const videoSource = document.getElementById('videoSource');
    const video = document.getElementById('storyVideo');
    
    // Get the correct audio path based on voice selection
    const selectedVoice = localStorage.getItem('selected_voice') || 'boy';
    const audioPath = segment[`audio-${selectedVoice}`];
    
    videoSource.src = '../../' + segment.illustration;
    video.load();
    video.play();
    
    // Update text content with interactive words
    updateStoryText(segment);
    
    // Play audio if sound is enabled
    if (audioPath && localStorage.getItem('sound_enabled') !== 'false') {
        playSegmentAudio(audioPath);
    }
    
    // Update navigation buttons
    updateNavigationButtons();
}

// Save last viewed segment to database
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
            
            console.log(`Last viewed segment saved: ${segmentNumber}`);
        }
    } catch (error) {
        console.error('Error saving last viewed segment:', error);
    }
}

// Update story text with interactive vocabulary words
function updateStoryText(segment) {
    const storyTextElement = document.getElementById('storyText');
    let textHtml = segment.text;
    
    // Get selected voice for vocab audio
    const selectedVoice = localStorage.getItem('selected_voice') || 'boy';
    
    // Replace vocabulary words with interactive spans
    if (segment.vocabulary && segment.vocabulary.length > 0) {
        // Sort vocabulary by word length (longest first) to handle overlapping words
        const sortedVocab = [...segment.vocabulary].sort((a, b) => b.word.length - a.word.length);
        
        sortedVocab.forEach(vocab => {
            const word = vocab.word;
            
            // Escape special characters for regex
            const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            
            // Create regex that matches whole word, case insensitive
            const regex = new RegExp(`\\b${escapedWord}\\b`, 'gi');
            
            // Check if this word exists in the text
            if (regex.test(textHtml)) {
                // Reset regex lastIndex
                regex.lastIndex = 0;
                
                // Get the audio path based on selected voice
                const vocabAudioPath = vocab[`audio-${selectedVoice}`] || '';
                
                // Replace the word with interactive span
                textHtml = textHtml.replace(regex, (match) => {
                    // Escape quotes in the data attributes to prevent breaking HTML
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
            } else {
                console.warn(`Vocabulary word "${word}" not found in segment text`);
            }
        });
    }
    
    storyTextElement.innerHTML = textHtml;
}

// Play segment audio
function playSegmentAudio(audioPath) {
    // Stop any existing audio first
    stopCurrentAudio();
    
    // Create new audio instance
    currentAudio = new Audio('../../' + audioPath);
    const volume = parseInt(localStorage.getItem('volume') || '70') / 100;
    currentAudio.volume = volume;
    
    // Play the audio
    currentAudio.play().catch(error => {
        console.log('Audio play prevented:', error);
    });
    
    // Clean up when audio ends
    currentAudio.addEventListener('ended', () => {
        currentAudio = null;
    });
}

// Setup navigation buttons
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
            // Story completed - go to finish-book.html
            showCompletionScreen();
        }
    });
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft' && currentSegmentIndex > 0) {
            prevBtn.click();
        } else if (e.key === 'ArrowRight') {
            nextBtn.click();
        }
    });
}

// Update navigation button states
function updateNavigationButtons() {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    // Disable previous button on first segment
    if (currentSegmentIndex === 0) {
        prevBtn.style.opacity = '0.5';
        prevBtn.style.cursor = 'not-allowed';
        prevBtn.disabled = true;
    } else {
        prevBtn.style.opacity = '1';
        prevBtn.style.cursor = 'pointer';
        prevBtn.disabled = false;
    }
    
    // Change next button text on last segment
    if (currentSegmentIndex === currentStory.segments.length - 1) {
        nextBtn.textContent = 'Complete ✓';
        nextBtn.style.background = '#4ade80';
    } else {
        nextBtn.textContent = 'Next →';
        nextBtn.style.background = '#FFD93D';
    }
}

// Show completion screen - UPDATED: Go to finish-book.html
function showCompletionScreen() {
    // Stop audio before transitioning
    stopCurrentAudio();
    
    // Store story completion data
    const storyId = currentStory.id;
    const storyTitle = currentStory.title;
    
    // Store in sessionStorage for finish-book page
    sessionStorage.setItem('quizStoryId', storyId);
    sessionStorage.setItem('completedStory', JSON.stringify({
        id: storyId,
        title: storyTitle,
        totalSegments: currentStory.totalSegments,
        vocabularyCount: currentStory.vocabularySummary ? currentStory.vocabularySummary.length : 0
    }));
    
    // Redirect to finish-book.html to show gold badge
    window.location.href = `finish-book.html?story=${storyId}`;
}

// Listen for voice changes
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for components to load
    setTimeout(() => {
        const boyVoice = document.getElementById('boyVoice');
        const girlVoice = document.getElementById('girlVoice');
        
        if (boyVoice && girlVoice) {
            boyVoice.addEventListener('click', () => {
                // Reload current segment with new voice
                loadSegment(currentSegmentIndex);
            });
            
            girlVoice.addEventListener('click', () => {
                // Reload current segment with new voice
                loadSegment(currentSegmentIndex);
            });
        }
    }, 500);
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopCurrentAudio();
});

// Initialize when page loads
window.addEventListener('DOMContentLoaded', initStoryViewer);