// story-viewer.js - Dynamic Story Viewer

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

// Initialize story viewer
async function initStoryViewer() {
    const storyId = getStoryIdFromUrl();
    console.log('Loading story ID:', storyId);
    
    const story = await loadStoryData(storyId);
    if (!story) return;
    
    currentStory = story;
    currentSegmentIndex = 0;
    
    // Update page title
    document.title = story.title + ' - VocabVenture';
    
    // Update total segments display
    document.getElementById('totalSegments').textContent = story.totalSegments;
    
    // Load first segment
    loadSegment(0);
    
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

// Update story text with interactive vocabulary words - IMPROVED VERSION
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
            
            // Create regex that matches:
            // - Whole word (with word boundaries)
            // - Case insensitive
            // - Including words with apostrophes (e.g., "don't")
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

// Play segment audio - IMPROVED VERSION
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
            // Story completed - show quiz or completion screen
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
        nextBtn.textContent = 'Complete →';
        nextBtn.style.background = '#4ade80';
    } else {
        nextBtn.textContent = 'Next →';
        nextBtn.style.background = '#FFD93D';
    }
}

// Show completion screen
function showCompletionScreen() {
    // Stop audio before showing completion
    stopCurrentAudio();
    
    alert(`Congratulations! You've completed "${currentStory.title}"!\n\nQuiz feature coming soon!`);
    
    // TODO: Save progress to database
    // TODO: Show quiz
    // TODO: Award badges
    
    // For now, redirect to library
    setTimeout(() => {
        window.location.href = 'library.html';
    }, 1000);
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