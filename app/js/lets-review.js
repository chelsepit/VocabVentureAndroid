// lets-review.js - Vocabulary Review Page Logic (Review Mode)

let storyData = null;
let vocabularyWords = [];
let currentWordIndex = 0;
let currentWordAudio = null;

// Get story ID from URL or session
function getStoryId() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlStoryId = urlParams.get('story');
    const sessionStoryId = sessionStorage.getItem('quizStoryId');
    
    return parseInt(urlStoryId || sessionStoryId) || 1;
}

// Load story data
async function loadStoryData() {
    const storyId = getStoryId();
    
    try {
        const response = await fetch(`../../data/stories/story-${storyId}.json`);
        if (!response.ok) {
            throw new Error('Story not found');
        }
        storyData = await response.json();
        console.log('Story loaded for review:', storyData.title);
        
        // Extract all vocabulary words from segments
        extractVocabulary();
        
        // Display first word
        displayWord(0);
        
    } catch (error) {
        console.error('Error loading story:', error);
        alert('Failed to load vocabulary. Redirecting to library...');
        window.location.href = 'library.html';
    }
}

// Extract all vocabulary words from story segments
function extractVocabulary() {
    vocabularyWords = [];
    
    storyData.segments.forEach(segment => {
        if (segment.vocabulary && segment.vocabulary.length > 0) {
            segment.vocabulary.forEach(vocab => {
                vocabularyWords.push(vocab);
            });
        }
    });
    
    console.log(`Found ${vocabularyWords.length} vocabulary words`);
    document.getElementById('totalWords').textContent = vocabularyWords.length;
}

// Display a specific word
function displayWord(index) {
    if (index < 0 || index >= vocabularyWords.length) {
        return;
    }
    
    // Stop any playing audio
    stopWordAudio();
    
    currentWordIndex = index;
    const vocab = vocabularyWords[index];
    
    // Update display
    document.getElementById('currentWord').textContent = vocab.word.toUpperCase();
    document.getElementById('wordDefinition').textContent = vocab.definition;
    document.getElementById('currentWordIndex').textContent = index + 1;
    
    // Update navigation buttons
    updateNavigationButtons();
}

// Play current word audio
function playCurrentWordAudio() {
    const vocab = vocabularyWords[currentWordIndex];
    const selectedVoice = localStorage.getItem('selected_voice') || 'boy';
    const audioPath = vocab[`audio-${selectedVoice}`];
    
    if (!audioPath) {
        console.log('No audio available for this word');
        return;
    }
    
    // Stop any existing audio
    stopWordAudio();
    
    // Create and play new audio
    currentWordAudio = new Audio('../../' + audioPath);
    const volume = parseInt(localStorage.getItem('volume') || '70') / 100;
    currentWordAudio.volume = volume;
    
    currentWordAudio.play().catch(error => {
        console.error('Error playing word audio:', error);
    });
    
    // Clean up when audio ends
    currentWordAudio.addEventListener('ended', () => {
        currentWordAudio = null;
    });
}

// Stop word audio
function stopWordAudio() {
    if (currentWordAudio) {
        currentWordAudio.pause();
        currentWordAudio.currentTime = 0;
        currentWordAudio = null;
    }
}

// Navigate to previous word
function previousWord() {
    if (currentWordIndex > 0) {
        displayWord(currentWordIndex - 1);
    }
}

// Navigate to next word
function nextWord() {
    if (currentWordIndex < vocabularyWords.length - 1) {
        displayWord(currentWordIndex + 1);
    }
}

// Update navigation button states
function updateNavigationButtons() {
    const prevBtn = document.getElementById('prevWordBtn');
    const nextBtn = document.getElementById('nextWordBtn');
    const backBtn = document.getElementById('backBtn');
    
    // Disable previous on first word
    if (currentWordIndex === 0) {
        prevBtn.style.opacity = '0.5';
        prevBtn.style.cursor = 'not-allowed';
        prevBtn.disabled = true;
    } else {
        prevBtn.style.opacity = '1';
        prevBtn.style.cursor = 'pointer';
        prevBtn.disabled = false;
    }
    
    // Disable next on last word
    if (currentWordIndex === vocabularyWords.length - 1) {
        nextBtn.style.opacity = '0.5';
        nextBtn.style.cursor = 'not-allowed';
        nextBtn.disabled = true;
    } else {
        nextBtn.style.opacity = '1';
        nextBtn.style.cursor = 'pointer';
        nextBtn.disabled = false;
    }
}

// Go back to results
function goBackToResults() {
    // Get which quiz we came from
    const quiz1Results = sessionStorage.getItem('quiz1Results');
    const quiz2Results = sessionStorage.getItem('quiz2Results');
    
    // Determine which quiz to return to
    const quizNumber = quiz2Results ? 2 : 1;
    
    window.location.href = `game-result.html?story=${getStoryId()}&quiz=${quizNumber}`;
}

// Keyboard navigation
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
        previousWord();
    } else if (e.key === 'ArrowRight') {
        nextWord();
    } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        playCurrentWordAudio();
    } else if (e.key === 'Escape') {
        goBackToResults();
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopWordAudio();
});

// Initialize when page loads
window.addEventListener('DOMContentLoaded', loadStoryData);