// lets-review.js - Vocabulary Review Page Logic (Shows Only Incorrect Words)

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
        
        // Extract vocabulary from incorrect answers
        extractVocabulary();
        
        // Display first word if any
        if (vocabularyWords.length > 0) {
            displayWord(0);
        }
        
    } catch (error) {
        console.error('Error loading story:', error);
        alert('Failed to load vocabulary. Redirecting to library...');
        window.location.href = 'library.html';
    }
}

// Extract vocabulary words - only from incorrect quiz answers
function extractVocabulary() {
    vocabularyWords = [];
    
    // Get quiz results to find incorrect answers
    const quiz1Results = sessionStorage.getItem('quiz1Results');
    const quiz2Results = sessionStorage.getItem('quiz2Results');
    
    // Determine which quiz we're reviewing (prioritize quiz 2 if it exists)
    const quizResults = quiz2Results ? JSON.parse(quiz2Results) : (quiz1Results ? JSON.parse(quiz1Results) : null);
    
    if (!quizResults || !quizResults.answers) {
        console.log('No quiz results found, showing all vocabulary');
        // Fallback: show all vocabulary if no quiz results
        extractAllVocabulary();
        return;
    }
    
    // Get incorrect question indices
    const incorrectQuestionIndices = quizResults.answers
        .filter(answer => !answer.correct)
        .map(answer => answer.questionIndex);
    
    console.log('Incorrect questions:', incorrectQuestionIndices);
    
    if (incorrectQuestionIndices.length === 0) {
        console.log('All answers correct! Showing congratulations message.');
        showPerfectScoreMessage();
        return;
    }
    
    // Get the quiz data to map question indices to vocabulary words
    const quizData = quiz2Results ? storyData.quiz2 : storyData.quiz1;
    
    // Extract vocabulary words from incorrect questions
    incorrectQuestionIndices.forEach(questionIndex => {
        const question = quizData.questions[questionIndex];
        
        if (!question) return;
        
        // For Quiz 2, use the underlinedWord (what was actually tested)
        const wordToFind = question.underlinedWord || question.options[question.correctAnswer];
        
        console.log(`Question ${questionIndex}: Looking for word "${wordToFind}"`);
        
        // Find this word in the story's vocabulary
        let foundMatch = false;
        storyData.segments.forEach(segment => {
            if (segment.vocabulary && segment.vocabulary.length > 0) {
                segment.vocabulary.forEach(vocab => {
                    // Match by word (case-insensitive, handle spaces/hyphens)
                    const normalizedVocabWord = vocab.word.toLowerCase().replace(/[\s-]/g, '');
                    const normalizedSearchWord = wordToFind.toLowerCase().replace(/[\s-]/g, '');
                    
                    if (normalizedVocabWord === normalizedSearchWord) {
                        // Avoid duplicates
                        if (!vocabularyWords.some(v => v.word === vocab.word)) {
                            vocabularyWords.push(vocab);
                            foundMatch = true;
                            console.log(`✓ Matched "${wordToFind}" to vocabulary word "${vocab.word}"`);
                        }
                    }
                });
            }
        });
        
        if (!foundMatch) {
            console.log(`✗ Could not find vocabulary match for "${wordToFind}"`);
        }
    });
    
    console.log(`Found ${vocabularyWords.length} vocabulary words from incorrect answers`);
    
    if (vocabularyWords.length === 0) {
        console.log('Could not map incorrect answers to vocabulary, showing all');
        extractAllVocabulary();
        return;
    }
    
    document.getElementById('totalWords').textContent = vocabularyWords.length;
}

// Fallback: Extract all vocabulary words from story segments
function extractAllVocabulary() {
    vocabularyWords = [];
    
    storyData.segments.forEach(segment => {
        if (segment.vocabulary && segment.vocabulary.length > 0) {
            segment.vocabulary.forEach(vocab => {
                vocabularyWords.push(vocab);
            });
        }
    });
    
    console.log(`Showing all ${vocabularyWords.length} vocabulary words`);
    document.getElementById('totalWords').textContent = vocabularyWords.length;
}

// Show message when user got perfect score
function showPerfectScoreMessage() {
    // Hide normal word display
    const wordDisplay = document.querySelector('.word-display-container') || 
                        document.getElementById('wordDisplay') ||
                        document.querySelector('.review-content');
    
    if (wordDisplay) {
        wordDisplay.style.display = 'none';
    }
    
    // Hide navigation buttons
    const navButtons = document.querySelector('.navigation-buttons') ||
                       document.querySelector('.word-navigation');
    if (navButtons) {
        navButtons.style.display = 'none';
    }
    
    // Show perfect score message
    const container = document.querySelector('.review-container') || 
                      document.querySelector('.main-content') ||
                      document.body;
    
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
        text-align: center;
        padding: 60px 20px;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px);
        border-radius: 24px;
        margin: 40px auto;
        max-width: 600px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    `;
    
    messageDiv.innerHTML = `
        <div style="font-size: 5rem; margin-bottom: 20px;">🎉</div>
        <h2 style="font-family: 'Baloo 2', cursive; font-size: 2.5rem; color: #4ade80; margin-bottom: 16px;">
            Perfect Score!
        </h2>
        <p style="font-family: 'Nunito', sans-serif; font-size: 1.3rem; color: #333; margin-bottom: 30px; line-height: 1.6;">
            You got all the words correct!<br>
            No vocabulary to review.
        </p>
        <button onclick="goBackToResults()" style="
            background: #FFD93D;
            border: 3px solid #FF6B35;
            padding: 16px 32px;
            border-radius: 16px;
            font-family: 'Baloo 2', cursive;
            font-size: 1.2rem;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        " onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 6px 16px rgba(0, 0, 0, 0.2)'" 
           onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 4px 12px rgba(0, 0, 0, 0.15)'">
            Back to Results
        </button>
    `;
    
    container.appendChild(messageDiv);
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
    
    if (!prevBtn || !nextBtn) return;
    
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
window.goBackToResults = goBackToResults;
window.nextWord = nextWord;
window.previousWord = previousWord;
window.playCurrentWordAudio = playCurrentWordAudio;
window.loadStoryData = loadStoryData;