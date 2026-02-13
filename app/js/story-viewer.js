// story-viewer.js - Dynamic Story Viewer

let currentStory = null;
let currentSegmentIndex = 0;
let storyData = null;

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
        window.location.href = '../dashboard/library.html';
        return null;
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

// Update story text with interactive vocabulary words
function updateStoryText(segment) {
    const storyTextElement = document.getElementById('storyText');
    let textHtml = segment.text;
    
    // Replace vocabulary words with interactive spans
    if (segment.vocabulary && segment.vocabulary.length > 0) {
        segment.vocabulary.forEach(vocab => {
            const word = vocab.word;
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            
            textHtml = textHtml.replace(regex, (match) => {
                return `<span class="interactive-word" 
                    onclick="showDefinition('${vocab.word}', '${vocab.pronunciation}', 'Synonym: ${vocab.synonym}', '${vocab.definition}')">
                    ${match}
                </span>`;
            });
        });
    }
    
    storyTextElement.innerHTML = textHtml;
}

// Play segment audio
function playSegmentAudio(audioPath) {
    const audio = new Audio('../../' + audioPath);
    const volume = parseInt(localStorage.getItem('volume') || '70') / 100;
    audio.volume = volume;
    
    audio.play().catch(error => {
        console.log('Audio play prevented:', error);
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
        if (e.key === 'ArrowLeft') {
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
    } else {
        prevBtn.style.opacity = '1';
        prevBtn.style.cursor = 'pointer';
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
    alert(`Congratulations! You've completed "${currentStory.title}"!\n\nQuiz feature coming soon!`);
    
    // TODO: Save progress to database
    // TODO: Show quiz
    // TODO: Award badges
    
    // For now, redirect to library
    setTimeout(() => {
        window.location.href = '../dashboard/library.html';
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

// Initialize when page loads
window.addEventListener('DOMContentLoaded', initStoryViewer);